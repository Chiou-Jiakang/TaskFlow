# TaskFlow｜產品更新日誌

本文件紀錄 TaskFlow 的功能新增、改善、修正與版本變更。

採累積式管理，保留重要歷史紀錄。

## [Unreleased]

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
- 瀏覽器介面驗收：PENDING。

#### Documentation

- 更新 README 本機執行說明。
- 更新系統架構紀錄。
- 累積 M1 開發與問題修正歷程。
- 補充測試結果與後續驗收項目。

#### Status

- M1 仍在驗收階段。
- 本階段尚未正式結案。
- M2 SQLite 與專案 CRUD 尚未開始。

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
