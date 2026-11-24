# TaskFlow｜系統架構說明

<!-- TASKFLOW-M10A5A-DOCS-2026-11-24 -->

## M10-A5a｜CSP 基線及 Permissions-Policy（2026-11-24）

> 本階段僅擴充共用 Express 回應 Middleware，沒有修改應用授權流程、資料庫或前端任務狀態資料流。

- **位置：** `server/server.js` 的 `createApp()` 共用 Middleware；沿用 M10-A4 的 `nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy` 及 `/api` `Cache-Control: no-store`。
- **CSP 基線：** `base-uri 'self'` 限制 Base URL；`object-src 'none'` 禁止 Object 類型載入；`frame-ancestors 'none'` 限制嵌入；`form-action 'self'` 約束表單提交。`frame-ancestors` 在 HTTP 回應中設定，不以 HTML meta 取代。
- **Permissions-Policy：** `camera=(), microphone=(), geolocation=()`，不對未使用的敏感瀏覽器能力授權。
- **相容界線：** 尚未定義 `default-src`、`script-src`、`style-src`、`connect-src` 等完整資源來源政策，故不會因本節新增而封鎖既有頁面腳本、樣式或 Socket.IO 連線；其餘來源政策需另案分析並在正式部署環境驗證。
- **驗收方式：** `tests/security-policy.test.js` 以隔離 HTTP 應用檢查安全標頭及 API 行為；完整 Node 336/336、Microsoft Edge E2E 110/110 PASS 代表既定路徑正常，不能替代正式 CSP report-only／違規監測或 TLS 測試。
- **後續安全階段：** 登入防濫用、Session／Cookie、HTTPS／HSTS、可信代理、秘密管理和完整 CSP 相容性檢查仍為發版門檻。

---

<!-- /TASKFLOW-M10A5A-DOCS-2026-11-24 -->


<!-- TASKFLOW-M10A4-DOCS-2026-11-24 -->

## M10-A4｜Express HTTP 安全標頭 Middleware（2026-11-24）

> 在既有 TaskFlow Express 應用中增加回應標頭，不改動 Session、CSRF、RBAC、Socket.IO 或 SQLite 業務資料流。

- **全站回應：** `X-Content-Type-Options: nosniff` 降低 MIME 嗅探；`X-Frame-Options: DENY` 拒絕被嵌入 frame；`Referrer-Policy: strict-origin-when-cross-origin` 限制跨來源 Referrer 資訊。
- **API 回應：** 路徑為 `/api` 或以 `/api/` 開頭時設 `Cache-Control: no-store`，包含未登入的 401 與其他 API 狀態回應；首頁靜態資產快取策略不在本階段調整。
- **元件位置：** 共用 Middleware 在 `server/server.js` 的 `createApp()` 中註冊；在路由處理前執行，不依賴外部安全標頭套件。
- **測試方法：** `tests/security-headers.test.js` 使用 `createApp()` 建立臨時 HTTP 伺服器及隨機 Port，檢查回應標頭，不需初始化正式 SQLite。
- **尚未覆蓋：** CSP（含 Socket.IO `connect-src`）、HTTPS／HSTS、正式部署代理設定、登入速率限制、完整威脅模型與公開服務的滲透測試。上述內容仍屬 M10 待辦，不應由這三項標頭推論整站已達正式部署安全要求。

---

<!-- /TASKFLOW-M10A4-DOCS-2026-11-24 -->


<!-- TASKFLOW-M9C34-CLOSEOUT-2026-11-23 -->

## M9-C3 / M9-C4｜UI 支援邊界與發布風險（2026-11-23）

> 此節為範圍及技術風險紀錄，不新增架構元件。

