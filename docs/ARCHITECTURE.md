# TaskFlow｜系統架構說明

## 一、架構概述

TaskFlow 採用前後端責任分離的全端架構。

目前使用 HTML、CSS、JavaScript 建立前端介面，透過 Node.js 與 Express 提供網站及 REST API，並以 SQLite 儲存正式專案資料。

系統將逐步加入身分驗證、角色權限、任務管理及 Socket.IO 即時同步。

本文件同時說明目前已實作的架構，以及未來規劃中的模組。

## 二、Frontend

### 技術

- HTML5
- CSS3
- JavaScript

### 主要職責

- 顯示使用者介面
- 處理表單與互動
- 顯示專案及任務資料
- 發送 API 請求
- 接收未來 Socket.IO 即時事件

### 目前檔案

- public/index.html
- public/style.css
- public/app.js

### 已實作介面

- 深色系 Dashboard
- 左側工作空間導覽
- 專案資訊區
- 任務統計卡片
- 待處理、進行中、已完成三欄 Kanban
- 六筆示範任務
- 任務優先度及負責人資訊
- 響應式樣式

### 目前限制

前端任務看板仍使用 JavaScript 示範資料。

Project CRUD API 雖然已於後端建立，但尚未串接正式的前端專案管理介面。

## 三、Backend

### 核心技術

- Node.js
- Express 5
- REST API
- node:sqlite

### 已建立的主要模組

- Express HTTP Server
- Health Check API
- Project Repository
- Project Router
- SQLite Database Module
- SQLite Initialization Tool
- HTTP Error Handler

### 未來規劃模組

- Auth Service：身分驗證
- Project Service：擴充專案業務邏輯
- Task Service：任務管理
- Permission Service：完整 RBAC 權限檢查
- Activity Service：活動紀錄
- Socket.IO：即時事件通知

## 四、Database

### 資料庫技術

SQLite。

透過 Node.js 內建 node:sqlite 存取。

### 已建立資料表

- users
- projects
- project_members
- auth_sessions

### 尚未建立資料表

- tasks
- comments
- activities

未來可依需求加入 notifications 等其他資料表。

### 核心關聯

users 與 projects 為多對多關係。

使用 project_members 作為關聯表，記錄使用者在不同專案的角色。

projects.owner_id 則指定專案擁有者。

### 資料庫完整性

- Primary Key
- Foreign Key
- UNIQUE
- CHECK
- ON DELETE CASCADE
- 查詢索引
- version 欄位

### 正式資料庫位置

data/taskflow.db

此資料庫檔案不納入 Git 版本控制。

## 五、角色權限

### 規劃角色

- Owner
- Admin
- Member

### M2-B 已建立的基本限制

| 操作     | Owner | Admin  | Member |
| -------- | ----- | ------ | ------ |
| 讀取專案 | 允許  | 允許   | 允許   |
| 修改專案 | 允許  | 允許   | 不允許 |
| 刪除專案 | 允許  | 不允許 | 不允許 |

非專案成員不可存取指定專案。

### 後續規劃

M4 將建立完整的權限矩陣、成員管理及角色變更機制。

所有受保護操作必須由後端確認權限，不可只依靠前端隱藏按鈕。

## 六、多人即時同步

### 預定流程

1. 使用者發送更新請求。
2. 後端驗證身分與操作權限。
3. 資料庫執行更新。
4. 更新成功後發布 Socket.IO 事件。
5. 其他授權使用者收到更新通知。
6. 前端重新取得或套用最新資料。

### 核心原則

資料庫是持久化資料的權威來源。

WebSocket 負責通知資料變更，不能取代資料庫交易及權限驗證。

### 尚待處理

- 多使用者身分驗證
- Socket.IO 連線授權
- 專案 Room 管理
- 事件授權
- 版本衝突
- 斷線重連
- 資料重新同步
- 同步失敗處理

## 七、安全性

### 已實作的部分

- 參數化 SQL 查詢
- 基本資料輸入驗證
- Project API 未登入拒絕存取
- 專案成員資料隔離
- 基本角色限制
- HTTP 錯誤回應
- version 版本檢查
- SQLite 外鍵及資料完整性約束

### M2-B 時點尚未實作（歷史狀態）

- 安全密碼雜湊
- 正式使用者登入
- Session 或其他正式驗證機制
- 完整 RBAC
- Cookie 與 CSRF 防護策略
- 登入速率限制
- 機密設定管理
- 正式部署安全設定
- 完整安全測試

目前不能將 M2-B 的基本權限檢查視為完整的正式身分驗證系統。

## 八、架構發展狀態

### M1｜網站骨架

已完成：

