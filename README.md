# TaskFlow｜多人專案管理平台

TaskFlow 是一套以多人協作為核心的全端專案管理系統，目標是提供專案建立、成員管理、任務追蹤及即時同步功能。

本專案採取循序開發方式，從單機網站雛型開始，逐步建立資料持久化、使用者驗證、角色權限及多人協作功能。

## 專案目標

建立一套簡化版的 Trello / Jira，讓多位使用者可以透過同一個網站共同管理工作進度。

主要開發目標：

1. 建立可持久化的專案與任務管理系統。
2. 支援不同使用者參與同一個專案。
3. 透過角色權限限制資料存取及修改。
4. 透過 Kanban 看板追蹤任務進度。
5. 透過 WebSocket 同步多人操作結果。
6. 建立可維護、可測試且具備版本紀錄的全端專案。

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

以上為整體產品規劃，不代表所有功能目前均已完成。

## 技術架構

| 層級                    | 技術                    |
| ----------------------- | ----------------------- |
| Frontend                | HTML5、CSS3、JavaScript |
| Backend                 | Node.js、Express 5      |
| Database                | SQLite                  |
| SQLite API              | Node.js node:sqlite     |
| API                     | REST API                |
| Authentication          | 後端身分驗證（M3 規劃） |
| Authorization           | RBAC（M4 規劃）         |
| Real-time               | Socket.IO（M7 規劃）    |
| Testing                 | Node.js node:test       |
| Version Control         | Git、GitHub             |
| Development Environment | VS Code、PowerShell     |

目前不強制引入 React 或其他大型前端框架，以降低初期架構複雜度。

## 專案狀態

- M0：專案初始化已完成。
- M1：網站骨架、Dashboard 與基本自動化測試已完成。
- M1：部分手機響應式及瀏覽器 Console 驗收尚待補充。
- M2-A：SQLite 資料庫基礎已完成。
- M2-A：10/10 自動化測試通過，已同步至 GitHub。
- M2-B：Project CRUD API 核心實作完成。
- M2-B：21/21 自動化測試通過。
- M2-B：HTTP 401 與 200 驗收通過。
- M2-B：已於 Commit a20aa36 同步 GitHub。
- M2-C：完成 33/33 回歸測試，待本批次 GitHub 同步。
- M3～M10：尚未開始。
- 正式版本：尚未發布。
- 預定首個正式版本：v1.0.0。

目前仍屬開發階段，尚未完成正式使用者登入、真正的多人協作與即時同步。

## 專案目錄

```text
TaskFlow/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT_LOG.md
│   ├── PROJECT_PLAN.md
│   └── TESTING.md
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server/
│   ├── db.js
│   ├── init-db.js
│   ├── project-repository.js
│   ├── project-routes.js
│   ├── schema.sql
│   └── server.js
├── tests/
│   ├── database.test.js
│   ├── projects.test.js
│   └── server.test.js
├── data/
│   └── taskflow.db
├── .gitignore
├── CHANGELOG.md
├── package.json
├── package-lock.json
└── README.md
```

註：`data/` 及資料庫檔案由程式初始化建立，且已透過 `.gitignore` 排除，不納入 Git 版本控制。

## 本機開發說明

### 系統需求

- Node.js 24.x（目前已驗證版本：v24.15.0）
- npm
- VS Code
- PowerShell 或其他終端機
- Git

目前使用 Node.js 內建 `node:sqlite`，因此不需要額外安裝第三方 SQLite npm 套件。

### 安裝相依套件

在 TaskFlow 專案根目錄執行：

```powershell
npm install
```

### 初始化資料庫

```powershell
npm run db:init
```

資料庫位置：

```text
data/taskflow.db
```

目前已建立三張核心資料表：

- users
- projects
- project_members

初始化指令可以重複執行，不會主動刪除既有資料。

### 啟動開發伺服器

```powershell
npm run dev
```

網站網址：

http://localhost:3000

健康檢查 API：

http://localhost:3000/api/health

正式啟動指令：

```powershell
npm start
```

### 執行自動化測試

```powershell
npm test
```

M2-B 階段已驗證：

- 測試總數：21
- 通過：21
- 失敗：0
- 取消：0
- 跳過：0

