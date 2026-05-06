# Supabase Edge Function Secrets 設定指南

## 快速導航
直接進入此 URL：
```
https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions/line-callback
```

## 步驟圖解

### 1️⃣ 進 Edge Functions 頁面
Supabase Dashboard 左側邊欄 → **Integrations** 下方 → **Edge Functions**

或直接點：[Edge Functions 列表](https://supabase.com/dashboard/project/vesglrsuvcsamakbcsdr/functions)

### 2️⃣ 點選 `line-callback` 函式
看到部署列表中的 `line-callback`，點進去

### 3️⃣ 找到 Secrets 分頁
進入函式後，頁面上方有幾個分頁：
- Code
- **Secrets** ← 點這個
- Logs
- Settings

### 4️⃣ 新增環境變數

#### 第一個
- **Key**: `LINE_CHANNEL_ID`
- **Value**: `2009779886`
- 點 **Add Secret** 或 **Save**

#### 第二個
- **Key**: `LINE_CHANNEL_SECRET`
- **Value**: 從 [LINE Developers Console](https://developers.line.biz/zh-hant/services/line-login/) 複製
  - 進 LINE Developers Console
  - 選你的 Channel（FK-Learning）
  - 點 **Basic settings**
  - 找到 **Channel secret** 欄位
  - 複製內容（會是一長串英數字）
- 點 **Add Secret** 或 **Save**

### ✅ 完成
Secrets 頁面應該會顯示兩個已設定的環境變數，變綠表示成功

---

## LINE Developers Console 位置
1. 進 https://developers.line.biz/
2. 登入你的帳戶
3. 左側選 **Providers** → 選 **FK-Learning** provider
4. 左側選 **Channels** → 選 **FK-Learning** channel
5. 點 **Basic settings**
6. 找 **Channel secret** 複製

---

## 常見問題

**Q: 設定後何時生效？**
A: 立即生效。Edge Function 下次被呼叫時會讀到這些環境變數。

**Q: Secret 會暴露嗎？**
A: 不會。Supabase Edge Function 的 Secret 存在伺服器端，永遠不會傳送到瀏覽器。

**Q: 我設錯了怎麼辦？**
A: 進 Secrets 頁面點 Secret 右邊的 🗑️ 刪除，重新新增。