- Express HTTP Server
- GET /api/health
- HTML、CSS、JavaScript 前端
- Dashboard
- 三欄 Kanban 示範看板
- Node.js 自動化測試

### M2-A｜資料庫基礎

已完成：

- SQLite 資料庫
- users
- projects
- project_members
- 外鍵及約束
- 初始化工具
- 資料庫自動化測試

### M2-B｜Project CRUD API

核心實作已完成：

- Project Repository
- Project Router
- 五個 Project CRUD API
- 基本角色限制
- version 樂觀鎖
- Transaction
- HTTP 錯誤處理
- CRUD 自動化測試

### M2-C｜整合驗收

尚未開始：

- 檔案持久化驗證
- Transaction Rollback 專項測試
- 多連線並發情境
- API 邊界測試
- 整體 M2 結案

## 九、M1 實際程式架構

### Backend

檔案：

server/server.js

職責：

- 啟動 Express HTTP Server
- 提供靜態網站
- 處理 GET /api/health
- 處理不存在的 API 路徑

### Frontend

檔案：

- public/index.html
- public/style.css
- public/app.js

職責：

- 呈現 Dashboard 及 Kanban
- 渲染示範任務
- 計算各狀態任務數量
- 提供響應式樣式

### Testing

檔案：

tests/server.test.js

測試項目：

- 健康檢查 API
- 首頁及靜態資源
- 不存在的 API 路徑

### M1 資料流程

前端示範資料
→ JavaScript 渲染
→ Dashboard / Kanban

### M1 架構限制

M1 僅建立介面及伺服器基礎。

當時尚未實作正式資料庫、登入及多人同步。

## 十、M2-A SQLite 資料庫架構

### 新增模組

#### server/schema.sql

定義：

- users
- projects
- project_members
- 外鍵
- CHECK 約束
- UNIQUE 約束
- 索引

#### server/db.js

負責：

- SQLite 資料庫連線
- Foreign Keys 設定
- Busy Timeout 設定
- WAL 模式
- Schema 初始化

#### server/init-db.js

負責：

- 建立正式資料庫檔案
- 初始化資料表
- 顯示初始化結果
- 正確關閉資料庫連線

#### tests/database.test.js

負責：

- 測試資料表
- 測試外鍵
- 測試重複初始化
- 測試角色約束
- 測試資料刪除關聯

### 資料庫設定

- Foreign Keys：ON
- Busy Timeout：5000ms
- Journal Mode：WAL（檔案型資料庫）

### 資料表關聯

一個使用者可以參與多個專案。

一個專案也可以有多位成員。

使用 project_members 表示多對多關係。

### 版本欄位

projects.version 為正整數。

初始值為 1。

後續 Project CRUD 使用此欄位進行版本衝突檢查。

## 十一、M2-B Project CRUD API 架構

### 一、模組與職責

#### server/server.js

- 建立 Express 應用程式
- 啟用 JSON 解析
- 掛載 Project Router
- 提供健康檢查
- 提供靜態網站
- 處理 API 404
- 處理統一錯誤回應

#### server/project-routes.js

- 定義五個 REST API
- 驗證 HTTP 請求內容
- 驗證專案 ID
- 驗證 version
- 取得可信任的使用者身分
- 呼叫 Project Repository

#### server/project-repository.js

- 執行 SQLite Prepared Statements
- 建立專案
- 查詢專案
- 更新專案
- 刪除專案
- 檢查成員角色
- 執行 Transaction
- 檢查 version 衝突

#### tests/projects.test.js

- 建立記憶體測試資料庫
- 建立測試使用者
- 啟動隔離測試 HTTP Server
- 驗證 CRUD
- 驗證角色限制
- 驗證版本衝突
- 驗證錯誤回應

### 二、Project REST API

| Method | Endpoint          | 功能                       |
| ------ | ----------------- | -------------------------- |
| POST   | /api/projects     | 建立專案                   |
| GET    | /api/projects     | 取得使用者可存取的專案列表 |
| GET    | /api/projects/:id | 取得單一專案               |
| PATCH  | /api/projects/:id | 修改專案                   |
| DELETE | /api/projects/:id | 刪除專案                   |

### 三、API 資料流程

Client
→ Express
→ Project Router
→ 身分及請求驗證
→ Project Repository
→ SQLite Database
→ JSON Response

### 四、建立專案交易流程

1. 取得可信任的使用者身分。
2. 檢查使用者是否存在。
3. 開始 SQLite Transaction。
4. 新增 projects 記錄。
5. 新增 project_members Owner 關聯。
6. 成功則 Commit。
7. 失敗則 Rollback。
8. 回傳建立後的專案資料。

### 五、查詢限制

取得專案列表時，透過 project_members 關聯確認使用者參與的專案。

