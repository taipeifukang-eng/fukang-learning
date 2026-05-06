# 🔐 LINE Login 回調 URL 設定指南

**問題**: LINE 返回 400 Bad Request — `redirect_uri` 未正確註冊

**原因**: 開發伺服器自動改用 5175 端口，但 LINE Console 只知道 5173

**解決方案**: 在 LINE Developers Console 添加 5175 回調 URL

---

## ✅ 已完成的步驟

✓ `.env` 已更新 — `VITE_LINE_REDIRECT_URI=http://localhost:5175/auth/line/callback`

---

## ⏳ 需要你操作的步驟

### 進 LINE Developers Console

1. 打開瀏覽器 → https://developers.line.biz/console/
2. 用你的 LINE 帳號登入（如果需要）
3. 在左側列表找到 **FK-Learning** Channel（或 富康中學相關的 Channel）
4. 點進去

---

### 找到 Callback URL 設定

5. 點左側菜單 **Basic settings** 分頁
6. 往下滑，找到 **Callback URL** 欄位
   - 可能已有一行：`http://localhost:5173/auth/line/callback`

---

### 添加新的 Callback URL

7. **在下面新增一行**：`http://localhost:5175/auth/line/callback`

**現在應該有兩行**：
```
http://localhost:5173/auth/line/callback
http://localhost:5175/auth/line/callback
```

8. 點右下角 **Update** 或 **Save** 按鈕（綠色按鈕）

9. 看到 ✅ Success 或綠色勾勾 → 完成！

---

## 🧪 驗證設定

完成後：

1. 回到瀏覽器 → `http://localhost:5175/`
2. 刷新頁面 (Ctrl+R 或 F5)
3. 點 **用 LINE 登入** 按鈕
4. 應該會跳到 LINE 登入頁面（不再 400 錯誤）✅
5. 用你的 LINE 帳號登入
6. 登入成功 → 重導回儀表板 ✅

---

## ❓ 如果還是失敗

**可能的原因**：

| 問題 | 解決方式 |
|-----|--------|
| LINE Console 未保存 | 確認按了 Update/Save，看到綠色勾勾 |
| 瀏覽器快取 | 硬刷新：Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac) |
| 端口不對 | 確認瀏覽器中是 `localhost:5175`，不是 5173 |
| 多個 Dev 伺服器 | 只能同時執行一個 `npm run dev` — 關閉其他終端機 |

---

## 📞 需要幫助？

- LINE 回調 URL 不確定格式？查看 [EDGE_FUNCTION_SECRETS.md](EDGE_FUNCTION_SECRETS.md)
- 其他問題？檢查 [DEPLOYMENT.md](DEPLOYMENT.md)
