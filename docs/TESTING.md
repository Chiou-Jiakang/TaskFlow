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

---

## 2026-11-15｜M1 自動化測試紀錄

### 一、測試環境

- 專案：TaskFlow
- 階段：M1
- 工作目錄：C:\Projects\TaskFlow
- 測試工具：Node.js node:test
- 測試指令：npm test

### 二、初次執行問題

初次執行 npm test 時，
package.json 仍使用預設測試指令。

錯誤訊息：

Error: no test specified

判定：測試設定錯誤。

修正後重新執行測試。

### 三、修正後測試結果

| 測試項目         | 結果 |
| ---------------- | ---- |
| GET /api/health  | PASS |
| 首頁及靜態資源   | PASS |
| API 404 回應     | PASS |
| Express 測試群組 | PASS |

### 四、自動化測試統計

- tests：4
- pass：4
- fail：0
- cancelled：0
- skipped：0
- todo：0
- duration_ms：223.7354

註：4 個測試計數包含
1 個外層測試及 3 個子測試。

### 五、尚待驗收

| 測試項目                 | 狀態    |
| ------------------------ | ------- |
| npm run dev 正常啟動     | NOT RUN |
| 瀏覽器首頁可正常顯示     | NOT RUN |
| 六筆任務正確渲染         | NOT RUN |
| Kanban 各欄任務數量正確  | NOT RUN |
| Dashboard 統計為 6、2、2 | NOT RUN |
| 響應式介面               | NOT RUN |
| 瀏覽器 Console 錯誤檢查  | NOT RUN |
| GitHub M1 同步驗證       | NOT RUN |

### 六、驗證依據

使用者提供的 PowerShell 終端機截圖。

自動化測試結果：

4 passed，0 failed。

### 七、測試結論

Express 基礎功能測試通過。

尚不能據此認定整個 M1
已完成全部功能與介面驗收。
