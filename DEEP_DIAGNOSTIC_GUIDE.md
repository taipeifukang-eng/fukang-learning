# 🔬 深層診斷 — 如果 create_user_failed 仍持續

**已嘗試過的所有修復都失敗了，可能是更基礎的問題。**

---

## 可能的根本原因分析

### 1️⃣ Service Role Key 根本無法工作
**症狀**: 無論如何修改都是 `create_user_failed`
**原因**: Service Role Key 可能已過期或損毀
**解決**:
- 進 Supabase Dashboard → Settings → API
- 點「Disable JWT-based API keys」下的按鈕重新生成 Service Role Key
- 複製新的 Key
- 回 Edge Function → Secrets → 刪除舊的 SERVICE_ROLE_KEY
- 添加新的 SERVICE_ROLE_KEY
- 重新部署 Edge Function

### 2️⃣ 郵箱格式問題
**症狀**: createUser() 因為 email 格式失敗
**原因**: `line_*@line.local` 可能不是有效的郵箱格式
**臨時解決** (在 index.ts 中):
```typescript
// 改這一行
const fakeEmail = `line_${lineProfile.userId}@line.local`

// 改成
const fakeEmail = `user_${lineProfile.userId}@localhost`
```
然後重新部署

### 3️⃣ Supabase Auth 權限不足
**症狀**: Edge Function 的 service role 在 Auth 部分沒有權限
**解決**:
- 進 Supabase Dashboard → Settings → Roles and Permissions
- 確認 service_role 角色有 "Execute" 權限在 auth schema 上

### 4️⃣ 用戶已存在但被停用
**症狀**: 第二次登入時還是 `create_user_failed`
**解決**:
- 進 Supabase Dashboard → Table Editor → staff_profiles
- 查看是否存在該用戶的紀錄
- 檢查 `enabled` 欄位是否為 `false`

---

## 最後的終極方案 — 繞過 Edge Function

如果 Edge Function 真的無法工作，可以改用**前端直接呼叫 Supabase Auth** 的方式：

1. 在前端 auth store 中直接使用 Supabase Auth
2. 用 LINE 登入後，手動在 staff_profiles 中插入使用者紀錄
3. 無需 Edge Function 中介

但這需要重新設計 auth flow...

---

## 檢查清單（按順序試試）

□ 1. 嘗試重新生成 Service Role Key（見方案 1）
□ 2. 改變郵箱格式（見方案 2）
□ 3. 檢查 staff_profiles 表是否有該用戶
□ 4. 開 F12 看 Network 請求，查看 Edge Function 的完整回應
□ 5. 進 Supabase Logs → 查看 Edge Function 的完整錯誤日誌

---

## 需要幫助？

**請提供：**
1. F12 開發者工具 → Network 分頁 → line-callback 請求 → 回應內容（截圖）
2. 或 Supabase Dashboard → Edge Functions → line-callback → Logs 中的錯誤訊息

這樣我才能看到真實的錯誤！ ✉️
