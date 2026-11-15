# TaskFlow｜多人專案管理平台

TaskFlow 是一套以多人協作為核心的全端專案管理系統，
目標是提供專案建立、成員管理、任務追蹤及即時同步功能。

## 專案目標

建立一套簡化版的 Trello / Jira，
讓多位使用者可以透過同一個網站共同管理工作進度。

## 規劃功能

- 使用者註冊、登入及登出
- 專案建立、編輯及封存
- 專案成員邀請及管理
- RBAC 角色權限控制
- Kanban 任務看板
- 任務新增、編輯、刪除及指派
- Drag & Drop 任務拖曳
- WebSocket 多人即時同步
- 任務留言、通知及活動紀錄
- 統計儀表板及搜尋篩選

## 技術規劃

| 層級            | 技術                  |
| --------------- | --------------------- |
| Frontend        | HTML、CSS、JavaScript |
| Backend         | Node.js、Express      |
| Database        | SQLite                |
| API             | REST API              |
| Authentication  | 後端身分驗證          |
| Authorization   | RBAC                  |
| Real-time       | Socket.IO             |
| Version Control | Git、GitHub           |

## 專案狀態

- 已完成階段：M0 — 專案初始化
- 目前階段：M1 — 網站骨架與基本介面（驗收中）
- 開發狀態：建置中
- 正式版本：尚未發布
- 預定首個正式版本：v1.0.0

M0 已完成專案目錄、Git 初始化、文件建置及 GitHub 同步。

M1 已建立 Express Server、健康檢查 API、
深色系 Dashboard、Kanban 看板及自動化測試。

目前 Express 自動化測試已通過，
瀏覽器驗收與 GitHub 同步仍待完成。

此階段的任務資料為前端示範資料，
尚未實作 SQLite 持久化、登入及多人即時同步。

## M1 本機開發說明

### 系統需求

- Node.js 22 或以上支援中的 LTS 版本
- npm
- VS Code

### 安裝相依套件

在 TaskFlow 專案根目錄執行：

`npm install`

### 啟動開發伺服器

`npm run dev`

網站網址：

http://localhost:3000

健康檢查 API：

http://localhost:3000/api/health

### 自動化測試

`npm test`

目前 M1 Express Smoke Tests：
4 個測試項目通過，0 個失敗。

### M1 已建立功能

- Node.js 與 Express 5 開發環境
- Express HTTP Server
- 健康檢查 API
- 深色系 Dashboard
- 三欄 Kanban 看板
- 六筆示範任務
- 任務數量統計
- 響應式樣式
- Node.js 自動化測試

### M1 限制

目前為介面雛型。

尚不支援真正的使用者登入、
資料庫儲存、任務 CRUD、拖曳或多人同步。

## 開發方式

本專案使用 VS Code 進行開發，
所有程式碼與文件存放於獨立的 TaskFlow 專案資料夾。

每個開發批次原則上應完成：

1. 功能開發
2. 必要驗證及測試
3. 文件同步更新
4. Git Commit
5. GitHub Push
6. 檢查版本一致性

## 專案文件

- `CHANGELOG.md`：產品功能變更紀錄
- `docs/DEVELOPMENT_LOG.md`：詳細開發歷程
- `docs/PROJECT_PLAN.md`：開發進度與里程碑
- `docs/ARCHITECTURE.md`：系統架構
- `docs/TESTING.md`：測試與驗證紀錄

## 授權

目前尚未選定授權條款。
