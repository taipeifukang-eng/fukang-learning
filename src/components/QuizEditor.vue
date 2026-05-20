<script setup lang="ts">
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'
import type { Quiz, QuestionType } from '../data/mockData'
import { useQuizStore } from '../stores/quiz'
import { useAuthStore } from '../stores/auth'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  lessonId: string
  lessonTitle: string
}>()

const emit = defineEmits<{
  saved: [quiz: Quiz]
  cancelled: []
}>()

const quizStore = useQuizStore()
const auth = useAuthStore()

// ── 本地表單狀態 ─────────────────────────────────────────────
const title = ref('課後測驗')
const passScore = ref(85)
const isSaving = ref(false)
const saveError = ref('')
const isLoading = ref(true)

interface LocalOption { id: string; optionText: string; isCorrect: boolean }
interface LocalQuestion {
  id: string
  sortOrder: number
  questionText: string
  questionType: QuestionType
  points: number
  explanation: string
  options: LocalOption[]
}

const questions = ref<LocalQuestion[]>([])

function newOption(): LocalOption {
  return { id: crypto.randomUUID(), optionText: '', isCorrect: false }
}
function newQuestion(): LocalQuestion {
  return {
    id: crypto.randomUUID(),
    sortOrder: questions.value.length,
    questionText: '',
    questionType: 'single',
    points: 10,
    explanation: '',
    options: [newOption(), newOption()],
  }
}

// ── 載入既有測驗 ─────────────────────────────────────────────
async function loadExisting() {
  isLoading.value = true
  try {
    const existing = await quizStore.fetchQuizForEdit(props.lessonId)
    if (existing) {
      title.value = existing.title
      passScore.value = existing.passScore
      questions.value = existing.questions.map((q) => ({
        id: q.id,
        sortOrder: q.sortOrder,
        questionText: q.questionText,
        questionType: q.questionType,
        points: q.points,
        explanation: q.explanation,
        options: q.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
        })),
      }))
    } else {
      questions.value = [newQuestion()]
    }
  } finally {
    isLoading.value = false
  }
}

loadExisting()

// ── 題型切換時重設選項 ───────────────────────────────────────
function onTypeChange(q: LocalQuestion) {
  if (q.questionType === 'truefalse') {
    q.options = [
      { id: crypto.randomUUID(), optionText: '是', isCorrect: true },
      { id: crypto.randomUUID(), optionText: '否', isCorrect: false },
    ]
  } else if (q.options.length < 2) {
    q.options = [newOption(), newOption()]
  }
}

function addOption(q: LocalQuestion) { q.options.push(newOption()) }
function removeOption(q: LocalQuestion, idx: number) {
  if (q.options.length <= 2) return
  q.options.splice(idx, 1)
}
function addQuestion() { questions.value.push(newQuestion()) }
function removeQuestion(idx: number) {
  if (questions.value.length <= 1) return
  questions.value.splice(idx, 1)
}
function moveQuestion(idx: number, dir: -1 | 1) {
  const target = idx + dir
  if (target < 0 || target >= questions.value.length) return
  const arr = questions.value
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
}

// 單選題選項互斥
function selectSingle(q: LocalQuestion, optIdx: number) {
  q.options.forEach((opt, i) => { opt.isCorrect = (i === optIdx) })
}

function toggleMultipleCorrect(q: LocalQuestion, optIdx: number) {
  q.options[optIdx].isCorrect = !q.options[optIdx].isCorrect
}

const totalPoints = computed(() => questions.value.reduce((sum, q) => sum + q.points, 0))

