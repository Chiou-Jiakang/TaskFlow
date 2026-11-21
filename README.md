# TaskFlow｜多人專案管理平台

<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

## 最新開發狀態｜M8 留言、活動時間軸與即時同步（2026-11-21）

> 此節為目前最新進度快照。後文 M0～M7 的「未完成」或進度百分比敘述屬**當時**的歷史紀錄；不可直接當成現在的狀態。**TaskFlow v1.0.0 尚未正式發布**。

- **M0～M7：** 先前已完成 GitHub 結案；M7 包含 Socket.IO 授權 Room、成功寫入後的事件通知、重新連線補抓與多人 Edge 驗收。
- **M8-A：** SQLite 增量 Schema 與 Repository，包含 `task_comments`、`project_activity`、同專案外鍵／觸發器、留言版本管理及軟刪除。
- **M8-B：** 留言 CRUD 與活動查詢 REST API，沿用 Session、CSRF、RBAC、封存限制及 409 版本衝突規則。
- **M8-C1：** 任務留言介面；**M8-C2：** 專案活動時間軸與分頁；**M8-C3：** 經授權 Socket Room 的留言異動提示、前端 REST 重新抓取、斷線重連補抓。
- **最新本機驗收（M8-C3）：** `npm test -- --test-concurrency=1` **264/264 PASS**；M8-C3 Edge 專項 **7/7 PASS**；既有 `npm run test:e2e:all` **52/52 PASS**，截圖所示均 `fail 0`。M8-C2 歷史驗收為 **260/260** 與 Edge **6/6**。此處的專項測試包含在對應全套計數內，**不能重複加總**。
- **安全界線：** Socket 推播僅含資源變更識別資訊、不包含留言正文；權限以 REST 與 Socket Room 的 Session／成員資格再次核驗。測試使用獨立記憶體 SQLite，正式 `data/taskflow.db` 不列為測試目標。
- **活動範圍限制：** 目前 `project_activity` 記錄的事件為 `comment_created`、`comment_updated`、`comment_deleted`；**尚未涵蓋所有任務／成員動作的通用事件流**。
- **結案狀態：** M8 功能及既定測試已通過；**本節不預先宣告 Git Commit／Push 已成功**，請以實際 `HEAD`／`origin/main` 與乾淨工作樹作最終依據。正式 GitHub Release 尚未發布。
- **後續：** M9 搜尋／統計／篩選與產品體驗，M10 部署、HTTPS、跨瀏覽器、效能、完整安全驗收與正式 Release；較完整的邀請／核准流程若仍在原需求內，須另列後續工作。

### M8 主要檔案與驗收指令

- 資料層：`server/collaboration-schema.sql`、`server/collaboration-repository.js`。
- API／即時層：`server/collaboration-routes.js`、`server/realtime-notifier.js`、`server/realtime-hub.js`。
- 前端：`public/task-comments.js`、`public/task-comments.css`、`public/task-activity.js`、`public/task-activity.css`、`public/task-realtime.js`。
- 專項驗收：`node --test tests/collaboration-repository.test.js`、`node --test tests/collaboration-api.test.js`、`node --test tests/collaboration-realtime.test.js`、`node --test e2e/task-activity.e2e.js`、`node --test e2e/collaboration-realtime.e2e.js`。

---

<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

<!-- M6-CURRENT-STATUS-2026-11-18 -->
## 最新開發狀態｜M6 核心驗收通過（2026-11-18）

> 本節是最新狀態快照。下方 M0～M5 以及舊的 M5 狀態文字保留歷史時點，若與本節不同，以本節與最新 Git 記錄為準。

- **M0～M5：** 已結案；M5 Git commit `93e7741`。
- **M6-A～M6-D：** 拖放與排序 Repository、API、前端和 Edge E2E 既定測試均通過。
- **本次完整驗收：** `npm test` **171/171 PASS**、四套 Edge E2E **52/52 PASS**，0 失敗、0 略過。
- **歷史相容修正：** M5-C2 的 Owner 狀態選單更新改用 M6 `/move` API，兩個 E2E 監聽條件已更新，14/14 PASS。
- **提交狀態：** M6 Git 結案須以實際 `HEAD`、`origin/main` 與乾淨工作樹驗證，不預先宣告 Commit／Push 完成。
- **進度估算：** TaskFlow v1.0.0 約 **75%**；M7～M10 與正式 Release 尚未完成。
<!-- /M6-CURRENT-STATUS-2026-11-18 -->