查詢指定專案時，必須同時符合專案 ID 及成員身分。

非成員不能查詢指定專案。

### 六、更新限制

只有 Owner 或 Admin 可以修改專案。

更新時必須提供目前 version。

資料庫更新成功後，version 增加 1。

若請求版本與資料庫目前版本不同，回傳 HTTP 409。

### 七、刪除限制

只有 Owner 可以刪除專案。

刪除時同樣檢查 version。

刪除成功回傳 HTTP 204。

成員關聯透過 SQLite 外鍵 ON DELETE CASCADE 清理。

### 八、主要 HTTP 狀態碼

| Status | 意義                   |
| ------ | ---------------------- |
| 200    | 查詢或修改成功         |
| 201    | 建立專案成功           |
| 204    | 刪除專案成功           |
| 400    | 請求資料不合法         |
| 401    | 使用者未登入           |
| 403    | 沒有操作權限           |
| 404    | 專案不存在或無存取權限 |
| 409    | version 版本衝突       |
| 413    | 請求內容過大           |
| 500    | 未預期的伺服器錯誤     |

### 九、正式伺服器安全邊界

M3 正式登入尚未完成。

正式 Server 沒有提供已驗證的使用者身分，因此 Project API 預設回傳 HTTP 401。

測試環境透過 createApp 的依賴注入機制提供測試使用者。

客戶端自行傳入 user_id 不會被視為正式驗證。

### 十、測試結果

- M1 Express：4
- M2-A SQLite：6
- M2-B Project CRUD：11
- 總計：21
- 通過：21
- 失敗：0

正式 HTTP 驗收：

- GET /api/projects：HTTP 401 PASS
- GET /api/health：HTTP 200 PASS

## 十二、目前架構限制與後續擴充

### 尚未完成

- 正式使用者登入
- 使用者註冊及登出
- 成員邀請及角色管理
- 完整 RBAC
- 真正任務資料表
- Task CRUD
- Kanban 拖曳更新
- Socket.IO 即時同步
- 留言、通知及活動紀錄
- 正式 Dashboard 資料分析
- 完整端對端驗收
- 公開部署

### 後續開發方向

M2-C：整合與持久化驗收

M3：Authentication

M4：Member Management / RBAC

M5：Task CRUD / Kanban

M6：Drag & Drop

M7：Socket.IO Real-time Collaboration

M8：Comments / Notifications / Activities

M9：Dashboard / Search / Filters

M10：Testing / Security / Release

## 十三、架構設計原則

1. SQLite 為正式資料的權威來源。
2. 身分驗證與權限檢查必須由後端負責。
3. SQL 查詢使用參數化語法。
4. 跨表資料操作使用 Transaction。
5. 透過 version 控制已實作的更新衝突。
6. 未經驗證的使用者不得操作正式專案 API。
7. API 與資料庫操作應保持清楚的責任分層。
8. 優先維持已通過測試的舊功能。
9. 每個主要開發批次進行自動化回歸測試。
10. 架構與功能擴充應避免不必要的大規模重寫。

---

## 十四、M2-C 整合驗收架構

### 測試模組

tests/integration.test.js

- SQLite 檔案持久化
- Transaction Rollback
- 外鍵與完整性約束
- WAL
- 兩連線版本衝突

tests/final-acceptance.test.js

- HTTP 持久化
- HTTP 異常輸入
- 未登入身分限制
- Worker Threads 並發更新

### 測試資料隔離

所有新測試使用記憶體或系統暫存 SQLite。

測試結束後關閉資料庫並清理暫存檔案。

正式 data/taskflow.db 不作為測試目標。

### 資料一致性

Project Repository 使用 Transaction 保護修改。

更新依賴 id 與 version 條件。

兩個 Worker 使用相同舊版本競爭時，
只允許其中一筆更新成功。

### 後續架構

M3 導入正式 Authentication。

M4 完成 RBAC。

M5～M7 擴充 Task CRUD、Kanban 及 WebSocket。

---

## 十五、M3-A Authentication Foundation

### 模組

server/auth-schema.sql

- auth_sessions 資料表
- 使用者外鍵
- Token Hash 主鍵
- Session 到期時間
- 查詢索引

server/auth-foundation.js

- AuthError
- initializeAuthSchema
- hashPassword
- verifyPassword
- createAuthRepository

tests/auth-foundation.test.js

- 帳號與密碼驗證
- Session 生命週期
- SQLite 持久化
- 資料完整性

### 密碼儲存

使用 scrypt 與隨機 Salt。

密碼不以明文形式儲存。

使用 timingSafeEqual 比對衍生金鑰。

### Session 資料

auth_sessions：

- token_hash：TEXT，Primary Key
- user_id：INTEGER，Foreign Key
- created_at：INTEGER
- expires_at：INTEGER

