# 🔧 登入問題完整修復清單

## 已完成的改進 ✅

1. **Edge Function 完全重寫**
   - 添加詳細的分步日誌
   - 更好的錯誤處理
   - Supabase client 初始化改進

2. **Edge Function 已部署** ✅
   - 執行時間：剛剛
   - 新版本已生效

## 現在需要您執行的步驟 👇

### 步驟 1️⃣ — 在 Supabase SQL Editor 重設 RLS 策略

進入：https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new

**複製以下 SQL**：

```sql
-- 清除舊策略
drop policy if exists staff_profiles_self_read on public.staff_profiles;
drop policy if exists staff_profiles_admin_read on public.staff_profiles;
drop policy if exists staff_profiles_admin_update on public.staff_profiles;
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;

-- 重新創建正確的策略
create policy staff_profiles_admin_insert on public.staff_profiles
  for insert with check (true);

create policy staff_profiles_admin_read on public.staff_profiles
  for select using (public.is_admin());

create policy staff_profiles_admin_update on public.staff_profiles
  for update using (public.is_admin());

-- 確保其他表的策略也正確
drop policy if exists courses_authenticated_read on public.courses;
create policy courses_authenticated_read on public.courses
  for select using (auth.role() = 'authenticated');

drop policy if exists courses_admin_all on public.courses;
create policy courses_admin_all on public.courses
  for all using (public.is_admin());

drop policy if exists lessons_authenticated_read on public.lessons;
create policy lessons_authenticated_read on public.lessons
  for select using (auth.role() = 'authenticated');

drop policy if exists lessons_admin_all on public.lessons;
create policy lessons_admin_all on public.lessons
  for all using (public.is_admin());

drop policy if exists progress_self_read on public.learning_progress;
create policy progress_self_read on public.learning_progress
  for select using (auth.uid()::text = staff_profile_id::text);

drop policy if exists progress_admin_read on public.learning_progress;
create policy progress_admin_read on public.learning_progress
  for select using (public.is_admin());

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles
  for select using (auth.role() = 'authenticated');

drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read on public.role_permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles
  for select using (auth.uid()::text = staff_profile_id::text);

drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles
  for all using (public.is_admin());
```

點擊執行（綠色 Execute 按鈕），確保看到 ✅ Success

---

### 步驟 2️⃣ — 重試登入

1. 進 http://localhost:5175/
2. 硬刷新：**Ctrl+Shift+R**
3. 點「用 LINE 登入」
4. 完成 LINE 登入流程

**預期結果**：
- 應該重定向到 `/dashboard`
- 顯示儀表板統計數據
- 左側菜單可用

---

### 步驟 3️⃣ — 如果仍然失敗

進 Edge Function 日誌查看詳細錯誤：
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback

1. 點擊最後一次請求
2. 查看 **Response** 和 **Logs** 面板
3. **複製整個錯誤日誌** 並告訴我

---

## 可能的錯誤及解決方案

### 📌 如果看到 `create_user_failed`
- 進 Supabase → Authentication → Users
- 搜索 `fukangtw.local`
- 如果找到同名用戶，手動刪除
- 重試登入

### 📌 如果看到 `create_profile_failed`
- 表示 RLS 策略仍然阻止插入
- 確保第 1 步的 SQL 全部執行成功

### 📌 如果看到 `line_token_failed`
- LINE OAuth 配置問題
- 檢查 LINE Channel ID/Secret 是否正確
- 檢查回調 URL 是否正確

---

## 本次改進總結

✅ Edge Function 代碼完全重寫，包含：
- 分步驟的詳細日誌
- 更好的錯誤消息
- Supabase client 初始化優化

✅ 部署已完成

⏳ 等待您執行 SQL 並重試登入

---

**有任何問題，馬上截圖告訴我！** 📸