<!-- M5-CURRENT-STATUS-2026-11-17 -->
## 最新開發狀態｜M5 核心驗收通過（2026-11-17）

> 本節是目前狀態快照；下方 M0～M4 的既有文字保留其歷史時點，不應將早期「尚未實作」誤認為最新進度。

- **已完成核心驗收：** M0～M4；M5-A（Task Schema / Repository）、M5-B（Task REST API）、M5-C1（正式 Kanban 前端）、M5-C2（多人 Edge E2E）。
- **本次實測：** `npm test` 為 137/137 PASS；`npm run test:e2e:all` 為 37/37 PASS；失敗、跳過均為 0。這是兩組測試執行次數，不是 174 個獨立產品需求。
- **手動操作：** 已確認任務建立、看板呈現、狀態切換、重新整理後持久化、編輯和刪除。
- **正式資料：** 任務使用 SQLite `tasks`，看板不再以六張示範卡片作為正式任務資料。
- **版本狀態：** M5 文件與程式碼仍待 Git 檢查、Commit／Push；**尚未發布 TaskFlow v1.0.0**。
- **後續：** M6 Drag & Drop、M7 WebSocket 即時同步、M8 留言通知、M9 分析搜尋、M10 部署與發布驗收仍待開發。
- **整體進度：約 65%**，僅是依規劃範圍的粗略估計，不是精確的工程量度。
<!-- /M5-CURRENT-STATUS-2026-11-17 -->


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
| Authentication          | Session Cookie 與 Auth API（M3-B） |
| Authorization           | RBAC（M4 核心已實作）         |
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
- M2-C：33/33 PASS，已於 Commit 878dfec 同步 GitHub。
- M3-A：9/9 PASS，已於 Commit 1f94ce7 同步至 GitHub。
- M3-B：Authentication HTTP API 完成，完整回歸測試 53/53、正式 HTTP 驗收 22/22 PASS。
- M3-C1：前端 Authentication 已完成，Commit `32361a6` 已同步。
- M3-C2：Edge E2E 8/8 PASS；既有回歸測試 59/59 PASS。
- M4：成員管理與 RBAC 已通過既定驗收（Node.js 94/94、Edge E2E 23/23 PASS）。
- M5：已於 Commit 93e7741 完成 Git 結案；M6：核心功能與測試通過；M7～M10 尚待開發。
- 正式版本：尚未發布。
- 預定首個正式版本：v1.0.0。

目前仍屬開發階段：帳號驗證、專案與成員管理、RBAC 核心功能已完成既定測試；正式邀請核准、拖曳操作與多人即時同步仍待實作；正式任務管理已於 M5 核心驗收通過。

## 專案目錄（基礎結構示意）

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

目前已建立四張主要資料表：

- users
- projects
- project_members
- auth_sessions

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

M2-C 已於 Commit 878dfec 同步 GitHub，M2 正式結案。

## M3-A｜Authentication Foundation

M3-A 已完成使用者身分驗證資料層的核心實作。

### 新增模組

- server/auth-schema.sql
- server/auth-foundation.js
- tests/auth-foundation.test.js

### 已實作功能

- Email 格式驗證與正規化
- 帳號註冊資料存取
- 重複 Email 防護
- scrypt 密碼雜湊與隨機 Salt
- 密碼比對與安全使用者資料回傳
- Session Token 產生與 SHA-256 雜湊儲存
- Session 到期與撤銷
- 過期 Session 清理
- 使用者刪除後 Session 連動清除
- SQLite Session 持久化

### 資料庫

M3-A 新增 auth_sessions 資料表。

目前透過獨立的 auth-schema.sql 初始化。
尚未整合至正式網站資料庫初始化流程。

### 測試結果