- 已觀察桌面寬度的既有 Sidebar、表單、Analytics、Filter 和 Kanban 空狀態排版；沒有取得 768px、390px、320px 或鍵盤／讀屏驗收結論。
- `public/style.css` 包含 720px 以下隱藏 `.sidebar` 的響應式規則；尚未驗證同等可用的行動版導覽機制。這是待驗證風險，**不能等同已證實無法導航**。
- `public/index.html` 仍有 `M5-C1` 開發期版本標記；未於本階段修改。
- 保留既有 `Task REST → 授權讀取 → TaskBoard 完整任務 → Analytics / Filters / Kanban` 以及 Socket.IO 通知／重新抓取資料的架構；M9-C3／C4 不調整 Session／RBAC、REST、SQLite 或 UI 原始碼。
- M10 若選擇公開部署，必須針對支援裝置、使用者可達性及安全邊界重新檢查；在驗收之前不主張 WCAG 符合性或全裝置支援。

---

<!-- /TASKFLOW-M9C34-CLOSEOUT-2026-11-23 -->

<!-- TASKFLOW-M9C2-DOCS-2026-11-23 -->

## 最新架構驗收快照｜M9-C2 跨功能一致性（2026-11-23）

> 此段是測試與資料流驗收補充，不是產品架構重寫；既有 Session／RBAC、REST、Socket.IO、Kanban、M9-A Analytics、M9-B Filter 與 M9-C1 UX 均保留。

```text
Owner / Member 獨立 Session
     ├─→ Task REST 寫入／權限與版本檢查
     └─→ Socket.IO 專案 Room 變更通知
                     ↓
          受權限保護的 REST 重新讀取
                     ↓
                TaskBoard
       ├─→ 全量 tasks → Dashboard KPI
       └─→ 唯讀篩選 → Kanban 卡片與結果數量

跨專案切換：清理舊篩選條件／不混入其他專案資料
```

- `e2e/task-consistency.e2e.js` 以獨立資料庫、帳號和專案確認訊息與畫面的一致性；Socket 事件僅是刷新提示，任務實際資料仍由授權 REST 回傳。
- Dashboard 的計算基於完整任務清單，而非篩選後卡片數；跨專案切換須保留資料隔離。
- M9-C1 重試 E2E 在完整回歸遇到 Socket 背景刷新與模擬失敗的競態；修正點限於測試時序，測試腳本的暫時隔離不得被誤用為正式產品行為。
- 本階段未改動正式 SQLite schema、後端 API、Session／RBAC 或業務邏輯。

---

<!-- /TASKFLOW-M9C2-DOCS-2026-11-23 -->

<!-- TASKFLOW-M9C1-DOCS-2026-11-23 -->

## 最新架構快照｜M9-C1 Kanban UX（2026-11-23）

> 本節記錄 M9-C1 的顯示層增量；既有 M9-A Dashboard、M9-B 前端篩選、M7 Socket.IO 與 M5/M6 任務 API 維持原有資料流程。

```text
Session 驗證 → 現有 Project / Members / Tasks REST
    → public/task-board.js 的專案狀態與完整任務陣列
       ├─ M9-A analytics：全量統計，不受篩選影響
       ├─ M9-B filters：唯讀篩選後呈現卡片
       └─ M9-C1 UX：載入／錯誤重試／全空專案與空欄位回饋
                   ↓
            public/index.html + public/task-ux.css
```

- `task-board.js` 仍依既有 Session、CSRF 與 RBAC 執行 CRUD、狀態修改及拖放排序；M9-C1 不增加後端新端點、Socket 事件或 SQLite 欄位。
- UI 空狀態應區分：專案未選取／目前專案沒有任何任務／某一欄沒有任務／篩選條件無符合資料。重試動作僅重新取得既有 REST 資料。
- 背景刷新同一專案不得清空編輯中的表單；權限撤銷與真正的專案切換仍需清理舊資料。載入失敗不得保留可能失權的舊任務資料。
- `scripts/apply-m9c1.js` 僅供開發期間安全掛接，禁止視為正式伺服器啟動必備步驟；保留原檔備份與冪等驗證。
- M9-C2 與 M9-C3 尚需針對同步狀態一致性、響應式與鍵盤操作繼續驗收；M10 另處理部署／安全／效能。

