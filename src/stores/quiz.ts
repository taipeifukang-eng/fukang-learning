import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import type {
  Quiz,
  QuizQuestion,
  QuizOption,
  QuizAttempt,
  QuizAnswer,
  LearningStats,
  CourseLearningStatus,
} from '../data/mockData'

export const useQuizStore = defineStore('quiz', () => {
  const quizzes = ref<Map<string, Quiz>>(new Map())        // key = lessonId
  const attempts = ref<QuizAttempt[]>([])                  // 當前用戶的歷史紀錄
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function debugAuthContext(tag: string) {
    const { data: sessionData } = await supabase.auth.getSession()
    const { data: userData } = await supabase.auth.getUser()
    // eslint-disable-next-line no-console
    console.log(`[QUIZ_DEBUG] ${tag}`, {
      sessionUserId: sessionData.session?.user?.id ?? null,
      authUserId: userData.user?.id ?? null,
      hasAccessToken: Boolean(sessionData.session?.access_token),
      accessTokenPrefix: sessionData.session?.access_token?.slice(0, 16) ?? null,
    })
  }

  // ── 查詢測驗（依 lessonId）─────────────────────────────────

  async function fetchQuizByLesson(lessonId: string): Promise<Quiz | null> {
    try {
      isLoading.value = true
      error.value = null

      const { data, error: err } = await supabase
        .from('quizzes')
        .select(`
          id, lesson_id, title, pass_score, enabled, created_by, created_at, updated_at,
          quiz_questions (
            id, quiz_id, sort_order, question_text, question_type, points, explanation,
            quiz_options (
              id, question_id, sort_order, option_text, is_correct
            )
          )
        `)
        .eq('lesson_id', lessonId)
        .eq('enabled', true)
        .order('sort_order', { referencedTable: 'quiz_questions' })
        .single()

      if (err) {
        if (err.code === 'PGRST116') return null  // not found
        throw err
      }

      const quiz = mapQuiz(data)
      quizzes.value.set(lessonId, quiz)
      return quiz
    } catch (err) {
      error.value = err instanceof Error ? err.message : '載入測驗失敗'
      return null
    } finally {
      isLoading.value = false
    }
  }

  // ── 管理員：取得完整測驗（含解答）────────────────────────────

  async function fetchQuizForEdit(lessonId: string): Promise<Quiz | null> {
    const { data, error: err } = await supabase
      .from('quizzes')
      .select(`
        id, lesson_id, title, pass_score, enabled, created_by, created_at, updated_at,
        quiz_questions (
          id, quiz_id, sort_order, question_text, question_type, points, explanation,
          quiz_options (
            id, question_id, sort_order, option_text, is_correct
          )
        )
      `)
      .eq('lesson_id', lessonId)
      .order('sort_order', { referencedTable: 'quiz_questions' })
      .single()

    if (err) {
      if (err.code === 'PGRST116') return null
      throw err
    }
    return mapQuiz(data)
  }

  // ── 管理員：儲存測驗（upsert 整份）───────────────────────────

  async function saveQuiz(payload: {
    lessonId: string
    title: string
    passScore: number
    questions: Array<{
      id?: string
      sortOrder: number
      questionText: string
      questionType: string
      points: number
      explanation: string
      options: Array<{
        id?: string
        sortOrder: number
        optionText: string
        isCorrect: boolean
      }>
    }>
  }): Promise<Quiz> {
    await debugAuthContext('saveQuiz:start')
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUserId = sessionData.session?.user?.id
    if (!sessionUserId) {
      throw new Error('請先使用正式帳號登入後再儲存測驗')
    }

    // 1. upsert quiz
    const { data: quizRow, error: qErr } = await supabase
      .from('quizzes')
      .upsert(
        {
          lesson_id: payload.lessonId,
          title: payload.title,
          pass_score: payload.passScore,
          created_by: sessionUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lesson_id' },
      )
      .select('id')
      .single()

    if (qErr) {
      // eslint-disable-next-line no-console
      console.error('[QUIZ_DEBUG] quizzes upsert failed', {
        code: (qErr as any).code,
        message: (qErr as any).message,
        details: (qErr as any).details,
        hint: (qErr as any).hint,
        payload: {
          lesson_id: payload.lessonId,
          title: payload.title,
          pass_score: payload.passScore,
          created_by: sessionUserId,
        },
      })
      const msg = String((qErr as any).message ?? '')
      if ((qErr as any).code === '42501' || msg.toLowerCase().includes('row-level security')) {
        throw new Error('目前登入帳號沒有測驗編輯權限（quiz:edit），請重新登入正式帳號或請管理員指派權限')
      }
      throw qErr
    }
    const quizId = quizRow.id

    // 2. 刪除舊題目（cascade 會連選項一起刪）
    await supabase.from('quiz_questions').delete().eq('quiz_id', quizId)

    // 3. 重新插入題目與選項
    for (const q of payload.questions) {
      const { data: qRow, error: qInsErr } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          sort_order: q.sortOrder,
          question_text: q.questionText,
          question_type: q.questionType,
          points: q.points,
          explanation: q.explanation,
        })
        .select('id')
        .single()

      if (qInsErr) {
        // eslint-disable-next-line no-console
        console.error('[QUIZ_DEBUG] quiz_questions insert failed', {
          code: (qInsErr as any).code,
          message: (qInsErr as any).message,
          details: (qInsErr as any).details,
          hint: (qInsErr as any).hint,
          question: q,
        })
        const msg = String((qInsErr as any).message ?? '')
        if ((qInsErr as any).code === '42501' || msg.toLowerCase().includes('row-level security')) {
          throw new Error('目前登入帳號沒有測驗編輯權限（quiz:edit），請重新登入正式帳號或請管理員指派權限')
        }
        throw qInsErr
      }

      if (q.options.length > 0) {
        const { error: optErr } = await supabase.from('quiz_options').insert(
          q.options.map((opt, idx) => ({
            question_id: qRow.id,
            sort_order: idx,
            option_text: opt.optionText,
            is_correct: opt.isCorrect,
          })),
        )
        if (optErr) {
          // eslint-disable-next-line no-console
          console.error('[QUIZ_DEBUG] quiz_options insert failed', {
            code: (optErr as any).code,
            message: (optErr as any).message,
            details: (optErr as any).details,
            hint: (optErr as any).hint,
            questionId: qRow.id,
            optionsCount: q.options.length,
          })
          const msg = String((optErr as any).message ?? '')
          if ((optErr as any).code === '42501' || msg.toLowerCase().includes('row-level security')) {
            throw new Error('目前登入帳號沒有測驗編輯權限（quiz:edit），請重新登入正式帳號或請管理員指派權限')
          }
          throw optErr
        }
      }
    }

    const quiz = await fetchQuizForEdit(payload.lessonId)
    if (!quiz) throw new Error('測驗儲存後讀取失敗')
    return quiz
  }

  // ── 提交作答 ──────────────────────────────────────────────

  async function submitAttempt(payload: {
    quizId: string
    staffProfileId: string
    answers: Array<{ questionId: string; selectedOptionIds: string[] }>
    quiz: Quiz
  }): Promise<QuizAttempt> {
    const { quizId, staffProfileId, answers, quiz } = payload

    // 計算本次嘗試序號
    const { count } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('staff_profile_id', staffProfileId)

    const attemptNo = (count ?? 0) + 1

    // 計算分數
    let totalPoints = 0
    let earnedPoints = 0

    const answerResults: Array<{ questionId: string; selectedOptionIds: string[]; isCorrect: boolean }> = []

    for (const q of quiz.questions) {
      totalPoints += q.points
      const ans = answers.find((a) => a.questionId === q.id)
      const selected = ans?.selectedOptionIds ?? []

      const correctIds = q.options.filter((opt) => opt.isCorrect).map((opt) => opt.id)
      let isCorrect = false

      if (q.questionType === 'single' || q.questionType === 'truefalse') {
        isCorrect = selected.length === 1 && correctIds.includes(selected[0])
      } else {
        // multiple: 必須完全吻合
        isCorrect =
          selected.length === correctIds.length &&
          selected.every((id) => correctIds.includes(id))
      }

      if (isCorrect) earnedPoints += q.points

      answerResults.push({ questionId: q.id, selectedOptionIds: selected, isCorrect })
    }

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const passed = score >= quiz.passScore

    // 插入 attempt
    const { data: attemptRow, error: aErr } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        staff_profile_id: staffProfileId,
        attempt_no: attemptNo,
        score,
        passed,
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (aErr) throw aErr

    // 插入 answers
    if (answerResults.length > 0) {
      const { error: ansErr } = await supabase.from('quiz_answers').insert(
        answerResults.map((ans) => ({
          attempt_id: attemptRow.id,
          question_id: ans.questionId,
          selected_option_ids: ans.selectedOptionIds,
          is_correct: ans.isCorrect,
        })),
      )
      if (ansErr) throw ansErr
    }

    const result: QuizAttempt = {
      id: attemptRow.id,
      quizId: attemptRow.quiz_id,
      staffProfileId: attemptRow.staff_profile_id,
      attemptNo: attemptRow.attempt_no,
      score: attemptRow.score,
      passed: attemptRow.passed,
      startedAt: attemptRow.started_at,
      submittedAt: attemptRow.submitted_at,
    }

    attempts.value.unshift(result)
    return result
  }

  // ── 查詢用戶作答歷史 ──────────────────────────────────────

  async function fetchAttemptHistory(quizId: string, staffProfileId: string): Promise<QuizAttempt[]> {
    const { data, error: err } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('staff_profile_id', staffProfileId)
      .order('attempt_no', { ascending: false })

    if (err) throw err

    const list: QuizAttempt[] = (data ?? []).map((row: any) => ({
      id: row.id,
      quizId: row.quiz_id,
      staffProfileId: row.staff_profile_id,
      attemptNo: row.attempt_no,
      score: row.score,
      passed: row.passed,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
    }))

    attempts.value = list
    return list
  }

  // ── 個人學習統計 ──────────────────────────────────────────

  async function fetchMyLearningStats(
    staffProfileId: string,
    courses: import('../data/mockData').Course[],
  ): Promise<LearningStats> {
    // 1. 取得所有 lesson 進度
    const { data: progressRows } = await supabase
      .from('learning_progress')
      .select('lesson_id, progress_percent, completed_at')
      .eq('staff_profile_id', staffProfileId)

    // 2. 取得所有測驗作答紀錄（取每個 quiz 的最佳分）
    const { data: attemptRows } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, passed, attempt_no, submitted_at')
      .eq('staff_profile_id', staffProfileId)
      .not('submitted_at', 'is', null)
      .order('score', { ascending: false })

    // 3. 取得測驗設定（哪些 lesson 有測驗）
    const { data: quizRows } = await supabase
      .from('quizzes')
      .select('id, lesson_id, pass_score')
      .eq('enabled', true)

    const progressMap = new Map(
      (progressRows ?? []).map((p: any) => [p.lesson_id, p]),
    )
    const quizMap = new Map(
      (quizRows ?? []).map((q: any) => [q.lesson_id, q]),
    )

    // bestAttemptMap: quizId -> { score, passed, count }
    const bestAttemptMap = new Map<string, { score: number; passed: boolean; count: number; lastAt: string }>()
    for (const row of attemptRows ?? []) {
      const existing = bestAttemptMap.get(row.quiz_id)
      if (!existing || row.score > existing.score) {
        bestAttemptMap.set(row.quiz_id, {
          score: row.score,
          passed: row.passed,
          count: (existing?.count ?? 0) + 1,
          lastAt: row.submitted_at,
        })
      } else {
        existing.count += 1
      }
    }

    let totalLessons = 0
    let completedLessons = 0
    let passedQuizzes = 0
    let pendingQuizzes = 0
    let failedQuizzes = 0
    let inProgressLessons = 0
    let notStartedLessons = 0

    const courseStats: CourseLearningStatus[] = []

    for (const course of courses.filter((c) => c.enabled)) {
      let courseCompleted = 0
      let courseLastAt: string | null = null
      let bestScore: number | null = null
      let attemptCount = 0
      let quizPassed: boolean | null = null

      for (const lesson of course.lessons) {
        totalLessons++
        const prog = progressMap.get(lesson.id)
        const percent = prog?.progress_percent ?? 0

        if (prog?.completed_at) {
          completedLessons++
          courseCompleted++
          if (!courseLastAt || prog.completed_at > courseLastAt) courseLastAt = prog.completed_at
        } else if (percent > 0) {
          inProgressLessons++
        } else {
          notStartedLessons++
        }

        // 測驗
        const quiz = quizMap.get(lesson.id)
        if (quiz) {
          const best = bestAttemptMap.get(quiz.id)
          if (best) {
            if (best.score > (bestScore ?? -1)) bestScore = best.score
            attemptCount += best.count
            if (best.passed) quizPassed = true
            else if (quizPassed !== true) quizPassed = false
          } else {
            if (quizPassed === null) quizPassed = null
          }
        }
      }

      if (quizPassed === true) passedQuizzes++
      else if (quizPassed === false) failedQuizzes++
      else if (quizMap.size > 0) pendingQuizzes++

      const completionRate =
        course.lessons.length > 0
          ? Math.round((courseCompleted / course.lessons.length) * 100)
          : 0

      let status: CourseLearningStatus['status'] = 'not_started'
      if (completionRate === 100 && quizPassed === true) status = 'completed'
      else if (completionRate === 100 && quizPassed === false) status = 'quiz_failed'
      else if (completionRate === 100 && quizPassed === null) status = 'quiz_pending'
      else if (completionRate > 0) status = 'in_progress'

      courseStats.push({
        courseId: course.id,
        courseTitle: course.title,
        coverUrl: course.coverUrl,
        totalLessons: course.lessons.length,
        completedLessons: courseCompleted,
        completionRate,
        quizPassed,
        bestScore,
        attemptCount,
        lastActivityAt: courseLastAt,
        status,
      })
    }

    const completionRate =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

    return {
      totalLessons,
      completedLessons,
      completionRate,
      passedQuizzes,
      pendingQuizzes,
      failedQuizzes,
      inProgressLessons,
      notStartedLessons,
      courseStats,
    }
  }

  // ── 工具函式 ──────────────────────────────────────────────

  function mapQuiz(data: any): Quiz {
    return {
      id: data.id,
      lessonId: data.lesson_id,
      title: data.title,
      passScore: data.pass_score,
      enabled: data.enabled,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      questions: (data.quiz_questions ?? [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((q: any): QuizQuestion => ({
          id: q.id,
          quizId: q.quiz_id,
          sortOrder: q.sort_order,
          questionText: q.question_text,
          questionType: q.question_type,
          points: q.points,
          explanation: q.explanation ?? '',
          options: (q.quiz_options ?? [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((opt: any): QuizOption => ({
              id: opt.id,
              questionId: opt.question_id,
              sortOrder: opt.sort_order,
              optionText: opt.option_text,
              isCorrect: opt.is_correct,
            })),
        })),
    }
  }

  return {
    quizzes,
    attempts,
    isLoading,
    error,
    fetchQuizByLesson,
    fetchQuizForEdit,
    saveQuiz,
    submitAttempt,
    fetchAttemptHistory,
    fetchMyLearningStats,
  }
})