- M3-A：9/9 PASS
- M1～M2-C：33/33 PASS
- 完整回歸測試：42/42 PASS
- Fail：0
- Skipped：0

### M3-A 當時限制

- 尚未建立正式註冊及登入 HTTP API
- 尚未整合 Session Cookie
- 尚未將 Project API 接到正式登入身分
- 尚未建立前端登入與註冊頁面

以上功能將在後續 M3-B、M3-C 完成。

M3-A 已於 Commit 1f94ce7 完成文件及 GitHub 同步。（上方限制為 M3-A 當時狀態。）

## M3-B｜Authentication HTTP API

### 已完成（後端）

- POST /api/auth/register：註冊並檢查 Email 唯一性，註冊不自動登入。
- POST /api/auth/login：驗證密碼、建立 Session、設定 HttpOnly Cookie。
- GET /api/auth/me：讀取目前登入使用者與 CSRF Token。
- POST /api/auth/logout：驗證 CSRF、撤銷 Session、清除 Cookie。
- Project CRUD 已使用 Session 身分；修改資料要求 CSRF Token。
- 正式 db:init 現在初始化 users、projects、project_members、auth_sessions 四張資料表。
- 限制 JSON 請求大小、進行來源檢查、基本記憶體式登入失敗限速。

### 新增檔案

- server/auth-routes.js：Authentication Router、Cookie 與 CSRF 驗證。
- tests/auth-api.test.js：M3-B 自動化測試。
- scripts/accept-m3b.js：執行中 Server 的本機 HTTP 驗收腳本。

### 操作與測試

啟動：`npm run db:init`，接著 `npm run dev`。
自動化：`npm test`（53/53 PASS，0 failed）。
HTTP 驗收：另開終端機執行 `node .\scripts\accept-m3b.js`（22/22 PASS）。
驗收腳本會新增隨機測試帳號，成功時刪除測試專案並撤銷 Session；帳號仍保留於本機 SQLite。

### 尚未完成

- M3-C 前端註冊、登入、登出畫面，以及 Dashboard 與正式 API 串接。
- 完整 RBAC、任務管理、多人 Socket.IO 同步、正式部署稽核。
- 目前登入失敗限速僅為單一 Node.js 程序內的記憶體紀錄，不適用於多實例正式部署。
- 正式 HTTPS、反向代理、進階安全測試仍待執行。

M3-B 的程式及既定驗收已完成；版本狀態以 GitHub main 最新提交為準。

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

## M3-C1｜前端身分驗證（2026-11-16）

- 完成登入與註冊頁面：`public/auth.html`、`auth.css`、`auth.js`。
- Dashboard 新增 Session 驗證與登出：`public/dashboard-auth.js`。
- `public/index.html` 串接登入者名稱、SQLite 專案列表及建立專案 API。
- 保留 M1 六張 Kanban 示範卡片，尚未連接正式任務資料表。
- 自動化測試：M3-C1 6/6 PASS；全專案 59/59 PASS，0 failed。
- 使用者回報註冊、登入、建立專案、重新整理及登出等瀏覽器流程通過。
- M3-C1 已於 Commit `32361a6` 完成 GitHub 同步。
- M3-C2 已通過 Edge E2E；正式 HTTPS、其他瀏覽器與部署安全仍待驗證。

## M3-C2｜Edge 瀏覽器端對端驗收（2026-11-16）

- 使用 `playwright-core` 操作已安裝的 Microsoft Edge。
- `npm run test:e2e`：8/8 PASS（七個子測試及一個父測試）。
- `npm test`：59/59 PASS，0 failed。
- E2E 涵蓋匿名跳轉、註冊、登入、Cookie、Session 隔離、專案建立、重新整理及登出。
- 測試使用獨立記憶體 SQLite 與隨機 Port。
- 不會清除正式 `data/taskflow.db`。
- 正式 HTTPS、其他瀏覽器及部署級安全驗收仍待完成。
- M3-C2 GitHub 提交狀態以 Git 實際紀錄為準。

<!-- M4-SUMMARY-2026-11-17 -->
## M4｜成員管理與 RBAC 驗收總結（2026-11-17）

