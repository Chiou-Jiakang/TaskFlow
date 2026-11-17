"use strict";

// TaskFlow M5 documentation updater — 2026-11-17
// Run from C:\Projects\TaskFlow using: node .\scripts\close-m5-docs.js
// Scope: six Markdown files only. No database, Git, API or production modifications.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const ROOT = process.cwd();
const MARK = "M5-SUMMARY-2026-11-17";
const CURRENT = "M5-CURRENT-STATUS-2026-11-17";
const files = [
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md",
  "docs/PROJECT_PLAN.md",
  "docs/TESTING.md",
];
const md = (str) => str.replaceAll("§", "`").trim();
const wrap = (text) => `<!-- ${MARK} -->\n${md(text)}\n<!-- /${MARK} -->`;
const topWrap = (text) => `<!-- ${CURRENT} -->\n${md(text)}\n<!-- /${CURRENT} -->`;

const latest = {
  "README.md": md(String.raw`
## 最新開發狀態｜M5 核心驗收通過（2026-11-17）

> 本節是目前狀態快照；下方 M0～M4 的既有文字保留其歷史時點，不應將早期「尚未實作」誤認為最新進度。

- **已完成核心驗收：** M0～M4；M5-A（Task Schema / Repository）、M5-B（Task REST API）、M5-C1（正式 Kanban 前端）、M5-C2（多人 Edge E2E）。
- **本次實測：** §npm test§ 為 137/137 PASS；§npm run test:e2e:all§ 為 37/37 PASS；失敗、跳過均為 0。這是兩組測試執行次數，不是 174 個獨立產品需求。
- **手動操作：** 已確認任務建立、看板呈現、狀態切換、重新整理後持久化、編輯和刪除。
- **正式資料：** 任務使用 SQLite §tasks§，看板不再以六張示範卡片作為正式任務資料。
- **版本狀態：** M5 文件與程式碼仍待 Git 檢查、Commit／Push；**尚未發布 TaskFlow v1.0.0**。
- **後續：** M6 Drag & Drop、M7 WebSocket 即時同步、M8 留言通知、M9 分析搜尋、M10 部署與發布驗收仍待開發。
- **整體進度：約 65%**，僅是依規劃範圍的粗略估計，不是精確的工程量度。
`),
  "docs/ARCHITECTURE.md": md(String.raw`
## 最新架構快照｜M5（2026-11-17）

> 下方早期章節包含 M1～M4 的歷史架構說明；正式任務架構以本快照及文末 M5 專章為準。

目前正式路徑為：瀏覽器中的 §public/index.html§／§public/task-board.js§ → Express Session／CSRF／RBAC 驗證 → §server/task-routes.js§ → §server/task-repository.js§ → SQLite §tasks§。任務與專案、成員和 Session 共用既有資料庫結構；M5 採增量初始化，而非清空正式資料庫。

M6 Drag & Drop、M7 WebSocket、M8～M10 產品化功能尚未實作，不列入本次完成範圍。
`),
  "docs/PROJECT_PLAN.md": md(String.raw`
## 最新里程碑狀態｜2026-11-17

- **M0～M4：** 已依各階段既定測試及 Git 紀錄結案。
- **M5-A～M5-C2：** 核心實作、Node.js 測試、Edge E2E 與手動任務操作均通過；**M5 最後文件及 GitHub 同步尚待完成**。
- **下一階段 M6：** Drag & Drop 任務拖曳及排序（未開始）。
- **M7～M10：** WebSocket、活動與通知、統計搜尋、發布驗收尚未開始。
- **整體 v1.0.0：約 65%**（規劃估計，非客觀測量）。

> 歷史章節保留當時的待辦文字，後續狀態以本節與文末 M5 結案摘要為準。
`),
  "docs/TESTING.md": md(String.raw`
## 最新驗收快照｜M5-C2（2026-11-17）

| 類別 | 已執行結果 | 說明 |
| --- | --- | --- |
| M5-A Repository | 15/15 PASS | Schema、RBAC、Transaction、Version、重啟持久化 |
| M5-B HTTP API | 20/20 PASS | Task CRUD、CSRF、Session、角色與版本驗證 |
| M5-C1 前端 | 8/8 PASS | 正式看板、表單接線、安全文字渲染 |
| M5-C2 Edge E2E | 14/14 PASS | 多身分、多 Session 的完整任務操作 |
| §npm test§ | **137/137 PASS** | 包含上述 Node.js 子群組；不可再累加 |
| §npm run test:e2e:all§ | **37/37 PASS** | 包含既有 23 與新增 14 個計數 |
| 人工瀏覽器驗收 | 6 項操作正常 | 新增、看板、狀態、重整、編輯、刪除 |

上述是**測試當次執行紀錄**，不能推論正式 HTTPS、其他瀏覽器、效能、WebSocket 或全部安全情境已驗證。
`),
};

