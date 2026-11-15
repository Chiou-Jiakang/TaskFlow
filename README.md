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
- 目前階段：M1 — 網站骨架與基本介面（待開始）
- 開發狀態：建置中
- 正式版本：尚未發布
- 預定首個正式版本：v1.0.0

M0 已完成專案目錄建立、Git 初始化、文件架構配置，
以及首次 GitHub Commit 與 Push。

目前尚未開發可執行網站。

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