### 階段成果

- M4-A：Member Repository、Owner / Admin / Member 權限矩陣，11/11 PASS。
- M4-B：成員 REST API，18/18 PASS。
- M4-C1：成員管理頁面、Dashboard 入口，6/6 PASS。
- M4-C2：四組獨立 Edge BrowserContext、五個測試帳號，15/15 PASS。
- 最新 npm test：94/94 PASS。
- 最新 npm run test:e2e:all：23/23 PASS。
- 以上測試均為 0 failed。

### 已實作功能

- 查看專案成員清單。
- 依 Email 新增已註冊成員。
- 修改 Admin、Member 角色。
- 依照權限移除成員。
- Admin、Member 自行退出專案。
- Owner 身分保護。
- Session、CSRF、同源及角色權限檢查。
- 專案 version 版本衝突偵測。
- 跨帳號資料隔離。
- 前端安全文字渲染。

### 本機驗證指令

    npm test
    npm run test:e2e:members
    npm run test:e2e:all

### M4 範圍限制

- 目前是依 Email 直接加入已註冊帳號，不是完整邀請確認流程。
- M4 當時的 Kanban 六張卡片為示範資料；正式 Task CRUD 已於 M5 實作。
- Socket.IO 即時同步、正式 HTTPS、跨瀏覽器及部署級安全測試尚未完成。
- 驗收結果只代表既定測試範圍通過，不代表產品不存在其他潛在問題。

<!-- M5-SUMMARY-2026-11-17 -->
## M5｜正式任務管理與 Kanban（2026-11-17）

### 已完成功能

- **M5-A｜Task Schema / Repository：** 增量建立 `tasks` 資料表，保留 `users`、`projects`、`project_members`、`auth_sessions` 與原有專案；包含任務欄位驗證、指派限制、刪除關聯、版本控制及資料持久化。
- **M5-B｜Task REST API：** `GET /api/projects/:id/tasks`、`POST /api/projects/:id/tasks`、`PATCH /api/projects/:id/tasks/:taskId`、`DELETE /api/projects/:id/tasks/:taskId`；沿用 Session Cookie、CSRF、同源政策、Owner/Admin/Member 權限與 409 版本衝突。
- **M5-C1｜正式看板：** 三欄「待處理／進行中／已完成」；依專案查詢 SQLite 資料；表單提供標題、描述、狀態、優先度、負責人、截止日期、排序位置；可依授權新增、修改、刪除及更新狀態。
- **M5-C2｜瀏覽器 E2E：** 四個獨立 Edge Session，驗證身分隔離、任務指派、Member 限權、Admin 編輯、資料持久化、409 衝突、刪除與登出失效。

### 主要檔案

| 範圍 | 檔案 |
| --- | --- |
| SQLite / Repository | `server/task-schema.sql`、`server/task-repository.js`、`server/init-db.js` |
| REST API / Server | `server/task-routes.js`、`server/server.js` |
| 前端 | `public/index.html`、`public/task-board.js`、`public/task-board.css`、`public/dashboard-auth.js` |
| Node.js 測試 | `tests/task-repository.test.js`、`tests/task-api.test.js`、`tests/task-frontend.test.js` |
| Edge E2E | `e2e/task-flow.e2e.js` |

### 執行方式

```powershell
npm run db:init
npm run dev
```

另開終端機執行測試：

```powershell
npm test
npm run test:e2e:tasks
npm run test:e2e:all
```

### 驗收與界線

- M5-A：15/15 PASS；M5-B：20/20 PASS；M5-C1：8/8 PASS；M5-C2：14/14 PASS。
- 完整 Node.js 回歸：**137/137 PASS、0 FAIL**；合併 Microsoft Edge E2E：**37/37 PASS、0 FAIL**。
- 使用者已於瀏覽器手動核對任務新增、顯示、狀態變更、重新整理後持久化、編輯及刪除均正常。
- M5 的程式和文件尚待最後一次 Git Commit／Push；完成前不寫入不存在的 Git SHA 或 Release 版本。
- 尚未支援 Drag & Drop、WebSocket 即時推播、完整邀請確認、留言／通知、正式環境效能和安全稽核。
<!-- /M5-SUMMARY-2026-11-17 -->