---

<!-- /TASKFLOW-M9C1-DOCS-2026-11-23 -->

<!-- TASKFLOW-M9B-DOCS-2026-11-23 -->

## 最新架構快照｜M9-B Search & Multi-filter（2026-11-23）

> 本節覆蓋 M9-B 現行前端架構；下方各階段內容屬歷史快照。

```text
登入 Session → 現有 REST（projects / members / tasks）
  → public/task-board.js 的完整 state.tasks（授權的當前專案資料）
     ├─→ public/task-analytics.js → 全量 Dashboard KPI
     └─→ public/task-filters.js(filterTasks) → 顯示用任務子集 → Kanban DOM
```

- `public/task-filters.js` 為純函式：關鍵字、狀態、優先度、負責人交集篩選，保持來源陣列不變；不讀 Cookie、不發 API、不寫 SQLite。
- `public/task-board.js` 在 render 階段套用篩選；三欄 Kanban 顯示匹配項目、計數與空結果。原本 `state.tasks` 和 Dashboard 計數均維持完整清單。
- `public/index.html` 掛接工具列，`public/task-filters.css` 套用深色介面；`scripts/apply-m9b2.js` 僅供開發整合，非正式啟動流程。
- 篩選期間禁用拖放、原子排序與卡片狀態變更，防止 DOM 可見順序與 SQLite 全量 position 不一致。清除篩選後恢復管理操作；後端 Move API 保持不變。
- 同專案背景同步需保留進行中的表單內容；真正跨專案切換或撤銷權限時清除舊專案畫面與輸入。最新資料仍由授權 REST 取得，Socket 僅通知更新。
- 權限限制由原有後端 Session／CSRF／RBAC 執行，不因前端篩選而增加任何讀取權限。

### 尚未實作／發布條件

- 目前無伺服器端搜尋 API、跨專案全域搜尋、分頁或大型資料集索引；不要把前端篩選寫成後端權限篩選。
- M9-C 完整 UX、效能與多人操作整合；M10 HTTPS、部署安全、備份與 Release 仍待執行。

---

<!-- /TASKFLOW-M9B-DOCS-2026-11-23 -->

<!-- TASKFLOW-M9A-DOCS-2026-11-21 -->

## 最新架構快照｜M9-A Dashboard Analytics（2026-11-21）

> 本節描述 M9-A 已實作及依終端結果驗證的前端唯讀統計。下方 M0～M8 說明保留歷史時點，不應將舊「未實作」視為目前狀態。

### 資料流

```text
已授權 Session → 現有 Project / Task / Member REST API → Task Board state
    → public/task-analytics.js（前端唯讀彙總）
    → public/index.html 的統計區塊 + public/task-analytics.css
```

- 數據基於**目前選定專案**及既有 REST 返回的可見任務／成員資料；專案切換後重新計算、避免殘留上一專案統計。
- 統計項目包含完成率、逾期未完成、高優先未完成、未指派未完成與各成員工作量；不直接更新 `tasks`、`task_comments` 或 `project_activity`。
- `public/index.html` 與 `public/task-board.js` 採增量掛接，保留 M6 原生 HTML Drag & Drop、M7 即時同步、M8 留言／活動模組。
- 讀取權限仍由原有 Session／CSRF／RBAC 設計及既有 REST 決定；不應將前端統計視為新的伺服器授權機制。
- 本階段**未**增設資料庫 schema、migration、後端彙總端點或 Socket.IO 新事件。
- `scripts/apply-m9a.js` 為開發期掛接工具，不應作為正式伺服器執行流程。

### 仍待後續

- M9-B 搜尋、狀態／負責人／優先度等多條件篩選；M9-C UX 與整體整合驗收。
- M10 HTTPS、正式 Session／Cookie 設定、跨瀏覽器、壓測、安全稽核、部署與 GitHub Release。

---

