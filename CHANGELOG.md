# TaskFlow｜產品更新日誌

本文件紀錄 TaskFlow 的功能新增、改善、修正與版本變更。

採累積式管理，保留重要歷史紀錄。

本專案尚未發布正式 v1.0.0，現階段變更統一記錄於 Unreleased。

## [Unreleased]

<!-- M6-SUMMARY-2026-11-18 -->
### M6 — 2026-11-18｜Kanban Drag & Drop / Ordering

#### Added

- M6-A：Task Order Repository，支援同欄排序、跨欄狀態移動、position 重新編號、樂觀鎖與交易回滾。
- M6-B：新增 `PATCH /api/projects/:id/tasks/:taskId/move`，整合 Session Cookie、CSRF、RBAC、封存專案限制及 409 衝突處理。
- M6-C：三欄看板拖曳、放置位置提示、角色限制與資料重載。
- M6-D：四個獨立 Edge BrowserContext 的多人拖曳 E2E，涵蓋滑鼠拖放、持久化、跨欄、管理權限、版本競爭和封存限制。
- 將 Kanban Drag E2E 納入 `test:e2e:all`，並保留原有測試指令。

#### Fixed

- 排除真實滑鼠拖曳事件已進入 `drop` 但未發送 `/move` 請求的情況；經 Drag Event Trace 與卡片位置資訊定位後修正，M6-D 回歸 15/15 PASS。
- 修正 M5-C2 中 Owner 狀態更新 E2E 的兩處 `waitForResponse` 路徑，讓測試監聽新的 `/move` API；未放寬 HTTP 409／200 驗證。

#### Verified

- M6-A 11/11、M6-B 14/14、M6-C 9/9、M6-D 15/15 PASS。
- `npm test`：**171/171 PASS**。
- 四套 Microsoft Edge E2E 合併驗收：**52/52 PASS**，0 failed、0 skipped。
- `git diff --check` 未顯示格式錯誤；GitHub Commit／Push 以實際 SHA 和工作樹核對結果為準。

#### Remaining

- M7 Socket.IO 即時同步、M8 留言通知、M9 搜尋分析、M10 正式部署與安全／相容性驗收。
- 尚未發布正式 v1.0.0；自動化 PASS 不等於不存在任何程式缺陷。
<!-- /M6-SUMMARY-2026-11-18 -->

<!-- M5-SUMMARY-2026-11-17 -->
### M5 — 2026-11-17｜Task CRUD / Kanban / Multi-user E2E

#### Added

- M5-A：新增 `tasks` Schema、Repository 與增量資料庫初始化；保留既有專案、成員及 Session 資料。
- M5-B：新增正式 Task REST API（查詢、新增、修改、刪除），整合 Session、CSRF、RBAC 及 Version 409 衝突處理。
- M5-C1：正式任務表單、專案選擇器與 SQLite Kanban 看板；支援狀態、優先度、負責人、截止日期及排序位置。
- M5-C2：新增 Microsoft Edge 四身分端對端任務流程與合併 npm 測試指令。

#### Fixed

- 修正 `public/index.html` 意外串接兩份 HTML、舊版展示提示殘留的問題；保留正式看板 HTML，避免 DOM 重複及測試失敗。
- 修復首次建立時 `server/task-repository.js` 為空檔造成 `initializeTaskSchema is not a function` 的問題。

#### Verified

- M5-A：15/15；M5-B：20/20；M5-C1：8/8；M5-C2：14/14，均 PASS。
- `npm test`：137/137 PASS，0 FAIL；`npm run test:e2e:all`：37/37 PASS，0 FAIL。
- 實際瀏覽器操作：新增、顯示、切換狀態、重新整理、編輯、刪除皆已確認正常。
- E2E 使用記憶體 SQLite 與隨機埠；正式 `data/taskflow.db` 未作為測試目標。

#### Remaining

- 本批 Git Commit／Push 尚待最終檢查與執行；TaskFlow v1.0.0 尚未發布。
- M6 Drag & Drop、M7 WebSocket、M8 留言通知、M9 搜尋統計、M10 部署與 Release 尚未完成。
- 本次 PASS 只代表既定測試範圍，並非完整資安或正式部署認證。
<!-- /M5-SUMMARY-2026-11-17 -->


<!-- M4-SUMMARY-2026-11-17 -->
### M4 — 2026-11-17｜Member Management / RBAC

#### Added

- M4-A：Member Repository 與角色權限矩陣。
- M4-B：GET、POST、PATCH、DELETE 成員管理 API。
- M4-C1：成員管理介面與 Dashboard 入口。
- M4-C2：Microsoft Edge 多帳號瀏覽器端對端驗收。
- 新增 test:e2e:members、test:e2e:all 指令。

