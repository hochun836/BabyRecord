# 🍼 BabyRecord

一款簡單、大方的嬰兒日常作息記錄 PWA，為爸爸媽媽與爺爺奶奶而設計。

## 功能

- **多寶寶管理** — 支援多個小孩，各自設定名稱、暱稱、生日、頭貼
- **快速記錄** — 喝奶（配方奶/母乳）、尿布、體溫、體重、身長、副食品、洗澡、睡眠
- **歷史回顧** — 月曆 + 當日時間軸，支援編輯與刪除
- **統計圖表** — 喝奶次數/總量、成長曲線、尿布次數、睡眠時數
- **提醒功能** — 設定餵奶/睡眠提醒，可設定提前通知分鐘數
- **Google Drive 備份** — 匯出/匯入資料至個人 Google Drive

## 技術

- Pure JavaScript (ES Modules) + CSS + RWD
- PWA (Service Worker + Manifest)
- IndexedDB 本地儲存
- Chart.js 統計圖表
- Google Identity Services + Drive API v3

## 使用方式

1. 使用任何 HTTP Server 提供靜態檔案（例如 VS Code Live Server）
2. 開啟瀏覽器訪問 `http://localhost:port`
3. 首次使用會引導你新增寶寶資料

## Google Drive 備份設定

若需使用 Google Drive 備份/還原功能，請先建立 Google Cloud 專案：

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → 新增專案
2. 左側選單 → API 和服務 → 啟用 API → 搜尋並啟用 **Google Drive API**
3. 左側選單 → OAuth 同意畫面 → 外部 → 填入應用程式名稱與聯絡人 Email
4. 左側選單 → 憑證 → 建立憑證 → OAuth 2.0 用戶端 ID → 網頁應用程式
5. 在「已授權的 JavaScript 來源」加入：
   - `http://localhost:你的PORT`（開發用）
   - 正式網域（上線用）
6. 複製 Client ID → 在 App 的「設定 → 資料備份」頁貼入

## 授權

MIT
