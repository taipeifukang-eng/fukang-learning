# ⚡ 立即執行 — 3 步修復登入

## 步驟 1️⃣ — 複製 SQL（1 分鐘）

進：https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/sql/new

複製這個 SQL：https://raw.githubusercontent.com/your-repo/COMPLETE_FIX_CHECKLIST.md

或者複製下面這個簡化版本：

```sql
drop policy if exists staff_profiles_admin_insert on public.staff_profiles;
create policy staff_profiles_admin_insert on public.staff_profiles for insert with check (true);
```

點 **Execute** (綠色按鈕)

---

## 步驟 2️⃣ — 重試登入（1 分鐘）

1. 進 http://localhost:5175/
2. **Ctrl+Shift+R** (硬刷新)
3. 點「用 LINE 登入」
4. 用你的 LINE 帳號登入

---

## 步驟 3️⃣ — 如果失敗（看錯誤提示）

進 https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback

點最新請求，查看 Logs 面板

**複製錯誤信息** 並告訴我！

---

**就這樣！** 試試看吧！ 🚀