#### Verified

- M4-A：11/11 PASS。
- M4-B：18/18 PASS。
- M4-C1：6/6 PASS。
- M4-C2：15/15 PASS。
- 完整 Node.js 回歸：94/94 PASS。
- 合併 Edge E2E：23/23 PASS。
- Failed：0。

#### Security and Integrity

- 非專案成員資料隔離。
- Session Cookie 與 CSRF 保護。
- Owner 身分與權限限制。
- 舊版資料操作回傳 HTTP 409。
- SQLite Transaction 與資料一致性驗證。
- E2E 測試資料與正式 SQLite 隔離。

#### Remaining

- 完整邀請確認與到期機制。
- 正式任務 CRUD 與 Kanban 資料整合。
- WebSocket 即時同步。
- 正式部署安全與跨瀏覽器驗收。


### M3-C2 — 2026-11-16｜Edge Browser E2E

#### Added
- 新增 `playwright-core` 開發相依。
- 新增 `test:e2e` npm script。
- 新增 `e2e/auth-flow.e2e.js`。
- 建立 Microsoft Edge 真實瀏覽器驗收流程。

#### Verified
- E2E：8/8 PASS。
- Node.js Regression：59/59 PASS。
- 兩組測試皆 0 failed。
- 測試資料庫與正式 SQLite 隔離。

#### Remaining
- 正式 HTTPS、跨瀏覽器及部署安全驗證。
- 完整多人協作、RBAC 與任務 CRUD。

### M3-C1 — 2026-11-16｜Authentication Frontend

#### Added

- 新增註冊／登入 UI、表單驗證、錯誤與成功提示。
- 新增 Dashboard Session 檢查、登出流程及登入者名稱顯示。
- 新增 SQLite 專案列表及建立專案的前端 API 串接。
- 新增 `tests/frontend-auth.test.js` 前端 Smoke Tests。

#### Verified

- M3-C1 6/6 PASS。
- 全部回歸 59/59 PASS，0 failed。
- 使用者回報主要瀏覽器操作流程通過。

#### Notes

- M1 Kanban 仍為示範資料，正式任務 CRUD 留待 M5。
- 尚未完成正式 HTTPS、跨瀏覽器與自動化瀏覽器 E2E 驗收。


### M3-B — 2026-11-16｜Authentication HTTP API

#### Added

- 新增註冊、登入、登出及目前使用者查詢 API。
- 新增 Session Cookie（HttpOnly、SameSite=Strict；production 使用 Secure）。
- 新增 CSRF Token 驗證，保護受登入 Session 授權的寫入操作。
- 新增同來源請求檢查與 JSON 請求大小限制。
- 新增簡易的每 IP 登入失敗次數限制。
- 正式資料庫初始化加入 auth_sessions；Project CRUD 串接正式登入身分。
- 新增 M3-B 自動化測試及正式 HTTP 驗收腳本。

#### Verified

- M3-B：11/11 PASS；全專案：53/53 PASS，failed 0，skipped 0。
- 真實本機 Express Server：22/22 HTTP 驗收通過。
- 驗證 200、201、204、401、403、404、409 等預期狀態。
- SQLite 初始化成功建立四張主要資料表。

#### Notes

- 一度發生 `fetch failed`，經確認屬於本機 Server 監聽／終端機連線排查流程，調整後 HTTP 驗收全數通過。
- 本次 HTTP 測試留下隨機測試帳號，測試專案已刪除。
- 尚未加入前端登入介面，亦未完成正式部署級安全稽核。
- 程式與文件在同一批次提交；以 GitHub main Commit 作為最終版本紀錄。

### M3-A — 2026-11-16｜Authentication Foundation

#### Added

- 新增 auth_sessions 資料表及索引。
- 新增 Auth Repository。
- 新增帳號註冊與 Email 驗證。
- 新增 scrypt 密碼雜湊與驗證。
- 新增 Session 建立、查詢及撤銷功能。
- 新增 Session 過期清理。
- 新增 M3-A 自動化測試。

#### Security

- 使用隨機 Salt 與 scrypt。
- 不儲存明文密碼。
- Session Token 只儲存 SHA-256 雜湊。
- 回傳使用者資料不包含 password_hash。
- 保留外鍵及 Session 到期約束。

#### Testing

- M3-A：9/9 PASS。
- 完整回歸測試：42/42 PASS。
- Failed：0。
- Skipped：0。

#### Fixed

- 修正 auth-foundation.js 首行多餘字元
  引發的 JavaScript SyntaxError。
- 修正後重新執行語法檢查與完整測試。

#### Status

- M3-A 核心實作及測試完成。
- M3-A 已於 Commit 1f94ce7 完成文件與 GitHub 同步。
- 下一階段為 M3-B Authentication API。