const sections = {
  "README.md": String.raw`
## M5｜正式任務管理與 Kanban（2026-11-17）

### 已完成功能

- **M5-A｜Task Schema / Repository：** 增量建立 §tasks§ 資料表，保留 §users§、§projects§、§project_members§、§auth_sessions§ 與原有專案；包含任務欄位驗證、指派限制、刪除關聯、版本控制及資料持久化。
- **M5-B｜Task REST API：** §GET /api/projects/:id/tasks§、§POST /api/projects/:id/tasks§、§PATCH /api/projects/:id/tasks/:taskId§、§DELETE /api/projects/:id/tasks/:taskId§；沿用 Session Cookie、CSRF、同源政策、Owner/Admin/Member 權限與 409 版本衝突。
- **M5-C1｜正式看板：** 三欄「待處理／進行中／已完成」；依專案查詢 SQLite 資料；表單提供標題、描述、狀態、優先度、負責人、截止日期、排序位置；可依授權新增、修改、刪除及更新狀態。
- **M5-C2｜瀏覽器 E2E：** 四個獨立 Edge Session，驗證身分隔離、任務指派、Member 限權、Admin 編輯、資料持久化、409 衝突、刪除與登出失效。

### 主要檔案

| 範圍 | 檔案 |
| --- | --- |
| SQLite / Repository | §server/task-schema.sql§、§server/task-repository.js§、§server/init-db.js§ |
| REST API / Server | §server/task-routes.js§、§server/server.js§ |
| 前端 | §public/index.html§、§public/task-board.js§、§public/task-board.css§、§public/dashboard-auth.js§ |
| Node.js 測試 | §tests/task-repository.test.js§、§tests/task-api.test.js§、§tests/task-frontend.test.js§ |
| Edge E2E | §e2e/task-flow.e2e.js§ |

### 執行方式

§§§powershell
npm run db:init
npm run dev
§§§

另開終端機執行測試：

§§§powershell
npm test
npm run test:e2e:tasks
npm run test:e2e:all
§§§

### 驗收與界線

- M5-A：15/15 PASS；M5-B：20/20 PASS；M5-C1：8/8 PASS；M5-C2：14/14 PASS。
- 完整 Node.js 回歸：**137/137 PASS、0 FAIL**；合併 Microsoft Edge E2E：**37/37 PASS、0 FAIL**。
- 使用者已於瀏覽器手動核對任務新增、顯示、狀態變更、重新整理後持久化、編輯及刪除均正常。
- M5 的程式和文件尚待最後一次 Git Commit／Push；完成前不寫入不存在的 Git SHA 或 Release 版本。
- 尚未支援 Drag & Drop、WebSocket 即時推播、完整邀請確認、留言／通知、正式環境效能和安全稽核。
`,
  "CHANGELOG.md": String.raw`
### M5 — 2026-11-17｜Task CRUD / Kanban / Multi-user E2E

#### Added

- M5-A：新增 §tasks§ Schema、Repository 與增量資料庫初始化；保留既有專案、成員及 Session 資料。
- M5-B：新增正式 Task REST API（查詢、新增、修改、刪除），整合 Session、CSRF、RBAC 及 Version 409 衝突處理。
- M5-C1：正式任務表單、專案選擇器與 SQLite Kanban 看板；支援狀態、優先度、負責人、截止日期及排序位置。
- M5-C2：新增 Microsoft Edge 四身分端對端任務流程與合併 npm 測試指令。

#### Fixed

- 修正 §public/index.html§ 意外串接兩份 HTML、舊版展示提示殘留的問題；保留正式看板 HTML，避免 DOM 重複及測試失敗。
- 修復首次建立時 §server/task-repository.js§ 為空檔造成 §initializeTaskSchema is not a function§ 的問題。

#### Verified

- M5-A：15/15；M5-B：20/20；M5-C1：8/8；M5-C2：14/14，均 PASS。
- §npm test§：137/137 PASS，0 FAIL；§npm run test:e2e:all§：37/37 PASS，0 FAIL。
- 實際瀏覽器操作：新增、顯示、切換狀態、重新整理、編輯、刪除皆已確認正常。
- E2E 使用記憶體 SQLite 與隨機埠；正式 §data/taskflow.db§ 未作為測試目標。

#### Remaining

- 本批 Git Commit／Push 尚待最終檢查與執行；TaskFlow v1.0.0 尚未發布。
- M6 Drag & Drop、M7 WebSocket、M8 留言通知、M9 搜尋統計、M10 部署與 Release 尚未完成。
- 本次 PASS 只代表既定測試範圍，並非完整資安或正式部署認證。
`,
  "docs/ARCHITECTURE.md": String.raw`
## M5｜正式任務管理架構（2026-11-17）

### 一、資料流程與模組職責

§§§text
Microsoft Edge / Browser Session
  └─ public/index.html + dashboard-auth.js + task-board.js + task-board.css
       └─ /api/projects/:id/tasks  (Express / task-routes.js)
            ├─ 伺服器端 Session 身分
            ├─ 同源 + CSRF（寫入）
            ├─ RBAC 與專案成員資格
            └─ task-repository.js
                 └─ node:sqlite → tasks / projects / project_members / users
§§§

- **Schema：** §server/task-schema.sql§ 定義正式 §tasks§ 資料表、關聯與約束。
- **Repository：** §server/task-repository.js§ 封裝任務 CRUD、欄位驗證、Transaction、角色判斷、指派一致性及樂觀鎖定。
- **Initializer：** §server/init-db.js§ 增量建立任務 Schema，已存在的正式資料與 Session 不因重新執行而清除。
- **Router：** §server/task-routes.js§ 提供 HTTP 入口並串接既有 Authentication、CSRF 和 Project/Member 權限。
- **Frontend：** §public/task-board.js§ 以 REST API 載入、更新三欄 Kanban；§public/index.html§ 提供表單與專案選擇器；§public/task-board.css§ 提供樣式。

### 二、API 契約與安全邊界

| HTTP | 路徑 | 用途 |
| --- | --- | --- |
| GET | §/api/projects/:id/tasks§ | 取得授權專案的任務清單 |
| POST | §/api/projects/:id/tasks§ | 建立任務 |
| PATCH | §/api/projects/:id/tasks/:taskId§ | 更新任務欄位或狀態 |
| DELETE | §/api/projects/:id/tasks/:taskId§ | 刪除任務 |

- 未登入請求不得讀取私人任務；非專案成員不得列出或修改專案任務。
- Owner/Admin 可依權限管理；Member 只能對自己受指派任務執行獲授權的狀態變更，不能任意編輯、建立或刪除。
- 寫入請求維持現有 CSRF、Same-Origin、資料格式和身分驗證；不可採信客戶端自行指定 Owner 身分。
- 過期 §version§ 更新回傳 HTTP 409，不覆蓋較新資料；前端遇衝突時重新取得資料與版本。
- 任務負責人需為同一專案成員；使用者退出後，任務指派依 Repository 規則解除。
- 刪除專案應由 SQLite 外鍵連動處理任務清除；正式畫面以真實 SQLite 清單與統計為準。

### 三、資料與測試隔離

- 本機正式 SQLite：§data/taskflow.db§，由 §.gitignore§ 的 §data/§ 規則排除 Git 追蹤。
- M5-A 執行前已建立資料庫備份；§npm run db:init§ 完成五張核心資料表（§users§、§projects§、§project_members§、§auth_sessions§、§tasks§）增量初始化。
- §tests/task-repository.test.js§、§tests/task-api.test.js§、§e2e/task-flow.e2e.js§ 測試在隔離 SQLite 中驗證資料，E2E 採隨機 HTTP Port 與獨立 BrowserContext。
- M5 的多 Session E2E 不是 WebSocket 即時同步測試；即時跨瀏覽器推播屬 M7 待開發功能。

### 四、尚未實作範圍

Drag & Drop（M6）、WebSocket（M7）、留言／通知（M8）、分析／搜尋（M9）、正式 HTTPS／部署與完整安全測試（M10）仍列為後續工作。
`,
  "docs/DEVELOPMENT_LOG.md": String.raw`
## 2026-11-17｜M5 正式任務管理開發與驗收紀錄

### 一、M5-A｜Schema / Repository

1. 新增 §server/task-schema.sql§、§server/task-repository.js§、§tests/task-repository.test.js§，擴充 §server/init-db.js§。
2. 新增任務狀態、優先度、截止日期、排序、負責人與 version 欄位驗證；整合專案成員關係、Transaction 及 SQLite 外鍵。
3. 開發期間首次遇到 §initializeTaskSchema is not a function§。調查發現 §server/task-repository.js§ 為 **0 bytes**，故模組匯出為空；重新貼入完整程式並儲存後恢復正常。
4. 執行 §node --check§、Repository 獨立測試 **15/15 PASS**。於正式 DB 初始化前先備份 §data/taskflow.db§，再執行 §npm run db:init§，確認包含 §tasks§ 在內共五張核心資料表且不清除舊資料。

### 二、M5-B｜Task REST API

1. 新增 §server/task-routes.js§、§tests/task-api.test.js§，調整 §server/server.js§ 串接 REST API。
2. 實作任務查詢、新增、修改、刪除，以及 Session Cookie、CSRF、RBAC、version 409 與負責人範圍限制。
3. 獨立 HTTP API 測試 **20/20 PASS**；當時完整 Node.js 回歸為 **129/129 PASS**，既有 Edge E2E 為 **23/23 PASS**。

### 三、M5-C1｜正式 Task Kanban 前端

1. 新增 §public/task-board.js§、§public/task-board.css§、§tests/task-frontend.test.js§，修改 §public/index.html§ 與 §public/dashboard-auth.js§。
2. 實作專案選擇器、建立／編輯任務表單、任務狀態及優先度、指派、截止日期、三欄 Kanban 與 SQLite 統計。
3. 首次測試失敗：發現 §public/index.html§ 具有兩個 §<!doctype html>§、兩個專案建立表單，且舊版展示提示仍存在。先備份原始檔，再移除舊的 HTML 區段；重新檢查 DOM 標記：DOCTYPE 1、§</html>§ 1、專案表單 1、任務專案選擇器 1、展示提示 0。
4. 修復後 M5-C1 專屬測試 **8/8 PASS**；完整回歸 **137/137 PASS**；既有 Edge E2E **23/23 PASS**。
5. 使用者在瀏覽器實測新增任務、Kanban 呈現、狀態切換、重整後保留資料、編輯與刪除，六項均確認正常。

### 四、M5-C2｜多人 Edge E2E

1. 新增 §e2e/task-flow.e2e.js§，新增 §test:e2e:tasks§ 並擴充 §test:e2e:all§ npm 指令。
2. 使用隔離的記憶體 SQLite、隨機 Port 與四個獨立 Microsoft Edge BrowserContext 驗證 Owner、Admin、Member、非成員權限。
3. 測試涵蓋：建立專案與任務、Member 指派和狀態更新、Admin 編輯、409 樂觀鎖定、Owner 重讀／刪除、登出後存取拒絕及頁面錯誤。
4. M5-C2 專屬測試 **14/14 PASS**；§npm test§ **137/137 PASS**；§npm run test:e2e:all§ **37/37 PASS**；均 0 failed、0 skipped。

### 五、Git 安全確認與結案狀態

- §.gitignore§ 中 §data/§ 規則有效，§git check-ignore -v data/taskflow.db§ 已確認正式資料庫被忽略；當時 §git ls-files -- data/ .env§ 未列出已追蹤的資料檔。
- §git diff -- package.json§ 顯示既有測試指令保留並新增 Task E2E；LF／CRLF 提示只是格式警告。
- 截至本份文件更新前，M5 的程式與文件尚未完成最終 Git Commit／Push；**不填造新的 Commit SHA**。
- 下一步：審查本次六份文件、確認暫存清單不含 SQLite／密鑰、全套回歸、再集中 Commit／Push，最後驗證 §HEAD§ 與 §origin/main§ 完全一致。
- 未完成功能：M6 Drag & Drop、M7 WebSocket、M8 留言與通知、M9 Dashboard 搜尋統計、M10 部署級安全與 Release。
`,
  "docs/PROJECT_PLAN.md": String.raw`
## M5｜任務管理完成情況與正式結案條件（2026-11-17）

### 實際完成範圍

| 子階段 | 交付成果 | 驗收結果 | 狀態 |
| --- | --- | --- | --- |
| M5-A | Task Schema、Repository、增量初始化 | 15/15 PASS | 核心完成 |
| M5-B | Task REST API、Session／CSRF／RBAC／409 | 20/20 PASS | 核心完成 |
| M5-C1 | 正式任務看板、表單、權限及資料持久化 | 8/8 PASS + 六項手動操作 | 核心完成 |
| M5-C2 | 四個 Edge Session 的多人任務操作 | 14/14 PASS | 核心完成 |
| M5 整體回歸 | Node.js 137/137；Edge 37/37 | 0 fail，0 skipped | 核心驗收通過 |
| M5 文件與 Git | 六份文件、最後 Diff、Commit、Push | 尚待執行／確認 | 待結案 |

### M5 最終結案核對表

- [x] Task Schema、Repository 與 REST API 實作。
- [x] SQLite 增量初始化且保留既有資料。
- [x] 完成正式 Task Kanban、狀態、指派、優先度、日期及版本處理。
- [x] 完成 Node.js 全套回歸 137/137。
- [x] 完成 Edge E2E 37/37。
- [x] 完成六項手動任務操作驗收。
- [ ] 六份文件集中更新後執行內容與 Git Diff 審查。
- [ ] 暫存檔案安全檢查（不提交 SQLite、§.env§、密鑰或備份）。
- [ ] M5 Git Commit／Push 及本機、§origin/main§ SHA 核對。

以上未勾項目必須於完成後再人工更新，不可因產生本次文件就預先標記 PASS。

### 後續里程碑

1. M6：Drag & Drop、排序及後端權限一致性驗證。
2. M7：WebSocket 多使用者即時資料同步及版本競爭處理。
3. M8：留言、通知及活動紀錄。
4. M9：統計、搜尋、過濾與介面改善。
5. M10：正式部署、HTTPS、效能、安全、跨瀏覽器與版本發布驗收。

TaskFlow v1.0.0 **尚未正式發布**。整體工作量目前估計約完成 65%，屬規劃判斷而非精準進度計量。
`,
  "docs/TESTING.md": String.raw`
## 2026-11-17｜M5 實際驗收總結

### 一、測試環境與執行結果

| 分類 | 指令或方式 | 實際結果 |
| --- | --- | --- |
| M5-A Repository | §node --test .\tests\task-repository.test.js§ | 15/15 PASS |
| M5-B HTTP API | §node --test .\tests\task-api.test.js§ | 20/20 PASS |
| M5-C1 Frontend | §node --test .\tests\task-frontend.test.js§ | 8/8 PASS |
| M5-C2 Edge E2E | §node --test .\e2e\task-flow.e2e.js§ | 14/14 PASS |
| 全專案 Node.js | §npm test§ | **137/137 PASS** |
| 三套 Edge 合併 | §npm run test:e2e:all§ | **37/37 PASS** |
| 瀏覽器手動驗收 | Task Kanban 六項操作 | 6 項結果正常 |

- 全套回歸及 Edge E2E 均為 0 failed、0 cancelled、0 skipped、0 todo。
- **統計注意：** M5-A/B/C1 是 §npm test§ 的子群組，M5-C2 是 37 項 Edge E2E 的一部分；不可把以上每一列相加當成獨立測試數量。
- 本次兩次完整測試執行分別為 137 與 37；合計 174 次測試計數，但不代表 174 項完全不同的需求。

### 二、M5-A / M5-B 範圍

- 非專案成員不可讀取與改寫任務；Owner/Admin/Member 分權。
- Member 只能更改自己受指派任務的授權狀態。
- 新增、更新、刪除及指派、欄位格式、日期、狀態、優先度、position 驗證。
- SQLite Foreign Key、Transaction、Rollback、資料遷移與重啟持久化。
- §version§ 樂觀鎖定：過期更新 HTTP 409，不覆蓋當前資料。
- Session Cookie、同源、CSRF、錯誤 JSON、HTTP 400/401/403/404/409 等驗證。

### 三、M5-C1 / M5-C2 範圍

- 三欄正式 Kanban 與 Task API 接線，專案選擇、表單輸入、安全渲染和角色限制。
- **手動瀏覽器操作六項：** 建立任務、顯示看板、更新狀態、F5 重整持久化、編輯、刪除；使用者已逐項確認正常。
- **Edge 自動化：** 四身分獨立 Session、Owner 指派、Member 更改受指派任務狀態、Admin 編輯、過期版本 409、Owner 重讀與刪除、Member 登出後 Session 不可再存取，以及頁面錯誤檢查。
- E2E 使用 SQLite §:memory:§ + 隨機 Port + 獨立 BrowserContext；並未以正式 §data/taskflow.db§ 作為測試資料庫。

### 四、故障與處理紀錄

1. §server/task-repository.js§ 曾因空檔造成 §initializeTaskSchema is not a function§；重新貼入完整匯出程式後通過 15/15。
2. §public/index.html§ 曾包含兩份 HTML，使前端 smoke test 不通過，既有 Edge E2E 亦發生連帶失敗；備份原檔後保留新版 HTML，再次驗證 DOCTYPE、表單及選擇器數量，最終 8/8、137/137、23/23 全通過。
3. 新增 M5-C2 E2E 後，最終合併瀏覽器驗收 37/37 PASS，未再發現未處理 JavaScript 頁面錯誤。

### 五、尚待測試（NOT RUN／後續）

- M6 Drag & Drop 真實拖曳及排序競爭。
- M7 WebSocket 即時跨瀏覽器推播與斷線恢復。
- 完整邀請核准、留言、通知、統計與搜尋等後續功能。
- 正式 HTTPS、反向代理、部署環境權限、壓力／長時間穩定性、跨瀏覽器相容性、完整安全稽核。
- M5 GitHub Commit／Push 成功與工作樹乾淨，需要在實際執行後才可登記 PASS。

### 六、驗收結論

M5-A～M5-C2 的**既定功能與測試**通過，可進行六份文件最後檢查與 Git 結案；上述 PASS 不保證所有可能的故障或安全問題都已排除。
`,
};