User 與 Session 為一對多關係。

刪除 User 時會連動清除相關 Session。

### Session 流程

1. 伺服器產生安全隨機 Token。
2. 計算 Token 的 SHA-256 雜湊。
3. 資料庫只保存雜湊。
4. 使用雜湊查詢有效 Session。
5. 到期或登出時使 Session 失效。

### M3-A 架構限制

目前只有 Authentication Repository。

正式 HTTP API、Cookie、CSRF 防護與
Project API 登入身分整合尚未實作。

auth_sessions 尚未加入正式 db:init 流程。

### 測試

M3-A：9/9 PASS。

完整回歸測試：42/42 PASS。

---

## 十六、M3-B Authentication HTTP API

### 模組責任

- `server/auth-foundation.js`：使用者、scrypt、Session Repository。
- `server/auth-schema.sql`：auth_sessions Schema 與索引。
- `server/auth-routes.js`：register/login/me/logout、Cookie、CSRF、來源驗證與限速。
- `server/server.js`：掛載 Authentication Router、Project Router、統一錯誤處理。
- `server/init-db.js`：初始化 M2 核心表及 auth_sessions。
- `tests/auth-api.test.js`：隔離的 HTTP 自動化測試。
- `scripts/accept-m3b.js`：連到本機正式 Server 的驗收工具。

### 正式請求流程

Client → Express JSON 與來源檢查 → Auth Router → Auth Repository → SQLite。
登入成功後以 HttpOnly、SameSite=Strict Cookie 保存 Session Token；資料庫只存雜湊。
GET /api/auth/me 以 Session 查出安全使用者資料及 CSRF Token。
Project Router 在正式模式透過 Session 取得 userId，寫入時檢查 X-TaskFlow-CSRF。
既有 M2 自動化測試仍可透過 createApp 的可信任測試身分注入進行隔離驗證。

### 安全邊界

- 登入錯誤時回傳一致的帳號／密碼錯誤訊息。
- 變更資料需通過 Session 與 CSRF；不接受客戶端 user_id 直接指定權限。
- 跨來源請求拒絕、JSON 大小限制、Session 撤銷及到期。
- 登入失敗記憶體計數僅適用單程序本機 MVP；跨程序或反向代理部署須重新設計。
- production Cookie 啟用 Secure，但 HTTPS、反向代理設定與安全稽核尚未實際驗證。

### 後續限制

M3-C 前端登入介面、完整 RBAC、任務 CRUD 與 WebSocket 尚未完成。
歷史章節提及「登入尚未開發」或「auth_sessions 尚未整合」是該階段的紀錄；以本章為目前後端實作狀態。

## M3-C1｜前端身分驗證整合（2026-11-16）

### Frontend

- `/auth.html` 提供註冊與登入表單。
- `auth.js` 呼叫註冊、登入 API。
- `dashboard-auth.js` 呼叫 `GET /api/auth/me`。
- 登入成功後導向 Dashboard。
- Dashboard 顯示登入者名稱、專案清單及登出功能。

### Authentication

- Session 由後端管理，瀏覽器使用 HttpOnly Cookie。
- 前端不將 Session Token 儲存至 localStorage。
- 專案寫入請求帶入 `X-TaskFlow-CSRF`。
- 真正的身分與權限檢查由 Express 後端執行。

### Database Integration

- `GET /api/projects` 取得使用者專案列表。
- `POST /api/projects` 建立正式 SQLite 專案。
- 原 M1 Kanban 任務卡片仍使用展示資料。

### Verification

- M3-C1 Smoke Tests：6/6 PASS。
- 全專案 Regression Tests：59/59 PASS。
- 前端導頁不是授權邊界，資料安全仍由 API 驗證。

## M3-C2｜瀏覽器 E2E 測試架構（2026-11-16）

### Testing Architecture
- Browser：Microsoft Edge，透過 Playwright Core 啟動。
- Runner：Node.js 內建 Test Runner。
- Entry：`e2e/auth-flow.e2e.js`。
- Command：`npm run test:e2e`。

### Isolation
- 使用 `createApp({ database: db })` 啟動獨立 Express。
- 使用 `openDatabase(":memory:")` 建立隔離 SQLite。
- 使用系統分配 Port，避免占用 3000。
- 以不同 BrowserContext 驗證 Session 隔離。
- 測試結束後關閉 Browser、Server 與 Database。

### Security Boundary
- HttpOnly Session Cookie 由瀏覽器管理。
- 後端負責驗證身分、CSRF 與專案權限。
- 前端導向登入頁不等於後端授權驗證。
- M3-C2 已通過 8/8 E2E，尚非正式部署安全稽核。