<!-- /TASKFLOW-M9A-DOCS-2026-11-21 -->

<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

## 最新架構快照｜M8 留言／Activity／Socket.IO（2026-11-21）

> 以下描述 M8 **目前已交付且完成既定測試**的路徑。後文 M6／M7 及更早架構敘述為當時的階段紀錄；M9／M10 的產品化能力尚未完成。

### 資料與 HTTP 流程

1. `public/task-comments.js` 經由授權 REST API 讀取／建立／修改／軟刪除任務留言；`public/task-activity.js` 讀取專案活動時間軸（含分頁）。
2. `server/collaboration-routes.js` 處理 `/api/projects/:projectId/tasks/:taskId/comments` 及 `/api/projects/:projectId/activity` 路徑，沿用既有登入 Session、同源／CSRF 與角色授權流程。
3. `server/collaboration-repository.js` 使用 SQLite `task_comments` 與 `project_activity`，在同專案約束、版本驗證及交易語義下寫入留言；留言變更產生**不含正文**的活動 metadata。
4. 留言修改與刪除採 version 樂觀鎖；過期版本回覆 409，不把失敗寫入偽裝成成功事件。

### Socket.IO 事件流程（M8-C3）

```text
留言 REST 寫入成功 → res.locals 成功異動 metadata → HTTP finish 通知器
  → 已授權 project:<id> Socket Room → comment 變更提示（不含留言正文）
  → 已開啟的留言／Activity 介面經 REST 重新取得最新資料
```

- Room 由既有 `server/realtime-hub.js` 維持 Session、Origin、專案成員核驗；新 `comment` 類型不得越權或跨專案推送。
- Socket 事件只是失效提示（invalidation signal），**不直接作為頁面正文或資料庫更新來源**；斷線重連後重新訂閱並使用 REST 補抓。
- M7 既有 `task`、`member`、`project` 變更協議仍在；留言事件不應觸發不必要的整張 Kanban 重刷。
- 目前沒有耐久事件佇列／跨程序 adapter；不得宣告具備多節點可靠交付或完整審計能力。

### SQLite 結構與資料安全

- `task_comments`：`project_id`、`task_id`、`author_id`、`body`、`version`、`is_deleted`、建立／更新時間；使用觸發器防止將留言掛到其他專案的 Task。
- `project_activity`：`project_id`、`actor_id`、`task_id`、`comment_id`、`action`、建立時間；`action` 目前限 `comment_created`、`comment_updated`、`comment_deleted`。
- Schema 初始化採 `CREATE TABLE IF NOT EXISTS` 等增量方式；M8 開發曾先備份正式 SQLite，測試使用獨立 `:memory:` 資料庫。
- 當前驗收不涵蓋正式 HTTPS、跨網域部署、壓力／長期連線可靠性、其他瀏覽器或全面資安審核。

---

<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

<!-- M6-CURRENT-STATUS-2026-11-18 -->
## 最新架構快照｜M6（2026-11-18）

> 以下為目前有效的排序架構；本文件既有 M1～M5 篇章屬各階段歷史記錄。

`public/task-board.js` 的原生 HTML Drag & Drop → `PATCH /api/projects/:id/tasks/:taskId/move` → `server/task-order-routes.js` 的 Session／CSRF／RBAC 驗證 → `server/task-order-repository.js` 的 SQLite 交易與 version 409 檢查 → `tasks` 的 `status`／`position` 持久化。

Owner/Admin 可以使用拖放與排序；Member 只有既有受指派任務的狀態變更權限。衝突時重新載入後端資料。不包含 M7 WebSocket 即時推播。
<!-- /M6-CURRENT-STATUS-2026-11-18 -->

<!-- M5-CURRENT-STATUS-2026-11-17 -->
## 最新架構快照｜M5（2026-11-17）

> 下方早期章節包含 M1～M4 的歷史架構說明；正式任務架構以本快照及文末 M5 專章為準。