// ── Excel 範本下載（簡易格式：A欄=題目含選項, B欄=答案） ───────
function downloadTemplate() {
  const rows = [
    ['題目（含選項，格式：題目文字(A)選項1(B)選項2(C)選項3(D)選項4）', '正確答案（例：(B) 店長或負責藥師）'],
    ['管制藥品電子簿冊系統中，哪些角色通常擁有「年度總表」內的完整操作權限？(A) 實習藥師與助理(B) 店長或負責藥師(C) 僅限吳經理(D) 所有在職員工', '(B) 店長或負責藥師'],
    ['在年度總表中，「產生申報檔」功能的主要用途是什麼？(A) 產生年度結存申報所需的CMIS上傳批次檔(B) 下載門市全年度的新資報表(C) 產生每日藥品銷售清單(D) 匯出給供應商的訂購單', '(A) 產生年度結存申報所需的CMIS上傳批次檔'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 80 }, { wch: 30 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '測驗題目')
  XLSX.writeFile(wb, '課後測驗範本（簡易格式）.xlsx')
}

// ── 解析簡易格式（A欄=題目含選項, B欄=答案） ───────────────
function parseSimpleFormat(rows: string[][]): LocalQuestion[] | null {
  // 偵測：第一欄包含 (A)...(B)... 格式
  const dataRows = rows.filter(r => String(r[0] ?? '').includes('(A)') && String(r[0] ?? '').includes('(B)'))
  if (dataRows.length === 0) return null

  const result: LocalQuestion[] = []
  for (const row of dataRows) {
    const raw = String(row[0] ?? '').trim()
    const answerRaw = String(row[1] ?? '').trim()
    if (!raw) continue

    // 分割題目和選項：在 (A)(B)(C)(D)(E) 位置切割
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']
    // 建立正則，找到第一個 (A) 的位置
    const firstOptMatch = raw.match(/\(A\)/)
    if (!firstOptMatch) continue

    const firstOptIdx = raw.indexOf('(A)')
    const questionText = raw.slice(0, firstOptIdx).trim()
    const optionsPart = raw.slice(firstOptIdx)

    // 用正則把選項切出來：(A)文字(B)文字...
    const optionRegex = /\(([A-F])\)(.*?)(?=\([A-F]\)|$)/gs
    const options: { label: string; text: string }[] = []
    let m
    const regex = new RegExp(/\(([A-F])\)(.*?)(?=\([A-F]\)|$)/gs)
    while ((m = regex.exec(optionsPart)) !== null) {
      options.push({ label: m[1], text: m[2].trim() })
    }

    if (options.length < 2) continue

    // 解析正確答案：取括號內的字母，例如 "(B) 店長..." → "B"
    const answerLabelMatch = answerRaw.match(/\(([A-F])\)/)
    const answerLabel = answerLabelMatch ? answerLabelMatch[1] : ''

    result.push({
      id: crypto.randomUUID(),
      sortOrder: result.length,
      questionText,
      questionType: 'single',
      points: 10,
      explanation: '',
      options: options.map(opt => ({
        id: crypto.randomUUID(),
        optionText: `(${opt.label}) ${opt.text}`,
        isCorrect: opt.label === answerLabel,
      })),
    })
  }
  return result.length > 0 ? result : null
}

// ── Excel 匯入 ────────────────────────────────────────────────
const importError = ref('')
const importSuccess = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerImport() {
  importError.value = ''
  importSuccess.value = ''
  fileInputRef.value?.click()
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]

      // 先嘗試簡易格式（A欄=題目含選項, B欄=答案）
      const simpleResult = parseSimpleFormat(rows)
      if (simpleResult) {
        questions.value = simpleResult
        importSuccess.value = `成功匯入 ${simpleResult.length} 題，請確認內容後再儲存`
        return
      }

      // 舊格式（標題行模式）
      const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()))
      if (dataRows.length === 0) {
        importError.value = 'Excel 沒有資料，請使用範本格式'
        return
      }

      const qMap = new Map<string, LocalQuestion>()
      const qOrder: string[] = []

      for (const row of dataRows) {
        const [qno, qtext, qtype, pts, expl, optText, isCorr] = row.map(c => String(c).trim())
        if (!qno) continue
        const key = qno.toUpperCase()

        if (!qMap.has(key)) {
          const typeMap: Record<string, QuestionType> = {
            single: 'single', multiple: 'multiple', truefalse: 'truefalse',
          }
          const resolvedType: QuestionType = typeMap[qtype?.toLowerCase()] ?? 'single'
          qMap.set(key, {
            id: crypto.randomUUID(),
            sortOrder: qOrder.length,
            questionText: qtext,
            questionType: resolvedType,
            points: pts ? Number(pts) : 10,
            explanation: expl || '',
            options: [],
          })
          qOrder.push(key)
        }

        if (optText) {
          qMap.get(key)!.options.push({
            id: crypto.randomUUID(),
            optionText: optText,
            isCorrect: isCorr === '是' || isCorr.toLowerCase() === 'true' || isCorr === '1',
          })
        }
      }

      const parsed = qOrder.map(k => qMap.get(k)!)
      for (const q of parsed) {
        if (!q.questionText) { importError.value = `題目 ${qOrder[parsed.indexOf(q)]} 缺少題目內容`; return }
        if (q.options.length < 2) { importError.value = `題目「${q.questionText.slice(0, 10)}」選項數不足 2 個`; return }
        const correctCount = q.options.filter(o => o.isCorrect).length
        if ((q.questionType === 'single' || q.questionType === 'truefalse') && correctCount !== 1) {
          importError.value = `題目「${q.questionText.slice(0, 10)}」單選/是非題需正好 1 個正確答案`; return
        }
        if (q.questionType === 'multiple' && correctCount < 1) {
          importError.value = `題目「${q.questionText.slice(0, 10)}」多選題至少需 1 個正確答案`; return
        }
      }

      questions.value = parsed
      importSuccess.value = `成功匯入 ${parsed.length} 題，請確認內容後再儲存`
    } catch {
      importError.value = 'Excel 解析失敗，請確認檔案格式'
    } finally {
      if (fileInputRef.value) fileInputRef.value.value = ''
    }
  }
  reader.readAsArrayBuffer(file)
}

