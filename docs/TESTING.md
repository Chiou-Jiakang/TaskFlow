# TaskFlow｜測試與驗證紀錄

本文件記錄測試項目、實際結果、
未通過項目與後續修正情況。

測試結果必須依據實際執行紀錄填寫。

## 2026-11-15｜M0 初始化檢查

### 已確認項目

| 項目                         | 結果 |
| ---------------------------- | ---- |
| TaskFlow 正式資料夾存在      | PASS |
| 本機 Git Repository 初始化   | PASS |
| GitHub origin 設定           | PASS |
| docs 資料夾存在              | PASS |
| public 資料夾存在            | PASS |
| server 資料夾存在            | PASS |
| VS Code 顯示 TaskFlow 資料夾 | PASS |

### 驗證依據

依據使用者提供的 PowerShell 與 VS Code 截圖。

### 尚未驗證

- 首次 Git Commit
- GitHub Push
- Node.js 專案初始化
- Express Server 啟動
- 網站介面
- REST API
- SQLite 資料庫
- 身分驗證
- 多人即時同步

### 備註

尚未開發的功能不列為測試通過。

本階段主要驗證本機專案結構與 Git 初始化。

---

## 2026-11-15｜M0 GitHub 同步驗收

| 測試項目                  | 結果 |
| ------------------------- | ---- |
| Git 暫存檔案檢查          | PASS |
| git diff --cached --check | PASS |
| 首次 Git Commit           | PASS |
| 首次 GitHub Push          | PASS |
| origin/main 追蹤設定      | PASS |
| 本機與遠端追蹤版本一致    | PASS |
| 工作目錄無待提交變更      | PASS |

### 驗證依據

使用者提供的 VS Code PowerShell 終端機截圖。

首次 Commit：8c2a2e6

### 結論

M0 初始版本控制與 GitHub 同步驗收通過。

本紀錄追加後的文件更新，
仍須另行 Commit、Push 及驗證。

M1 網站執行測試尚未開始。