目前正式路徑為：瀏覽器中的 `public/index.html`／`public/task-board.js` → Express Session／CSRF／RBAC 驗證 → `server/task-routes.js` → `server/task-repository.js` → SQLite `tasks`。任務與專案、成員和 Session 共用既有資料庫結構；M5 採增量初始化，而非清空正式資料庫。

M6 Drag & Drop、M7 WebSocket、M8～M10 產品化功能尚未實作，不列入本次完成範圍。
<!-- /M5-CURRENT-STATUS-2026-11-17 -->


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

Project CRUD 已與前端專案清單整合，M4 亦新增成員管理頁及權限 API；正式任務看板仍使用示範資料。

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

M4 已建立成員管理、角色矩陣與版本驗證；具邀請接受／拒絕的完整流程尚未實作。

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

## 十二、M2 時點架構限制與後續擴充（歷史紀錄）

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

<!-- M4-SUMMARY-2026-11-17 -->
## M4｜Member Management 與 RBAC 實際架構（2026-11-17）

### Frontend

- public/dashboard-auth.js：提供成員管理入口。
- public/members.html：成員管理頁面結構。
- public/members.css：成員管理介面樣式。
- public/members.js：操作事件、API 請求與資料顯示。

### Backend

- server/server.js：掛載成員 Router，沿用 Authentication Middleware。
- server/member-routes.js：請求驗證與 HTTP 回應。
- server/member-repository.js：成員資料操作、角色權限及交易控制。

### 資料庫

使用既有核心資料表：

- users
- projects
- project_members
- auth_sessions

M4 並未新增 tasks 資料表。正式任務管理留待 M5。

### 成員管理 API

| 方法 | 路徑 | 功能 |
| --- | --- | --- |
| GET | /api/projects/:id/members | 查詢成員 |
| POST | /api/projects/:id/members | 新增成員 |
| PATCH | /api/projects/:id/members/:userId | 修改角色 |
| DELETE | /api/projects/:id/members/:userId?version=N | 移除或退出 |

### 權限控制

- Owner 可以管理成員與角色。
- Admin 可以依權限矩陣管理 Member。
- Member 只能查看成員及自行退出。
- 非成員不能取得指定專案的私人資料。
- Owner 不能透過一般成員管理 API 自行退出。
- 所有權限限制均由後端重新檢查。

### 資料一致性

- 新增、修改及移除成員使用 SQLite Transaction。
- projects.version 用於樂觀並發控制。
- 過期版本操作回傳 HTTP 409。
- 前端取得版本衝突後重新載入資料。
- 不採信客戶端提供的使用者身分欄位。

### 安全設計

- Session Cookie
- CSRF Token
- 同源要求
- 後端 RBAC 驗證
- 非成員資料隔離
- textContent 安全文字渲染

### 尚未實作

- 完整邀請接受、拒絕與到期流程。
- 正式 Task CRUD。
- Kanban 任務資料持久化。
- Socket.IO 即時同步。
- 完整正式部署安全稽核。

<!-- M5-SUMMARY-2026-11-17 -->
## M5｜正式任務管理架構（2026-11-17）

### 一、資料流程與模組職責

```text
Microsoft Edge / Browser Session
  └─ public/index.html + dashboard-auth.js + task-board.js + task-board.css
       └─ /api/projects/:id/tasks  (Express / task-routes.js)
            ├─ 伺服器端 Session 身分
            ├─ 同源 + CSRF（寫入）
            ├─ RBAC 與專案成員資格
            └─ task-repository.js
                 └─ node:sqlite → tasks / projects / project_members / users
```

