<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Quiz, QuizAttempt, QuizOption } from '../data/mockData'
import { useQuizStore } from '../stores/quiz'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  quiz: Quiz
  staffProfileId: string
}>()

const emit = defineEmits<{
  passed: [attempt: QuizAttempt]
}>()

const quizStore = useQuizStore()
const auth = useAuthStore()

// ── 狀態 ─────────────────────────────────────────────────────
type Phase = 'history' | 'doing' | 'result'
const phase = ref<Phase>('history')
const history = ref<QuizAttempt[]>([])
const lastAttempt = ref<QuizAttempt | null>(null)
const isSubmitting = ref(false)
const submitError = ref('')

// 作答暫存：questionId -> Set<optionId>
const selected = ref<Map<string, Set<string>>>(new Map())

// 每次作答時的打亂選項版本
const displayQuestions = ref<Array<typeof props.quiz.questions[number] & { options: QuizOption[] }>>([])

// 送出後顯示正確答案
const showAnswers = ref(false)

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

onMounted(loadHistory)

async function loadHistory() {
  history.value = await quizStore.fetchAttemptHistory(props.quiz.id, props.staffProfileId)
}

const bestAttempt = computed(() =>
  history.value.reduce<QuizAttempt | null>((best, a) => {
    if (!best || a.score > best.score) return a
    return best
  }, null),
)

function stripOptionPrefix(text: string): string {
  // 去除開頭的 (A)/(B)/（A）/A. 等格式，避免隨機排列後仍顯示原始順序標籤
  return text.replace(/^\s*[（(][A-Za-z\d][)）]\s*/, '').replace(/^\s*[A-Za-z\d][.、]\s*/, '').trim()
}

function startQuiz() {
  selected.value = new Map()
  showAnswers.value = false
  // 每次作答將各題選項隨機打亂，防止記憶答案位置
  displayQuestions.value = props.quiz.questions.map(q => ({
    ...q,
    options: shuffleArray(q.options).map(o => ({ ...o, optionText: stripOptionPrefix(o.optionText) })),
  }))
  phase.value = 'doing'
}

function toggleOption(questionId: string, optionId: string, type: string) {
  if (!selected.value.has(questionId)) {
    selected.value.set(questionId, new Set())
  }
  const s = selected.value.get(questionId)!
  if (type === 'single' || type === 'truefalse') {
    s.clear()
    s.add(optionId)
  } else {
    if (s.has(optionId)) s.delete(optionId)
    else s.add(optionId)
  }
}

function isSelected(questionId: string, optionId: string): boolean {
  return selected.value.get(questionId)?.has(optionId) ?? false
}

const answeredCount = computed(() =>
  props.quiz.questions.filter((q) => (selected.value.get(q.id)?.size ?? 0) > 0).length,
)
const allAnswered = computed(() => answeredCount.value === props.quiz.questions.length)

async function submit() {
  if (!allAnswered.value) return
  isSubmitting.value = true
  submitError.value = ''
  try {
    const answers = props.quiz.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: [...(selected.value.get(q.id) ?? [])],
    }))

    const attempt = await quizStore.submitAttempt({
      quizId: props.quiz.id,
      staffProfileId: props.staffProfileId,
      answers,
      quiz: props.quiz,
    })
    lastAttempt.value = attempt
    await loadHistory()
    showAnswers.value = true
    phase.value = 'result'
    if (attempt.passed) emit('passed', attempt)
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : '提交失敗'
  } finally {
    isSubmitting.value = false
  }
}