### M2-C — 2026-11-16｜最終整合驗收

#### Added

- 新增 tests/integration.test.js。
- 新增 tests/final-acceptance.test.js。
- 加入 HTTP 持久化與異常輸入測試。
- 加入未登入身分冒用測試。
- 加入雙 Worker 並發版本衝突測試。

#### Testing

- M2-C：12/12 PASS。
- M1～M2-C：33/33 PASS。
- 測試失敗數：0。
- 使用獨立暫存 SQLite。

#### Status

- M2-C 核心測試已完成。
- M2-C 已於 Commit 878dfec 完成 GitHub 同步。
- 下一階段為 M3 Authentication。

### M2-B — 2026-11-15｜Project CRUD API

#### Added

- 建立 Project Repository 資料存取模組。
- 建立 Project REST API Router。
- 整合五個專案 CRUD API。
- 實作 POST /api/projects。
- 實作 GET /api/projects。
- 實作 GET /api/projects/:id。
- 實作 PATCH /api/projects/:id。
- 實作 DELETE /api/projects/:id。
- 建立專案時同步建立 Owner 成員關聯。
- 實作專案列表與單一專案查詢。
- 實作專案名稱、描述及狀態更新。
- 實作專案刪除。
- 加入使用者所屬專案的資料隔離。
- 加入 Owner、Admin、Member 基本角色限制。
- 加入 version 樂觀鎖。
- 加入 HTTP 409 版本衝突處理。
- 加入 JSON 請求驗證。
- 加入統一 API 錯誤回應。
- 建立 tests/projects.test.js。

#### Security

- 正式伺服器預設拒絕未登入的專案操作。
- 不接受客戶端自行指定 user_id 作為身分驗證。
- 測試環境以可信任函式注入測試使用者。
- 使用參數化 SQL 查詢。
- 專案讀取需具備成員資格。
- 專案修改僅允許 Owner 或 Admin。
- 專案刪除僅允許 Owner。
- 專案修改及刪除需要符合 version 條件。

#### Data Integrity

- 建立專案與 Owner 關聯使用同一個 Transaction。
- 資料庫操作失敗時執行 Rollback。
- 專案修改成功後增加版本號碼。
- 使用 HTTP 409 回報已偵測的版本衝突。

#### Testing

- 未登入存取拒絕：PASS。
- 初始空專案列表：PASS。
- 建立專案與 Owner 關聯：PASS。
- 專案列表及單筆查詢：PASS。
- 請求輸入驗證：PASS。
- 非成員存取拒絕：PASS。
- Member / Admin 操作限制：PASS。
- 舊版本更新衝突：PASS。
- Owner 刪除與版本檢查：PASS。
- 刪除後查詢與非法 JSON：PASS。
- M2-B 自動化測試：11/11 PASS，包含外層測試。
- M1、M2-A、M2-B 完整回歸測試：21/21 PASS。
- 自動化測試失敗數：0。
- GET /api/projects：HTTP 401 PASS。
- GET /api/health：HTTP 200 PASS。
- Express Server 啟動：PASS。
- 桌面版 Dashboard 顯示：PASS。

#### Documentation

- 更新 README 的 M2-B 功能與限制。
- 更新 Project API 技術架構。
- 累積 M2-B 開發及測試紀錄。
- 修正先前 Markdown 混入的操作教學內容。
- 更新 M2 階段開發計畫。

#### Status

- M2-B 核心程式已實作。
- M2-B 自動化及基本 HTTP 驗收已通過。
- M2-B 已於 Commit a20aa36 完成同步。
- 尚未提供正式登入與前端 Project CRUD 操作。
- 下一階段：M2-C 整合與持久化驗收。

### M2-A — 2026-11-15｜SQLite 資料庫基礎

#### Added

- 建立 users 資料表。
- 建立 projects 資料表。
- 建立 project_members 關聯表。
- 建立 server/schema.sql。
- 建立 server/db.js。
- 建立 server/init-db.js。
- 建立 tests/database.test.js。
- 加入 SQLite 外鍵約束。
- 加入 UNIQUE 與 CHECK 約束。
- 加入專案 version 欄位。
- 加入資料表查詢索引。
- 新增 npm run db:init 指令。
- 使用 Node.js 內建 node:sqlite。
- 檔案型資料庫採用 WAL 模式。
- 測試採用記憶體 SQLite 資料庫。

#### Testing

- SQLite 初始化：PASS。
- 重複初始化：PASS。
- 三張核心資料表及外鍵：PASS。
- 無效擁有者限制：PASS。
- 角色、唯一性及狀態限制：PASS。
- 專案刪除成員關聯清理：PASS。
- M1 Express 回歸測試：PASS。
- 自動化測試總計：10 passed、0 failed。
- SQLite 檔案 Git 忽略規則：PASS。