- **Schema：** `server/task-schema.sql` 定義正式 `tasks` 資料表、關聯與約束。
- **Repository：** `server/task-repository.js` 封裝任務 CRUD、欄位驗證、Transaction、角色判斷、指派一致性及樂觀鎖定。
- **Initializer：** `server/init-db.js` 增量建立任務 Schema，已存在的正式資料與 Session 不因重新執行而清除。
- **Router：** `server/task-routes.js` 提供 HTTP 入口並串接既有 Authentication、CSRF 和 Project/Member 權限。
- **Frontend：** `public/task-board.js` 以 REST API 載入、更新三欄 Kanban；`public/index.html` 提供表單與專案選擇器；`public/task-board.css` 提供樣式。

### 二、API 契約與安全邊界

| HTTP | 路徑 | 用途 |
| --- | --- | --- |
| GET | `/api/projects/:id/tasks` | 取得授權專案的任務清單 |
| POST | `/api/projects/:id/tasks` | 建立任務 |
| PATCH | `/api/projects/:id/tasks/:taskId` | 更新任務欄位或狀態 |
| DELETE | `/api/projects/:id/tasks/:taskId` | 刪除任務 |

- 未登入請求不得讀取私人任務；非專案成員不得列出或修改專案任務。
- Owner/Admin 可依權限管理；Member 只能對自己受指派任務執行獲授權的狀態變更，不能任意編輯、建立或刪除。
- 寫入請求維持現有 CSRF、Same-Origin、資料格式和身分驗證；不可採信客戶端自行指定 Owner 身分。
- 過期 `version` 更新回傳 HTTP 409，不覆蓋較新資料；前端遇衝突時重新取得資料與版本。
- 任務負責人需為同一專案成員；使用者退出後，任務指派依 Repository 規則解除。
- 刪除專案應由 SQLite 外鍵連動處理任務清除；正式畫面以真實 SQLite 清單與統計為準。

### 三、資料與測試隔離

- 本機正式 SQLite：`data/taskflow.db`，由 `.gitignore` 的 `data/` 規則排除 Git 追蹤。
- M5-A 執行前已建立資料庫備份；`npm run db:init` 完成五張核心資料表（`users`、`projects`、`project_members`、`auth_sessions`、`tasks`）增量初始化。
- `tests/task-repository.test.js`、`tests/task-api.test.js`、`e2e/task-flow.e2e.js` 測試在隔離 SQLite 中驗證資料，E2E 採隨機 HTTP Port 與獨立 BrowserContext。
- M5 的多 Session E2E 不是 WebSocket 即時同步測試；即時跨瀏覽器推播屬 M7 待開發功能。

### 四、尚未實作範圍

Drag & Drop（M6）、WebSocket（M7）、留言／通知（M8）、分析／搜尋（M9）、正式 HTTPS／部署與完整安全測試（M10）仍列為後續工作。
<!-- /M5-SUMMARY-2026-11-17 -->

<!-- M6-SUMMARY-2026-11-18 -->
## M6｜Kanban 排序與拖放資料流（2026-11-18）

### 一、主要模組與責任

| 層級 | 模組 | 職責 |
| --- | --- | --- |
| Browser | `public/task-board.js` | HTML Drag & Drop、目標欄位與位置計算、操作權限、衝突後重新載入 |
| Styles | `public/task-board.css` | 拖放狀態與插入位置視覺回饋 |
| Router | `server/task-order-routes.js` | `PATCH .../move`、Session／CSRF／同源與授權驗證 |
| Repository | `server/task-order-repository.js` | 排序與跨欄移動交易、position 整理、版本及 RBAC 檢查 |
| DB | SQLite `tasks` | 持久化 `status`、`position`、`version` 與任務資訊 |

### 二、正式任務移動 API

`PATCH /api/projects/:id/tasks/:taskId/move`

- 請求以任務目前的 `version`、目標 `status` 與 `index` 表達一次移動／重排意圖。
- Owner/Admin 可依後端權限執行拖放排序；Member 不可排序或拖放，但仍保留自己受指派任務的既有授權狀態更新能力。
- 非成員、匿名、已登出與封存專案依原有政策拒絕寫入；後端不信任前端角色或身分宣告。
- 過期版本回傳 HTTP 409，不應覆蓋較新任務；前端須重新取得排序和版本資料。
- 同欄與跨欄位置依 Repository 交易進行持久化；前端不在伺服器成功前假定 SQLite 排序已提交。
- 原有 `PATCH /api/projects/:id/tasks/:taskId` 仍用於一般任務欄位及 Member 的授權狀態修改，不能一概替換。