測試涵蓋 M1 Express、M2-A SQLite 以及 M2-B Project CRUD API。

## M1｜網站骨架與基本介面

M1 建立了 TaskFlow 的第一個可執行網站雛型。

### 已完成功能

- Node.js 與 Express 5 開發環境
- Express HTTP Server
- 健康檢查 API
- 深色系 Dashboard
- 三欄 Kanban 看板
- 六筆示範任務
- 任務數量統計
- 響應式樣式
- Node.js 自動化測試

### 已驗證內容

- Express Server 正常啟動
- GET /api/health 正常回應
- 首頁及靜態資源正常載入
- 不存在的 API 正確回傳 404
- 六筆示範任務正常顯示
- 看板三欄各有兩筆任務
- Dashboard 統計顯示 6、2、2
- M1 自動化測試 4/4 通過

### M1 介面限制

M1 建立時，任務看板仍使用前端示範資料。

截至 M2-B，這個任務看板仍未串接正式任務資料庫。

專案資料庫及 Project CRUD API 已於 M2 建立，但尚未與前端專案管理介面整合。

手機響應式及瀏覽器 Console 的部分驗收項目仍待補充。

## M2-A｜SQLite 資料庫基礎

M2-A 建立 TaskFlow 的正式 SQLite 資料庫基礎。

### 已建立模組

- `server/schema.sql`：資料表、索引及約束定義
- `server/db.js`：資料庫連線及 Schema 初始化
- `server/init-db.js`：資料庫初始化工具
- `tests/database.test.js`：SQLite 自動化測試

### 核心資料表

#### users

儲存使用者帳號識別、電子郵件、密碼雜湊欄位及顯示名稱。

#### projects

儲存專案名稱、描述、擁有者、狀態、版本及建立與修改時間。

#### project_members

建立 users 與 projects 之間的多對多關聯，並儲存成員角色。

### 資料完整性設計

- Primary Key
- Foreign Key
- Unique Constraint
- Check Constraint
- ON DELETE CASCADE
- 查詢索引
- version 版本欄位

### SQLite 設定

- Foreign Keys：ON
- Busy Timeout：5000ms
- Journal Mode：WAL（檔案型資料庫）

### 驗證結果

- SQLite 初始化：PASS
- 重複初始化：PASS
- Schema 與外鍵測試：PASS
- SQLite 測試：6/6 PASS
- M1 Express 回歸測試：4/4 PASS
- 總測試數：10
- 測試失敗：0
- SQLite 檔案 Git 忽略規則：PASS

### 版本紀錄

M2-A 功能提交：

`d557020`

已成功同步至 GitHub。

後續文件架構整理亦於 Commit `113765c` 完成部分更新。

## M2-B｜Project CRUD API

M2-B 建立可操作 SQLite 專案資料的 REST API。

### 已實作 API

| Method | Endpoint          | 功能                      |
| ------ | ----------------- | ------------------------- |
| POST   | /api/projects     | 建立專案與 Owner 成員關聯 |
| GET    | /api/projects     | 查詢可存取的專案列表      |
| GET    | /api/projects/:id | 查詢指定專案              |
| PATCH  | /api/projects/:id | 修改專案資料              |
| DELETE | /api/projects/:id | 刪除專案                  |

### 已建立模組

- `server/project-repository.js`
- `server/project-routes.js`
- `tests/projects.test.js`

並修改 `server/server.js`，整合 Project API 路由及錯誤處理。

### 主要功能

- 專案新增、查詢、修改及刪除
- 建立專案時同步建立 Owner 關聯
- SQLite Transaction
- Prepared Statements
- 使用者所屬專案資料隔離
- Owner / Admin / Member 基本操作限制
- version 樂觀鎖
- HTTP 409 版本衝突處理
- HTTP 請求輸入驗證
- 統一 JSON 錯誤回應

### 基本角色限制

| 角色       | 讀取專案 | 修改專案 | 刪除專案 |
| ---------- | -------- | -------- | -------- |
| Owner      | 允許     | 允許     | 允許     |
| Admin      | 允許     | 允許     | 不允許   |
| Member     | 允許     | 不允許   | 不允許   |
| 非專案成員 | 不允許   | 不允許   | 不允許   |