function newlineFor(content) {
  return content.includes("\r\n") ? "\r\n" : "\n";
}
function inEol(text, eol) {
  return text.replace(/\r\n|\n|\r/g, eol);
}
function addCurrent(src, content, filepath) {
  if (!latest[filepath]) return src;
  const h = /^# [^\r\n]+(?:\r?\n)/m.exec(src);
  if (!h) throw new Error(`${filepath}: 找不到 H1，停止修改`);
  const pos = h.index + h[0].length;
  const eol = newlineFor(src);
  return src.slice(0, pos) + eol + inEol(topWrap(content) + "\n", eol) + eol + src.slice(pos);
}
function addSection(src, newSection, filepath) {
  const eol = newlineFor(src);
  const block = inEol(wrap(newSection), eol);
  if (filepath === "CHANGELOG.md") {
    const index = src.indexOf("## [Unreleased]");
    if (index < 0) throw new Error("CHANGELOG.md: 找不到 ## [Unreleased]");
    const rest = src.slice(index);
    const m = /\r?\n/.exec(rest);
    if (!m) throw new Error("CHANGELOG.md: Unreleased 格式異常");
    const pos = index + m.index + m[0].length;
    return src.slice(0, pos) + eol + block + eol + eol + src.slice(pos);
  }
  return src.replace(/\s*$/, "") + eol + eol + block + eol;
}