<!-- M6-SUMMARY-2026-11-18 -->
## M6｜Kanban 拖放與排序（2026-11-18）

### 已完成

- M6-A：`server/task-order-repository.js` 與排序交易，處理同欄重排、跨欄移動、position 重排與 version 樂觀鎖。
- M6-B：`server/task-order-routes.js` 與 `PATCH /api/projects/:id/tasks/:taskId/move`；沿用 Session、CSRF、RBAC、封存限制及 HTTP 409。
- M6-C：`public/task-board.js`、`public/task-board.css` 的 HTML Drag & Drop；Owner/Admin 可拖曳，Member 不具有排序權限。更新成功後重新取得正式資料；版本衝突時重載，避免顯示與 SQLite 不一致。
- M6-D：`e2e/kanban-drag.e2e.js` 使用 Microsoft Edge 多身分情境測試實際滑鼠拖放、重整持久化、權限與版本衝突。
- M5-C2 舊 E2E 的兩處 Owner 狀態修改等待路徑，已配合 M6 從原 Task PATCH 改為 `/move`；Member 的授權狀態更新仍沿用原 PATCH API。

### 驗收（本機終端機截圖，2026-11-18）

- M6-A：11/11；M6-B：14/14；M6-C：9/9；M6-D：15/15，均為既定專項測試通過。
- `npm test`：**171/171 PASS**；包含上述 Node.js 專項測試，不額外累加。
- 依序執行四套 Edge E2E：**52/52 PASS**（Auth 8、Member 15、Task 14、Kanban Drag 15），0 FAIL、0 SKIP。
- 兩個完整程序合計為 223 次通過的測試計數，非 223 項獨立產品需求或安全保證。

### 使用與驗收指令

```powershell
npm test
npm run test:e2e:drag
npm run test:e2e:all
```

`test:e2e:all` 應包含 `auth-flow.e2e.js`、`member-flow.e2e.js`、`task-flow.e2e.js`、`kanban-drag.e2e.js`；如環境資源造成競爭，可使用 `node --test --test-concurrency=1` 依序執行四個檔案。此說明不代表已驗證所有作業系統或瀏覽器。

### 尚未完成

M7 WebSocket／Socket.IO 即時推播與離線恢復；M8 協作留言及通知；M9 搜尋統計；M10 HTTPS 部署、跨瀏覽器、效能與完整安全驗收。正式 TaskFlow v1.0.0 尚未發布。M6 Git 是否結案以實際 `git status -sb`、`HEAD` 及 `origin/main` 比對為準。
<!-- /M6-SUMMARY-2026-11-18 -->

<!-- TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

## M7｜Socket.IO 多人即時協作（2026-11-19）

- **M7-A**：Socket.IO Session Cookie 驗證、Origin 同源檢查、專案 Room 存取控制與撤權再驗證。
- **M7-B**：成功完成 REST／SQLite 寫入後發佈資源異動事件；失敗回應不推播，事件不傳送私人任務內容。
- **M7-C**：前端協調器訂閱 Room、自動重抓 REST、離線重連補抓、切換專案隔離、編輯／拖曳中延後刷新。
- **M7-D**：新增 Microsoft Edge 多帳號整合驗收，覆蓋兩個專案事件隔離、同版本平行寫入 200／409、跨欄排序持久化、Member 權限、撤銷成員與登出後的事件隔離。

### 驗收命令（M7 結案前須已實際全數通過）

```powershell
npm test
npm run test:e2e:all
node --test .\e2e\realtime-sync.e2e.js
node --test .\e2e\realtime-resilience.e2e.js
git diff --check
```

M7-D E2E 使用 `:memory:` SQLite、隨機 Loopback Port 與測試帳號，不讀寫正式 `data/taskflow.db`。以上為驗收範圍，不代表正式 HTTPS、效能、跨瀏覽器或完整安全審核已完成。M8～M10 及正式 GitHub Release 仍待後續進行。

<!-- /TASKFLOW-M7-CLOSEOUT-2026-11-19 -->
