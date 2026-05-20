import { getBunnyEmbedUrl } from '../lib/config'

export type RoleKey = 'super_admin' | 'content_admin' | 'teacher' | 'student'

export type OrgType = 'store' | 'headquarters'
export interface Organization {
  id: number
  code: string
  name: string
  shortName: string
  type: OrgType
  supervisor: string
  manager: string
  enabled: boolean
}

export type PermissionKey =
  | 'dashboard:view'
  | 'staff:view'
  | 'staff:toggle'
  | 'staff:assign_role'
  | 'staff:assign_org'
  | 'roles:view'
  | 'roles:assign'
  | 'courses:view'
  | 'courses:edit'
  | 'quiz:edit'
  | 'quiz:attempt'
  | 'learning:view'
  | 'orgs:view'
  | 'orgs:edit'
  | 'categories:edit'
  | 'progress:view'
  | 'team_progress:view'

export interface StaffMember {
  id: string
  name: string
  employeeNo: string
  role: RoleKey
  roles: Array<{ id: number; key: string; title: string }>
  orgId: number | null
  orgCode: string
  orgShortName: string
  department: string
  lineUserId: string
  email: string
  enabled: boolean
  lastLoginAt: string
}

export interface RoleDefinition {
  key: RoleKey
  title: string
  description: string
  permissions: PermissionKey[]
}

export interface Category {
  id: number
  name: string
  sortOrder: number
  enabled: boolean
}

export type AudienceType = 'all' | 'org' | 'role'

export interface CourseAudience {
  id: number
  courseId: string
  audienceType: AudienceType
  audienceId: number | null
}

export interface Lesson {
  id: string
  courseId: string
  title: string
  summary: string
  durationSeconds: number
  sortOrder: number
  provider: 'bunny'
  bunnyVideoId: string
  coverUrl: string
}

export interface Course {
  id: string
  title: string
  categoryId: number | null
  categoryName: string
  description: string
  enabled: boolean
  coverUrl: string
  portalSections: string[]   // e.g. ['store-newcomer', 'store-general']
  audiences: CourseAudience[]
  lessons: Lesson[]
}

export interface LearningProgress {
  staffProfileId: string
  lessonId: string
  watchedSeconds: number
  durationSeconds: number
  completedAt: string | null
}

export const roleDefinitions: RoleDefinition[] = [
  {
    key: 'super_admin',
    title: '系統管理員',
    description: '管理整體平台設定、權限、人員與課程內容。',
    permissions: [
      'dashboard:view',
      'staff:view',
      'staff:toggle',
      'staff:assign_role',
      'staff:assign_org',
      'roles:view',
      'roles:assign',
      'courses:view',
      'courses:edit',
      'quiz:edit',
      'quiz:attempt',
      'learning:view',
      'orgs:view',
      'orgs:edit',
      'categories:edit',
      'progress:view',
      'team_progress:view',
    ],
  },
  {
    key: 'content_admin',
    title: '內容管理員',
    description: '維護課程與影片清單，但不處理角色指派。',
    permissions: ['dashboard:view', 'courses:view', 'courses:edit', 'quiz:edit', 'quiz:attempt', 'learning:view', 'categories:edit', 'progress:view', 'team_progress:view'],
  },
  {
    key: 'teacher',
    title: '教師',
    description: '查看課程內容與學生學習進度。',
    permissions: ['dashboard:view', 'courses:view', 'quiz:edit', 'quiz:attempt', 'learning:view', 'team_progress:view'],
  },
  {
    key: 'student',
    title: '學生',
    description: '只可進入學習專區播放影片與查看自己的進度。',
    permissions: ['learning:view', 'quiz:attempt'],
  },
]

export const staffSeed: StaffMember[] = [
  {
    id: 'staff-001',
    name: '陳主任',
    employeeNo: 'A001',
    role: 'super_admin',
    roles: [{ id: 1, key: 'super_admin', title: '系統管理員' }],
    orgId: 1,
    orgCode: 'HQ',
    orgShortName: '總部',
    department: '教務處',
    lineUserId: 'line-admin-001',
    email: 'director@fukang.edu.tw',
    enabled: true,
    lastLoginAt: '2026-05-02 21:10',
  },
  {
    id: 'staff-002',
    name: '林老師',
    employeeNo: 'T001',
    role: 'teacher',
    roles: [{ id: 3, key: 'teacher', title: '教師' }],
    orgId: 2,
    orgCode: 'TC',
    orgShortName: '台中店',
    department: '資訊組',
    lineUserId: 'line-teacher-001',
    email: 'lin.teacher@fukang.edu.tw',
    enabled: true,
    lastLoginAt: '2026-05-03 07:45',
  },
  {
    id: 'staff-003',
    name: '吳助理',
    employeeNo: 'C001',
    role: 'content_admin',
    roles: [{ id: 2, key: 'content_admin', title: '內容管理員' }],
    orgId: null,
    orgCode: '',
    orgShortName: '',
    department: '教學支援',
    lineUserId: 'line-content-001',
    email: 'wu.support@fukang.edu.tw',
    enabled: false,
    lastLoginAt: '2026-04-29 16:22',
  },
]

export const courseSeed: Course[] = []

export const progressSeed: LearningProgress[] = []

// ── 課後測驗型別 ──────────────────────────────────────────────

export type QuestionType = 'single' | 'multiple' | 'truefalse'

export interface QuizOption {
  id: string
  questionId: string
  sortOrder: number
  optionText: string
  isCorrect: boolean
}

export interface QuizQuestion {
  id: string
  quizId: string
  sortOrder: number
  questionText: string
  questionType: QuestionType
  points: number
  explanation: string
  options: QuizOption[]
}

export interface Quiz {
  id: string
  lessonId: string
  title: string
  passScore: number
  enabled: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  questions: QuizQuestion[]
}

export interface QuizAttempt {
  id: string
  quizId: string
  staffProfileId: string
  attemptNo: number
  score: number
  passed: boolean
  startedAt: string
  submittedAt: string | null
}

export interface QuizAnswer {
  id: string
  attemptId: string
  questionId: string
  selectedOptionIds: string[]
  isCorrect: boolean
}

// ── 個人學習統計型別 ──────────────────────────────────────────

export interface LearningStats {
  totalLessons: number
  completedLessons: number
  completionRate: number          // 0-100
  passedQuizzes: number
  pendingQuizzes: number
  failedQuizzes: number
  inProgressLessons: number
  notStartedLessons: number
  courseStats: CourseLearningStatus[]
}

export interface CourseLearningStatus {
  courseId: string
  courseTitle: string
  coverUrl: string
  totalLessons: number
  completedLessons: number
  completionRate: number
  quizPassed: boolean | null      // null = 無測驗
  bestScore: number | null
  attemptCount: number
  lastActivityAt: string | null
  status: 'completed' | 'in_progress' | 'not_started' | 'quiz_pending' | 'quiz_failed'
}

export function getRoleDefinition(role: RoleKey) {
  return roleDefinitions.find((item) => item.key === role) ?? roleDefinitions[3]
}

export function getLessonEmbedUrl(videoId: string) {
  return getBunnyEmbedUrl(videoId)
}