function processContent(src, filepath) {
  let next = addCurrent(src, latest[filepath], filepath);
  next = addSection(next, sections[filepath], filepath);
  if (filepath === "README.md") {
    next = next.replace("- M5～M10：尚未開始。", "- M5：核心功能與測試已通過，待 Git 結案；M6～M10：尚未開始。")
      .replace("正式邀請核准、任務管理與多人即時同步仍待實作。", "正式邀請核准、拖曳操作與多人即時同步仍待實作；正式任務管理已於 M5 核心驗收通過。")
      .replace("- Kanban 六張卡片仍為示範資料；正式 Task CRUD 排定於 M5。", "- M4 當時的 Kanban 六張卡片為示範資料；正式 Task CRUD 已於 M5 實作。")
      .replace("M5～M10：尚未開始。", "M5 已完成核心驗收，M6～M10 尚未開始。");
  }
  if (filepath === "docs/PROJECT_PLAN.md") {
    next = next.replace(/^\|\s*M5\s*\|[^\r\n]*$/m,
      "| M5   | 任務 CRUD 與 Kanban 看板 | 核心功能與測試通過，待 Git 最終結案 |")
      .replace(/(## 十二、M5｜任務 CRUD 與 Kanban[\s\S]*?### 狀態\s*)(尚未開始。)/,
        "$1M5-A～M5-C2 核心實作及測試已通過；六份文件整理與 Git 最終結案待完成。")
      .replace("- 正式任務 CRUD 尚未實作。", "- M4 當時正式任務 CRUD 尚未實作；已於 M5 完成。");
  }
  return next;
}

function main() {
  const pkgFile = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkgFile) || JSON.parse(fs.readFileSync(pkgFile, "utf8")).name !== "taskflow") {
    throw new Error("請先 cd C:\\Projects\\TaskFlow，再執行本程式。未修改任何檔案。");
  }

  const originals = new Map();
  for (const name of files) {
    const full = path.join(ROOT, name);
    if (!fs.existsSync(full)) throw new Error(`缺少 ${name}；未修改任何檔案。`);
    originals.set(name, fs.readFileSync(full, "utf8"));
  }

  const done = files.filter(name => originals.get(name).includes(`<!-- ${MARK} -->`));
  if (done.length === files.length) {
    console.log("M5 六份文件已經更新過，為避免重複寫入，本次不修改。", ...done);
    return;
  }
  if (done.length > 0 || files.some(name => originals.get(name).includes(`<!-- ${CURRENT} -->`))) {
    throw new Error(`發現部分 M5 標記（${done.join(", ") || "current-status"}），為避免破壞舊資料，已停止修改；請先人工檢查。`);
  }

  const changes = new Map();
  for (const name of files) {
    const updated = processContent(originals.get(name), name);
    if (updated === originals.get(name)) throw new Error(`${name} 未產生實際變更，已停止。`);
    if (!updated.includes(`<!-- ${MARK} -->`) || !updated.includes(`<!-- /${MARK} -->`)) {
      throw new Error(`${name} 缺少完整 M5 標記，已停止。`);
    }
    changes.set(name, updated);
  }

  const dirname = path.join(os.tmpdir(), `TaskFlow-M5-docs-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`);
  fs.mkdirSync(dirname, { recursive: true });
  for (const name of files) {
    const destination = path.join(dirname, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, name), destination);
  }
  console.log(`已先備份六份原始文件：${dirname}`);

  for (const [name, updated] of changes) {
    const full = path.join(ROOT, name);
    const temp = full + ".m5-docs.tmp";
    fs.writeFileSync(temp, updated, "utf8");
    fs.renameSync(temp, full);
    console.log(`已更新：${name}（新增 M5 區段、保留舊紀錄）`);
  }
  console.log("六份文件更新完成。尚未 Git Commit／Push。請先檢查 git diff --check 與 git diff --stat。");
}

try { main(); } catch (error) { console.error(`M5 文件更新中止：${error.message}`); process.exitCode = 1; }