完整 RBAC 及成員管理將於 M4 實作。

### 身分驗證限制

目前 M3 正式登入系統尚未開發。

正式啟動的伺服器不會自動賦予任何使用者已登入身分。

因此，未登入使用者呼叫：

```http
GET /api/projects
```

會得到：

```json
{
  "error": "UNAUTHENTICATED",
  "message": "請先登入。"
}
```

HTTP 狀態碼：401 Unauthorized。

目前 CRUD 測試使用隔離的記憶體資料庫與可信任的測試身分注入機制。

客戶端自行提交的 `user_id` 不會被視為正式身分驗證依據。

### Project API 版本控制

更新專案時必須提供目前版本：

```json
{
  "version": 1,
  "name": "新版專案名稱"
}
```

刪除專案時則透過查詢參數提供版本，例如：

```http
DELETE /api/projects/1?version=2
```

當提交版本與資料庫版本不一致時，API 回傳 HTTP 409 Conflict。

### M2-B 驗收

- Project CRUD 自動化測試：PASS
- M1 回歸測試：PASS
- M2-A 回歸測試：PASS
- 自動化測試總計：21/21 PASS
- 失敗測試：0
- npm run dev：PASS
- GET /api/projects：HTTP 401 PASS
- GET /api/health：HTTP 200 PASS
- 桌面版 Dashboard：PASS

### M2-B 版本紀錄

- 核心程式、測試與文件已於 Commit a20aa36 推送至 GitHub。

M2-B 尚未代表正式登入、前端 CRUD 操作或完整多人協作已經完成。

## M2-C｜最終驗收（33/33）

M2-C 已完成 SQLite 與 HTTP 整合測試。

### 已完成驗證

- SQLite 持久化及關閉後重新開啟
- Transaction Rollback
- 外鍵、唯一性及狀態約束
- WAL 與資料庫完整性
- HTTP 專案建立及修改後重新開啟
- HTTP 刪除後資料持久化
- HTTP 400、404、413 邊界條件
- 未登入使用者冒用身分防護
- 兩個獨立 Worker 競爭相同 version

### 自動化測試

- M1：4/4 PASS
- M2-A：6/6 PASS
- M2-B：11/11 PASS
- M2-C：12/12 PASS
- 全部測試：33/33 PASS
- 失敗數：0

### 安全性

所有 M2-C 新增測試使用記憶體或
系統暫存 SQLite，不修改正式資料庫。

### 後續限制

尚未完成正式使用者登入、完整 RBAC、
任務 CRUD、Socket.IO 與公開部署。

M2-C 核心測試完成，待本批次 GitHub 同步。

## 開發方式與版本管理

本專案使用 VS Code 進行開發，所有程式碼與文件均存放於獨立的 TaskFlow 專案資料夾。

正式工作目錄：

`C:\Projects\TaskFlow`

每個完整功能批次原則上完成：

1. 功能實作
2. 必要自動化測試
3. 問題修正與重新驗證
4. 集中更新相關文件
5. Git Commit
6. GitHub Push
7. 檢查版本一致性

不需要每修改一個程式檔案，就立即更新全部 Markdown 文件。

開發日誌及測試紀錄採累積式管理，保留重要歷史、技術決策與問題處理過程。

## 專案文件

- `README.md`：專案介紹、功能及使用說明
- `CHANGELOG.md`：產品功能變更紀錄
- `docs/DEVELOPMENT_LOG.md`：開發歷程與技術決策
- `docs/PROJECT_PLAN.md`：開發里程碑與進度
- `docs/ARCHITECTURE.md`：系統及資料庫架構
- `docs/TESTING.md`：測試與驗證紀錄

## GitHub Repository

https://github.com/Chiou-Jiakang/TaskFlow

主要開發分支：`main`

## 版本目標

預定首個正式版本：

`v1.0.0`

目標包含：

- 使用者帳號系統
- 專案與成員管理
- RBAC 權限管理
- 任務 CRUD
- Kanban 拖曳
- WebSocket 即時同步
- 協作紀錄
- Dashboard 與搜尋分析
- 完整測試及 GitHub Release

## 授權

目前尚未選定授權條款。