// ── 儲存 ─────────────────────────────────────────────────────
async function save() {
  // 驗證
  for (const q of questions.value) {
    if (!q.questionText.trim()) { saveError.value = '有題目尚未填寫題目內容'; return }
    if (q.options.some((opt) => !opt.optionText.trim())) { saveError.value = '有選項尚未填寫'; return }

    const correctCount = q.options.filter((opt) => opt.isCorrect).length
    if (q.questionType === 'single' || q.questionType === 'truefalse') {
      if (correctCount !== 1) {
        saveError.value = `題目「${q.questionText || '未命名題目'}」需設定且僅設定 1 個正確答案`
        return
      }
    } else if (correctCount < 1) {
      saveError.value = `題目「${q.questionText || '未命名題目'}」至少需設定 1 個正確答案`
      return
    }
  }

  isSaving.value = true
  saveError.value = ''
  try {
    const quiz = await quizStore.saveQuiz({
      lessonId: props.lessonId,
      title: title.value,
      passScore: passScore.value,
      questions: questions.value.map((q, i) => ({
        sortOrder: i,
        questionText: q.questionText,
        questionType: q.questionType,
        points: q.points,
        explanation: q.explanation,
        options: q.options.map((opt, j) => ({
          sortOrder: j,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
        })),
      })),
    })
    emit('saved', quiz)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '儲存失敗'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="quiz-editor">
    <div class="editor-header">
      <h2>
        <AppIcon name="edit" />
        課後測驗編輯
      </h2>
      <p class="lesson-label">課程：{{ lessonTitle }}</p>
    </div>

    <div v-if="isLoading" class="loading-state">載入中…</div>

    <template v-else>
      <!-- 基本設定 -->
      <div class="section-card">
        <h3>基本設定</h3>
        <div class="form-row">
          <label>測驗標題</label>
          <input v-model="title" class="input" />
        </div>
        <div class="form-row">
          <label>通過分數（滿分 100）</label>
          <input v-model.number="passScore" type="number" min="1" max="100" class="input input-sm" />
        </div>
        <div class="total-points">題目總分：<strong>{{ totalPoints }}</strong> 分</div>
      </div>

      <!-- 題目列表 -->
      <div v-for="(q, qi) in questions" :key="q.id" class="question-card">
        <div class="question-header">
          <span class="q-index">Q{{ qi + 1 }}</span>
          <div class="question-meta">
            <select v-model="q.questionType" class="input input-sm" @change="onTypeChange(q)">
              <option value="single">單選題</option>
              <option value="multiple">多選題</option>
              <option value="truefalse">是非題</option>
            </select>
            <div class="points-input">
              <input v-model.number="q.points" type="number" min="1" class="input input-sm" style="width:60px" />
              <span>分</span>
            </div>
          </div>
          <div class="question-actions">
            <button class="btn-icon" :disabled="qi === 0" title="上移" @click="moveQuestion(qi, -1)">▲</button>
            <button class="btn-icon" :disabled="qi === questions.length - 1" title="下移" @click="moveQuestion(qi, 1)">▼</button>
            <button class="btn-icon danger" title="刪除題目" @click="removeQuestion(qi)">✕</button>
          </div>
        </div>

        <textarea v-model="q.questionText" class="input textarea" placeholder="請輸入題目…" rows="2" />

        <!-- 選項 -->
        <div class="options-list">
          <div v-for="(opt, oi) in q.options" :key="opt.id" class="option-row">
            <template v-if="q.questionType === 'single' || q.questionType === 'truefalse'">
              <input
                type="radio"
                :name="`q-${q.id}`"
                :checked="opt.isCorrect"
                @change="selectSingle(q, oi)"
              />
              <button
                class="answer-btn"
                :class="{ 'is-correct': opt.isCorrect }"
                type="button"
                @click="selectSingle(q, oi)"
              >
                {{ opt.isCorrect ? '正確答案' : '設為正解' }}
              </button>
            </template>
            <template v-else>
              <input type="checkbox" :checked="opt.isCorrect" @change="toggleMultipleCorrect(q, oi)" />
              <button
                class="answer-btn"
                :class="{ 'is-correct': opt.isCorrect }"
                type="button"
                @click="toggleMultipleCorrect(q, oi)"
              >
                {{ opt.isCorrect ? '正確答案' : '設為正解' }}
              </button>
            </template>
            <input v-model="opt.optionText" class="input option-input" :disabled="q.questionType === 'truefalse'" placeholder="選項文字…" />
            <button
              v-if="q.questionType !== 'truefalse'"
              class="btn-icon danger"
              :disabled="q.options.length <= 2"
              @click="removeOption(q, oi)"
            >✕</button>
          </div>
        </div>

        <button v-if="q.questionType !== 'truefalse'" class="btn-add-opt" @click="addOption(q)">
          + 新增選項
        </button>

        <div class="explanation-row">
          <label>解析說明（作答後顯示，可留空）</label>
          <textarea v-model="q.explanation" class="input textarea" rows="2" placeholder="解析文字…" />
        </div>
      </div>

      <button class="btn-add-question" @click="addQuestion">+ 新增題目</button>

      <!-- Excel 匯入區塊 -->
      <div class="excel-import-bar">
        <input ref="fileInputRef" type="file" accept=".xlsx,.xls" style="display:none" @change="onFileChange" />
        <button class="btn-excel" @click="downloadTemplate">⬇ 下載 Excel 範本</button>
        <button class="btn-excel import" @click="triggerImport">↑ 匯入 Excel</button>
        <span v-if="importSuccess" class="import-ok">✓ {{ importSuccess }}</span>
        <span v-if="importError" class="import-err">⚠ {{ importError }}</span>
      </div>

      <div v-if="saveError" class="error-msg">{{ saveError }}</div>

      <div class="editor-footer">
        <button class="btn secondary" @click="emit('cancelled')">取消</button>
        <button class="btn primary" :disabled="isSaving" @click="save">
          {{ isSaving ? '儲存中…' : '儲存測驗' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quiz-editor { display:flex; flex-direction:column; gap:1.2rem; }
.editor-header h2 { display:flex; align-items:center; gap:.4rem; font-size:1.2rem; color:#b45309; margin:0; }
.lesson-label { margin:.25rem 0 0; font-size:.85rem; color:#6b7280; }
.section-card, .question-card {
  background:#fff; border:1px solid #e5e7eb; border-radius:.75rem; padding:1.25rem; display:flex; flex-direction:column; gap:.75rem;
}
.section-card h3 { margin:0; font-size:.95rem; font-weight:600; color:#374151; }
.form-row { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
.form-row label { font-size:.85rem; color:#6b7280; min-width:140px; }
.total-points { font-size:.85rem; color:#6b7280; }
.question-header { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
.q-index { font-size:.85rem; font-weight:700; color:#b45309; min-width:2rem; }
.question-meta { display:flex; align-items:center; gap:.5rem; flex:1; }
.points-input { display:flex; align-items:center; gap:.25rem; font-size:.85rem; color:#6b7280; }
.question-actions { display:flex; gap:.25rem; margin-left:auto; }
.options-list { display:flex; flex-direction:column; gap:.5rem; }
.option-row { display:flex; align-items:center; gap:.5rem; }
.option-input { flex:1; }
.answer-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #6b7280;
  border-radius: .45rem;
  font-size: .75rem;
  padding: .2rem .45rem;
  cursor: pointer;
  white-space: nowrap;
}
.answer-btn:hover { border-color:#f59e0b; color:#b45309; }
.answer-btn.is-correct {
  border-color:#16a34a;
  background:#f0fdf4;
  color:#15803d;
  font-weight:600;
}
.explanation-row { display:flex; flex-direction:column; gap:.25rem; }
.explanation-row label { font-size:.8rem; color:#9ca3af; }
.btn-add-opt { align-self:flex-start; background:none; border:1px dashed #d1d5db; border-radius:.5rem; padding:.3rem .75rem; font-size:.82rem; color:#6b7280; cursor:pointer; }
.btn-add-opt:hover { border-color:#f59e0b; color:#b45309; }
.btn-add-question { background:none; border:2px dashed #f59e0b; border-radius:.75rem; padding:.6rem 1.25rem; font-size:.9rem; color:#b45309; cursor:pointer; font-weight:600; }
.btn-add-question:hover { background:#fffbeb; }
.excel-import-bar { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; padding:.75rem 1rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:.65rem; }
.btn-excel { border:1px solid #d1d5db; background:#fff; color:#374151; border-radius:.45rem; padding:.35rem .9rem; font-size:.82rem; cursor:pointer; font-weight:500; }
.btn-excel:hover { border-color:#f59e0b; color:#b45309; }
.btn-excel.import { background:#f59e0b; border-color:#f59e0b; color:#fff; }
.btn-excel.import:hover { background:#d97706; }
.import-ok { font-size:.82rem; color:#16a34a; font-weight:600; }
.import-err { font-size:.82rem; color:#dc2626; font-weight:600; }
.editor-footer { display:flex; justify-content:flex-end; gap:.75rem; padding-top:.5rem; }
.input { border:1px solid #e5e7eb; border-radius:.5rem; padding:.4rem .7rem; font-size:.9rem; width:100%; }
.input:focus { outline:none; border-color:#f59e0b; box-shadow:0 0 0 2px rgba(245,158,11,.15); }
.input-sm { width:auto; }
.textarea { resize:vertical; min-height:60px; }
.btn { padding:.5rem 1.25rem; border-radius:.5rem; border:none; cursor:pointer; font-size:.9rem; font-weight:600; }
.btn.primary { background:#f59e0b; color:#fff; }
.btn.primary:hover:not(:disabled) { background:#d97706; }
.btn.primary:disabled { opacity:.55; cursor:not-allowed; }
.btn.secondary { background:#f3f4f6; color:#374151; }
.btn.secondary:hover { background:#e5e7eb; }
.btn-icon { background:none; border:1px solid #e5e7eb; border-radius:.35rem; padding:.2rem .4rem; cursor:pointer; font-size:.8rem; color:#6b7280; }
.btn-icon:hover:not(:disabled) { border-color:#f59e0b; color:#b45309; }
.btn-icon.danger:hover:not(:disabled) { border-color:#ef4444; color:#ef4444; }
.btn-icon:disabled { opacity:.4; cursor:not-allowed; }
.error-msg { background:#fef2f2; border:1px solid #fecaca; border-radius:.5rem; padding:.6rem .9rem; font-size:.85rem; color:#b91c1c; }
.loading-state { text-align:center; padding:2rem; color:#9ca3af; }
</style>