### 三、資料一致性與測試邊界

- SQLite 由已存在的 M5 `tasks` 資料表維持持久化；M6 沿用 `position` 和 version 機制，未將正式資料重新初始化。
- API／Repository 在測試範圍內驗證交易原子性、排序連續性、跨欄移動與版本競爭。
- `tests/task-order-repository.test.js`、`tests/task-order-api.test.js`、`tests/task-drag-frontend.test.js` 與 `e2e/kanban-drag.e2e.js` 驗證不同層級。
- Edge E2E 採隔離測試資料庫、獨立 Session 與隨機埠；不需要以正式 SQLite 檔案作為測試資料。
- M6 是重新取得資料後的一致性處理，**不是**多使用者 WebSocket 即時推播；後者仍屬 M7。

### 四、後續限制

正式 HTTPS、反向代理、多節點部署、其他瀏覽器、長時間穩定性與完整安全稽核均未因 M6 測試通過而自動驗收。
<!-- /M6-SUMMARY-2026-11-18 -->

<!-- TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

## M7｜Socket.IO 即時事件與資料一致性（2026-11-19）

### 資料流

1. 瀏覽器透過 HttpOnly Session Cookie 與同源 WebSocket 建立 Socket.IO 連線。
2. `server/realtime-hub.js` 驗證 Session、Origin 與 `project_members`，只允許訂閱有權限的 `project:<id>` Room。
3. Task／Member／Project／Move Repository 成功完成 SQLite 寫入後，路由標註 `res.locals.taskflowRealtimeChange`。
4. `server/realtime-notifier.js` 只在成功 HTTP finish 後呼叫 `publishProjectChanged()`；非 2xx 不通知。
5. Hub 再查詢 Session 與成員資格；非成員離開 Room 並收到 `project:access-revoked`，有效成員只收到資源異動 metadata。
6. `public/task-realtime.js` 協調 `public/task-board.js` 重新讀取受權限保護的 REST API，不接受 Socket 內容直接覆寫 SQLite 資料。

### 故障與競爭策略

- Socket.IO 通知是「重新取得資料」提示，不是可靠佇列或資料庫事務；斷線重連後重新加入 Room 並透過 REST 補抓。
- M6 樂觀鎖 version 仍由 Repository 驗證，過期修改回傳 409；不允許 Socket.IO 越過 CSRF/RBAC 改寫資料。
- 前端編輯／拖曳或 REST 寫入中，暫緩外部刷新，避免局部狀態被不當覆蓋。
- Socket 發送前再次驗證成員及 Session，可降低長連線持有過期權限的風險。
- 不包含跨程序訊息中介、耐久事件佇列、正式反向代理與多節點 Socket.IO Adapter；這些仍待部署階段評估。

<!-- /TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

<!-- TASKFLOW-M10A5B1-2026-11-24 -->

### M10-A5b-1｜Auth Abuse Guard 與 Session Lifecycle

- `server/auth-routes.js` 建立 per-app `createAbuseGuard()`。
- Registration：IP 固定視窗（10 次／15 分鐘），在執行昂貴的 scrypt 前同步計數。
- Login：原本失敗限制改為 `failure + inFlight` 的同步預留名額；成功後清除失敗，錯誤時釋放名額。
- 記憶體限制：各策略最多 10,000 個 IP key，過期項目機會式清理，滿額時拒絕新來源。
- Session：初始化及已驗證流量中每小時最多呼叫一次 `pruneExpiredSessions()`；不建立持續運作的 Timer。
- Scope：單 Node 行程、本機 MVP；跨程序共用限流及代理部署設定保留後續階段。
