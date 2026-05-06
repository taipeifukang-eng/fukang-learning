# 富康中學學習平台 (FK-Learning)

> 採用 **LINE Login**、**Supabase**、**Bunny Stream** 的校園學習系統

## 🚀 快速開始

### 開發環境
```bash
npm install
npm run dev
```

開啟 http://localhost:5173

### 生產構建
```bash
npm run build
npm run preview
```

---

## 📋 部署檢查清單

**⚠️ 重要**: 完整部署前，請依序完成以下步驟：

1. **[LINE Channel Secret 複製](LINE_CHANNEL_SECRET_GUIDE.md)** ← 2 分鐘
2. **[Edge Function 環境變數設定](EDGE_FUNCTION_SECRETS.md)** ← 2 分鐘  
3. **[SQL 初始化](DEPLOYMENT.md#步驟-1sql-editor-執行初始化腳本)** ← 5 分鐘
4. **[測試登入流程](CHECKLIST.md#-步驟-4測試-line-login-流程)** ← 10 分鐘

👉 **完整檢查清單**: [CHECKLIST.md](CHECKLIST.md)

---

## 📚 文件

| 文件 | 用途 |
|---|---|
| [CHECKLIST.md](CHECKLIST.md) | 完整部署檢查清單（包含待辦事項） |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 部署步驟總覽 |
| [EDGE_FUNCTION_SECRETS.md](EDGE_FUNCTION_SECRETS.md) | Edge Function 環境變數設定指南 |
| [LINE_CHANNEL_SECRET_GUIDE.md](LINE_CHANNEL_SECRET_GUIDE.md) | LINE Channel Secret 複製指南 |

---

## 🏗️ 技術堆棧

### 前端
- **框架**: Vue 3.5 + TypeScript
- **構建**: Vite 8
- **狀態管理**: Pinia
- **路由**: Vue Router
- **UI 框架**: 自訂 Admin Layout（warm amber 主題）

### 後端 / 基礎設施
- **資料庫**: Supabase PostgreSQL
- **認證**: LINE Login OAuth 2.0 + Supabase Auth
- **Edge Computing**: Supabase Edge Functions (Deno)
- **影片託管**: Bunny.net Stream
- **RLS**: Supabase Row Level Security

---

## 📁 專案結構

```
src/
├── components/          # 共用元件
│   └── AppIcon.vue
├── layouts/
│   └── AdminLayout.vue  # 管理殼層
├── lib/
│   ├── config.ts        # 環境變數
│   └── supabase.ts      # DB 客戶端
├── router/
│   └── index.ts         # 路由定義
├── stores/
│   ├── auth.ts          # 認證狀態
│   ├── catalog.ts       # 課程管理
│   └── ui.ts            # UI 狀態
├── views/               # 頁面
│   ├── LoginView.vue
│   ├── LineCallbackView.vue
│   ├── DashboardView.vue
│   ├── StaffView.vue
│   ├── RolesView.vue
│   ├── CoursesView.vue
│   ├── LearningHomeView.vue
│   ├── CoursePlayerView.vue
│   └── ForbiddenView.vue
├── data/
│   └── mockData.ts
├── types/
│   └── route-meta.d.ts
├── App.vue
├── main.ts
└── style.css

supabase/
├── schema.sql
├── policies_v2.sql
├── seed.sql
└── functions/line-callback/index.ts
```

---

## 🔐 環境變數

### 本地開發 (.env)
```env
VITE_SUPABASE_URL=https://vesglrsuvcsamakbcsdr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_LINE_CLIENT_ID=2009779886
VITE_LINE_REDIRECT_URI=http://localhost:5173/auth/line/callback
VITE_BUNNY_CDN_PREFIX=
```

---

## 🧪 本地測試

```bash
npm run dev
```

進入 http://localhost:5173，點「示範：系統管理員」快速測試，或點「使用 LINE 登入」進行完整 OAuth 流程。

---

## 🚢 部署

```bash
npm run build  # 確保無編譯錯誤
# dist/ 可用 Vercel/Netlify 靜態託管
```

---

## 📝 技術細節

### LINE Login 流程
1. 使用者點「使用 LINE 登入」
2. 跳轉到 LINE OAuth 授權頁
3. 授權後返回 callback URL，攜帶 `code` 和 `state`
4. 前端驗證 `state` CSRF 令牌
5. 呼叫 Supabase Edge Function `line-callback`
6. Edge Function 用 `code` 向 LINE 交換 token
7. 取得 LINE 個人資料 + 建立/查詢 staff_profiles
8. 建立 Supabase session + 回傳給前端
9. 前端儲存 session，頁面重整後自動恢復

### RBAC（角色型存取控制）
- 4 個角色：super_admin、content_admin、teacher、student
- 8 個權限：dashboard:view、staff:view、courses:edit 等
- Supabase RLS：每張表都有政策限制存取
- `is_admin()` helper function：判斷使用者是否為管理角色

---

## 🔗 相關連結

- [Supabase Dashboard](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr)
- [LINE Developers](https://developers.line.biz/console/)
- 本地開發: http://localhost:5173
