# TaskFlow｜產品更新日誌

本文件紀錄 TaskFlow 的功能新增、改善、修正與版本變更。

採累積式管理，保留重要歷史紀錄。

本專案尚未發布正式 v1.0.0，現階段變更統一記錄於 Unreleased。

## [Unreleased]

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
- 文件與 GitHub 同步待本批次提交。
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