function scoreColor(score: number): string {
  if (score >= 85) return '#16a34a'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="quiz-player">
    <div class="quiz-title">
      <span class="icon">📝</span>
      <h3>{{ quiz.title }}</h3>
      <span class="pass-badge">通過分數：{{ quiz.passScore }}分</span>
    </div>

    <!-- ── 歷史紀錄頁 ── -->
    <template v-if="phase === 'history'">
      <div v-if="bestAttempt" class="best-result" :class="{ passed: bestAttempt.passed, failed: !bestAttempt.passed }">
        <div class="best-score">{{ bestAttempt.score }}</div>
        <div class="best-label">最佳分數</div>
        <div class="best-status">{{ bestAttempt.passed ? '✅ 已通過' : '❌ 未通過' }}</div>
      </div>

      <div v-if="history.length > 0" class="history-table">
        <div class="history-head">
          <span>次數</span><span>分數</span><span>結果</span><span>作答時間</span>
        </div>
        <div v-for="a in history" :key="a.id" class="history-row">
          <span>第 {{ a.attemptNo }} 次</span>
          <span :style="{ color: scoreColor(a.score), fontWeight: 700 }">{{ a.score }}</span>
          <span>{{ a.passed ? '通過' : '未通過' }}</span>
          <span>{{ formatDate(a.submittedAt) }}</span>
        </div>
      </div>

      <div v-else class="no-history">尚未作答</div>

      <button class="btn primary" @click="startQuiz">
        {{ history.length > 0 ? '重新作答' : '開始作答' }}
      </button>
    </template>

    <!-- ── 作答頁 ── -->
    <template v-else-if="phase === 'doing'">
      <div class="progress-bar-wrap">
        <div class="progress-bar" :style="{ width: (answeredCount / quiz.questions.length * 100) + '%' }" />
        <span class="progress-text">{{ answeredCount }} / {{ quiz.questions.length }}</span>
      </div>

      <div v-for="(q, qi) in displayQuestions" :key="q.id" class="question-block">
        <div class="question-head">
          <span class="q-no">Q{{ qi + 1 }}</span>
          <span class="q-type-badge">{{ q.questionType === 'single' ? '單選' : q.questionType === 'multiple' ? '多選' : '是非' }}</span>
          <span class="q-points">{{ q.points }}分</span>
        </div>
        <p class="question-text">{{ q.questionText }}</p>

        <div class="options-list">
          <label
            v-for="opt in q.options"
            :key="opt.id"
            class="option-label"
            :class="{ selected: isSelected(q.id, opt.id) }"
          >
            <input
              v-if="q.questionType === 'multiple'"
              type="checkbox"
              :checked="isSelected(q.id, opt.id)"
              @change="toggleOption(q.id, opt.id, q.questionType)"
            />
            <input
              v-else
              type="radio"
              :name="`q-${q.id}`"
              :checked="isSelected(q.id, opt.id)"
              @change="toggleOption(q.id, opt.id, q.questionType)"
            />
            {{ opt.optionText }}
          </label>
        </div>
      </div>

      <div v-if="submitError" class="error-msg">{{ submitError }}</div>

      <div class="doing-footer">
        <button class="btn secondary" @click="phase = 'history'">取消</button>
        <button
          class="btn primary"
          :disabled="!allAnswered || isSubmitting"
          @click="submit"
        >{{ isSubmitting ? '提交中…' : '提交作答' }}</button>
      </div>
    </template>

    <!-- ── 結果頁 ── -->
    <template v-else-if="phase === 'result' && lastAttempt">
      <div class="result-banner" :class="{ passed: lastAttempt.passed, failed: !lastAttempt.passed }">
        <div class="result-icon">{{ lastAttempt.passed ? '🎉' : '😅' }}</div>
        <div class="result-score">{{ lastAttempt.score }} 分</div>
        <div class="result-text">
          {{ lastAttempt.passed ? '恭喜通過！' : `差一點！通過分數為 ${quiz.passScore} 分` }}
        </div>
      </div>

      <!-- 逐題解析 -->
      <div v-if="showAnswers" class="answers-review">
        <h4>作答解析</h4>
        <div v-for="(q, qi) in quiz.questions" :key="q.id" class="review-question">
          <div class="review-head">
            <span class="q-no">Q{{ qi + 1 }}</span>
            <span v-if="q.options.some(o => o.isCorrect && selected.get(q.id)?.has(o.id)) && !q.options.some(o => !o.isCorrect && selected.get(q.id)?.has(o.id))" class="correct-badge">✓ 答對</span>
            <span v-else class="wrong-badge">✗ 答錯</span>
          </div>
          <p class="question-text">{{ q.questionText }}</p>
          <div class="options-list">
            <div
              v-for="opt in q.options"
              :key="opt.id"
              class="review-option"
              :class="{
                'opt-correct': opt.isCorrect,
                'opt-wrong': selected.get(q.id)?.has(opt.id) && !opt.isCorrect
              }"
            >
              <span class="opt-marker">
                {{ opt.isCorrect ? '✓' : (selected.get(q.id)?.has(opt.id) ? '✗' : '○') }}
              </span>
              {{ stripOptionPrefix(opt.optionText) }}
            </div>
          </div>
          <div v-if="q.explanation" class="explanation">💡 {{ q.explanation }}</div>
        </div>
      </div>

      <div class="result-footer">
        <button class="btn secondary" @click="phase = 'history'">查看作答紀錄</button>
        <button class="btn primary" @click="startQuiz">再作答一次</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quiz-player { display:flex; flex-direction:column; gap:1.25rem; }