#### Status

- M2-A 核心開發與測試完成。
- 功能提交：d557020。
- GitHub Push：成功。
- 後續文件整理提交：113765c。
- 檔案型資料庫持久化及完整並發驗收留待 M2-C。

### M1 — 2026-11-15｜網站骨架與基本介面

#### Added

- 建立 Node.js 專案與 package.json。
- 安裝 Express 5。
- 建立 server/server.js。
- 建立 GET /api/health 健康檢查 API。
- 建立 public/index.html。
- 建立 public/style.css。
- 建立 public/app.js。
- 實作深色系 Dashboard。
- 建立三欄 Kanban 看板。
- 建立六筆示範任務。
- 實作任務數量統計。
- 加入響應式排版。
- 建立 tests/server.test.js。

#### Fixed

- 修正 npm init 後尚未設定測試指令的問題。
- 設定 npm start、npm run dev 及 npm test。

#### Testing

- Express 健康檢查：PASS。
- 首頁與靜態資源：PASS。
- 不存在的 API 回傳 404：PASS。
- M1 Express 測試群組：PASS。
- 自動化測試總結果：4 passed、0 failed。
- 桌面版 Dashboard：PASS。
- 六筆示範任務渲染：PASS。
- Kanban 三欄任務分類：PASS。
- Dashboard 統計 6、2、2：PASS。
- 手機響應式完整驗收：PENDING。
- 瀏覽器 Console 完整驗收：PENDING。

#### Documentation

- 建立 README 本機執行說明。
- 更新系統架構紀錄。
- 累積 M1 開發與問題修正歷程。
- 補充測試結果與後續驗收項目。

#### Status

- M1 網站核心程式與桌面版展示功能已完成。
- 首次功能提交：e4322a1。
- GitHub Push：成功。
- 後續文件提交：2d0d710、dceb225。
- 部分非核心瀏覽器驗收仍待補充。

### M0 — 2026-11-15｜專案初始化

#### Added

- 建立 TaskFlow 獨立專案目錄。
- 初始化本機 Git Repository。
- 設定 GitHub 遠端 Repository。
- 建立 docs、public、server 資料夾。
- 規劃專案文件管理架構。
- 確立 M0 至 M10 開發里程碑。

#### Documentation

- 建立 README.md。
- 建立 CHANGELOG.md。
- 建立 DEVELOPMENT_LOG.md。
- 建立 PROJECT_PLAN.md。
- 建立 ARCHITECTURE.md。
- 建立 TESTING.md。

#### Notes

- 本階段尚未開發正式網站功能。
- 首次正式版本預計為 v1.0.0。

#### M0 Finalization

- 完成首次 Git Commit（8c2a2e6）。
- 首次成功推送 main 至 GitHub。
- 建立 origin/main 遠端追蹤關係。
- 確認本機與遠端版本一致。
- 完成 M0 初始化與版本控制驗收。
- 更新 README、開發日誌、測試紀錄及專案進度。

---

## 版本管理原則

- 尚未發布的變更統一歸類於 Unreleased。
- 主要功能更新依 Milestone 記錄。
- CHANGELOG 保留重要歷史，不因新版本而刪除舊紀錄。
- 每個功能批次通過測試後，集中更新必要文件。
- 程式碼與文件原則上共同提交至 GitHub。
- 不為單純增加文件篇幅而重複建立 Commit。
- 正式發布 v1.0.0 時，再建立對應版本區段及 GitHub Release。

<!-- TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

### M7 — 2026-11-19｜Realtime collaboration / Socket.IO

#### Added

- Session 驗證及同源保護的 Socket.IO 專案 Room。
- Task、Member、Project 與 Move REST 成功寫入後的資源異動推播。
- 瀏覽器即時同步、斷線重訂閱與 REST 補抓；切換專案與編輯中延後刷新。
- M7-D Edge 協作韌性 E2E：平行 409 衝突、跨專案隔離、Member 撤權及 Session 登出保護。

#### Verified

- M7-A、M7-B、M7-C 專項測試及完整既有回歸已依本機執行結果通過。
- M7-D 須於正式結案前實際執行 `e2e/realtime-resilience.e2e.js`，並核對 0 failed、0 skipped。
- GitHub push／乾淨工作樹以實際 Commit SHA 和 `origin/main` 比對為準，不在本文件預填結果。

#### Remaining

- M8 通知／協作互動、M9 搜尋統計、M10 部署／安全／效能、正式 Release。

<!-- /TASKFLOW-M7-CLOSEOUT-2026-11-19 -->
