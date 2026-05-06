# LINE Developers Console - Channel Secret 複製指南

## 快速位置
https://developers.line.biz/console/

## 完整步驟

### 1️⃣ 進 LINE Developers Console
瀏覽器開啟：https://developers.line.biz/console/

### 2️⃣ 選擇正確的 Provider
- 左側邊欄看到 **Providers** 或 **應用程式** 列表
- 找到 **富康英文網** 或 **taipeifukang-eng's Org**
- 點進去

### 3️⃣ 選擇 LINE Login Channel
- 進去後看到該 Provider 下的 **Channels** 列表
- 找到 **FK-Learning** 或 **LINE Login** channel
- 點進去

### 4️⃣ 進 Basic settings
- 進 Channel 後，左側菜單找 **Basic settings**
- 點進去

### 5️⃣ 複製 Channel Secret
頁面上會顯示：
- **Channel ID**: 2009779886 ← 已經知道
- **Channel Secret**: ••••••••••••••••••••••••••••••••••• ← 點「顯示」或直接複製

複製整個 Channel Secret 的值

---

## 設定到 Supabase

拿到 Channel Secret 後：
1. 進 [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback)
2. 新增 Secret：
   - **Key**: `LINE_CHANNEL_SECRET`
   - **Value**: 貼上剛才複製的 Channel Secret
3. 保存

---

## 安全提醒
⚠️ **Channel Secret 是機密資訊，永遠不要：**
- 上傳到 Git（`.gitignore` 會自動排除 `.env`）
- 分享給他人
- 放在前端環境變數（`VITE_` 前綴）

✅ **正確的做法：**
- 存在 Supabase Edge Function Secrets（伺服器端）
- 存在私密的 `.env` 檔（本地開發用，不 commit）
- 通過 GitHub Secrets（CI/CD 用）