.quiz-title { display:flex; align-items:center; gap:.6rem; }
.quiz-title h3 { flex:1; margin:0; font-size:1.1rem; color:#1f2937; }
.icon { font-size:1.2rem; }
.pass-badge { font-size:.78rem; background:#fef3c7; color:#92400e; border-radius:.4rem; padding:.2rem .5rem; }

/* best result */
.best-result { text-align:center; padding:1.2rem; border-radius:.75rem; }
.best-result.passed { background:#f0fdf4; border:1px solid #86efac; }
.best-result.failed { background:#fff7ed; border:1px solid #fed7aa; }
.best-score { font-size:2.5rem; font-weight:800; color:#1f2937; }
.best-label { font-size:.8rem; color:#6b7280; }
.best-status { margin-top:.3rem; font-size:.9rem; font-weight:600; }

/* history table */
.history-table { border:1px solid #e5e7eb; border-radius:.6rem; overflow:hidden; }
.history-head, .history-row { display:grid; grid-template-columns:1fr 1fr 1fr 2fr; padding:.5rem .9rem; font-size:.85rem; }
.history-head { background:#f9fafb; font-weight:600; color:#6b7280; }
.history-row { border-top:1px solid #f3f4f6; }
.no-history { text-align:center; padding:1.5rem; color:#9ca3af; font-size:.9rem; }

/* progress */
.progress-bar-wrap { position:relative; height:.5rem; background:#e5e7eb; border-radius:1rem; }
.progress-bar { height:100%; background:#f59e0b; border-radius:1rem; transition:width .2s; }
.progress-text { position:absolute; right:0; top:-.2rem; font-size:.75rem; color:#6b7280; transform:translateY(-100%); }

/* question */
.question-block { background:#fff; border:1px solid #e5e7eb; border-radius:.75rem; padding:1rem; color:#1f2937; }
.question-head { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
.q-no { font-weight:700; color:#b45309; font-size:.9rem; }
.q-type-badge { font-size:.72rem; background:#f3f4f6; color:#6b7280; border-radius:.4rem; padding:.15rem .4rem; }
.q-points { font-size:.75rem; color:#9ca3af; margin-left:auto; }
.question-text { margin:.25rem 0 .75rem; font-size:.95rem; color:#1f2937; }

/* options */
.options-list { display:flex; flex-direction:column; gap:.45rem; }
.option-label {
  display:flex; align-items:center; gap:.5rem; padding:.5rem .75rem;
  border:1px solid #e5e7eb; border-radius:.5rem; cursor:pointer; font-size:.9rem;
  color:#1f2937;
  transition:border-color .15s, background .15s;
}
.option-label:hover { border-color:#f59e0b; background:#fffbeb; color:#1f2937; }
.option-label.selected { border-color:#f59e0b; background:#fef3c7; color:#92400e; }

/* doing footer */
.doing-footer { display:flex; justify-content:flex-end; gap:.75rem; }

/* result */
.result-banner { text-align:center; padding:1.75rem; border-radius:.9rem; }
.result-banner.passed { background:linear-gradient(135deg,#f0fdf4,#dcfce7); border:1px solid #86efac; }
.result-banner.failed { background:linear-gradient(135deg,#fff7ed,#fef3c7); border:1px solid #fed7aa; }
.result-icon { font-size:2.5rem; }
.result-score { font-size:3rem; font-weight:900; color:#1f2937; }
.result-text { font-size:1rem; color:#374151; margin-top:.25rem; }

/* review */
.answers-review h4 { font-size:.95rem; color:#374151; margin:0 0 .75rem; }
.review-question { background:#fff; border:1px solid #e5e7eb; border-radius:.7rem; padding:.9rem; margin-bottom:.7rem; }
.review-head { display:flex; align-items:center; gap:.5rem; margin-bottom:.4rem; }
.correct-badge { font-size:.8rem; color:#16a34a; font-weight:600; }
.wrong-badge { font-size:.8rem; color:#dc2626; font-weight:600; }
.review-option { display:flex; align-items:center; gap:.5rem; padding:.4rem .6rem; border-radius:.4rem; font-size:.88rem; margin:.2rem 0; }
.opt-correct { background:#f0fdf4; color:#15803d; }
.opt-wrong { background:#fef2f2; color:#b91c1c; }
.opt-marker { font-weight:700; width:1rem; }
.explanation { margin-top:.6rem; padding:.5rem .75rem; background:#fefce8; border-left:3px solid #fbbf24; font-size:.85rem; color:#78350f; border-radius:0 .4rem .4rem 0; }

.result-footer { display:flex; justify-content:flex-end; gap:.75rem; }
.btn { padding:.5rem 1.25rem; border-radius:.5rem; border:none; cursor:pointer; font-size:.9rem; font-weight:600; }
.btn.primary { background:#f59e0b; color:#fff; }
.btn.primary:hover:not(:disabled) { background:#d97706; }
.btn.primary:disabled { opacity:.55; cursor:not-allowed; }
.btn.secondary { background:#f3f4f6; color:#374151; }
.btn.secondary:hover { background:#e5e7eb; }
.error-msg { background:#fef2f2; border:1px solid #fecaca; border-radius:.5rem; padding:.5rem .75rem; font-size:.85rem; color:#b91c1c; }
</style>
