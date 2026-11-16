# TaskFlow｜測試與驗證紀錄

本文件記錄 TaskFlow 各階段的測試項目、實際結果、未通過項目及後續修正情況。

所有測試結果必須依據實際執行紀錄填寫，不得以預期結果取代真實測試。

## 測試結果狀態定義

| 狀態    | 意義                   |
| ------- | ---------------------- |
| PASS    | 已執行且驗證通過       |
| FAIL    | 已執行但未通過         |
| NOT RUN | 尚未執行或尚無充分證據 |
| PENDING | 已規劃但尚待完成驗收   |

歷史紀錄保留當時的測試狀態。

最新驗證結果以文件最後的測試紀錄及總結為準。

---

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

依據 PowerShell 與 VS Code 截圖。

### 當時尚未驗證

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

VS Code PowerShell 終端機截圖。

首次 Commit：

`8c2a2e6`

### 結論

M0 初始版本控制與 GitHub 同步驗收通過。

在此階段完成時，M1 網站執行測試尚未開始。

---

## 2026-11-15｜M1 自動化測試紀錄

### 一、測試環境

- 專案：TaskFlow
- 階段：M1
- 工作目錄：C:\Projects\TaskFlow
- 測試工具：Node.js node:test
- 測試指令：npm test

### 二、初次執行問題

初次執行 npm test 時，package.json 仍使用預設測試指令。

錯誤訊息：

`Error: no test specified`

判定：測試指令尚未設定。

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

註：4 個測試計數包含 1 個外層測試及 3 個子測試。

### 五、初次尚待驗收項目

| 測試項目                 | 當時狀態 |
| ------------------------ | -------- |
| npm run dev 正常啟動     | NOT RUN  |
| 瀏覽器首頁可正常顯示     | NOT RUN  |
| 六筆任務正確渲染         | NOT RUN  |
| Kanban 各欄任務數量正確  | NOT RUN  |
| Dashboard 統計為 6、2、2 | NOT RUN  |
| 響應式介面               | NOT RUN  |
| 瀏覽器 Console 錯誤檢查  | NOT RUN  |
| GitHub M1 同步驗證       | NOT RUN  |

### 六、驗證依據

PowerShell 終端機截圖。

自動化測試結果：

4 passed，0 failed。

### 七、當時測試結論

Express 基礎功能測試通過。

當時尚不能據此認定整個 M1 已完成全部功能與介面驗收。

---

## 2026-11-15｜M1 網站與 GitHub 補充驗收

### 一、網站驗收

| 測試項目             | 結果 |
| -------------------- | ---- |
| npm run dev 正常啟動 | PASS |
| Express HTTP Server  | PASS |
| Dashboard 桌面版顯示 | PASS |
| 六筆示範任務渲染     | PASS |
| 三欄 Kanban 顯示     | PASS |
| 待處理任務 2 筆      | PASS |
| 進行中任務 2 筆      | PASS |
| 已完成任務 2 筆      | PASS |
| 全部任務統計為 6     | PASS |
| 進行中統計為 2       | PASS |
| 已完成統計為 2       | PASS |

### 二、GitHub 驗收

| 測試項目                 | 結果 |
| ------------------------ | ---- |
| M1 功能 Commit           | PASS |
| GitHub Push              | PASS |
| main 與 origin/main 同步 | PASS |

首次 M1 功能提交：

`e4322a1`

後續文件提交：

`2d0d710`

`dceb225`

### 三、尚未完成項目

| 項目                        | 狀態    |
| --------------------------- | ------- |
| 手機寬度下的完整響應式驗收  | NOT RUN |
| 瀏覽器 Console 完整錯誤檢查 | NOT RUN |

### 四、結論

M1 核心程式、桌面版看板及 GitHub 版本同步已通過驗證。

部分瀏覽器相關驗收留待後續補齊。

---

## 2026-11-15｜M2-A SQLite 測試驗收

### 一、測試項目

| 測試項目                 | 結果    |
| ------------------------ | ------- |
| SQLite 初始化            | PASS    |
| 重複初始化               | PASS    |
| 三張資料表及外鍵         | PASS    |
| 非法擁有者限制           | PASS    |
| 角色、唯一性與狀態限制   | PASS    |
| 專案刪除成員關聯清理     | PASS    |
| M1 回歸測試              | PASS    |
| SQLite 檔案 Git 忽略規則 | PASS    |
| 檔案重啟持久化測試       | NOT RUN |

### 二、自動化測試結果

- M1 Express：4
- M2-A SQLite：6
- tests：10
- pass：10
- fail：0
- cancelled：0
- skipped：0
- todo：0

初次成功測試：

- duration_ms：303.3564

後續重新執行：

- duration_ms：254.6897
- tests：10
- pass：10
- fail：0

### 三、SQLite 初始化結果

執行指令：

`npm run db:init`

建立資料表：

- users
- projects
- project_members

結果：PASS。

再次執行初始化：

結果：PASS。

### 四、Git 忽略規則

執行：

`git check-ignore -v data/taskflow.db`

結果顯示：

`.gitignore:11:data/`

判定：PASS。

SQLite 資料檔案不會被一般 git add -A 納入版本控制。

### 五、GitHub 版本驗證

- Commit：d557020
- GitHub Push：PASS
- Branch：main
- 後續文件提交：113765c
- 版本同步：PASS

### 六、驗收依據

VS Code PowerShell 終端機截圖。

### 七、結論

M2-A SQLite 資料庫核心、外鍵與基本資料約束已通過現有測試。

但尚未完成檔案型資料庫重啟持久化及完整並發操作驗收。

---

## 2026-11-15｜M2-B Project CRUD API 驗收

### 一、測試環境

- 專案：TaskFlow
- 階段：M2-B
- 工作目錄：C:\Projects\TaskFlow
- Node.js：v24.15.0
- Backend：Express 5
- Database：SQLite
- 測試工具：Node.js node:test
- 測試指令：npm test

測試使用記憶體 SQLite 資料庫及隔離的本機 HTTP Server。

測試使用者資料不會寫入正式的 taskflow.db。

### 二、自動化測試結果

執行：

`npm test`

| 測試類別                 | 通過計數 |
| ------------------------ | -------- |
| M1 Express Smoke Tests   | 4        |
| M2-A SQLite Schema Tests | 6        |
| M2-B Project CRUD API    | 11       |
| 總計                     | 21       |

完整統計：

- tests：21
- suites：0
- pass：21
- fail：0
- cancelled：0
- skipped：0
- todo：0
- duration_ms：344.72

M2-B 的 11 個計數包含 1 個外層測試群組與 10 個子測試。

### 三、Project CRUD 測試項目

| 測試項目                        | 結果 |
| ------------------------------- | ---- |
| 未登入時不可操作專案            | PASS |
| 專案列表初始為空                | PASS |
| 建立專案並自動建立 Owner 成員   | PASS |
| 可讀取自己的列表與單一專案      | PASS |
| 輸入驗證與拒絕客戶端指定 Owner  | PASS |
| 只有成員可以讀取專案            | PASS |
| Member 不可修改；Admin 可以修改 | PASS |
| 舊版本更新會收到 409 衝突       | PASS |
| 刪除僅限 Owner，且檢查 version  | PASS |
| 刪除後為 404，畸形 JSON 為 400  | PASS |

### 四、Project API 測試涵蓋功能

- POST /api/projects
- GET /api/projects
- GET /api/projects/:id
- PATCH /api/projects/:id
- DELETE /api/projects/:id
- 專案資料查詢限制
- 角色操作限制
- version 版本衝突
- JSON 請求驗證
- HTTP 錯誤回應
- Owner 成員關聯建立
- 專案刪除後的關聯清理

### 五、正式 HTTP API 驗收

#### 測試 A：未登入的專案 API

執行：

`curl.exe -i http://localhost:3000/api/projects`

預期：

HTTP 401 Unauthorized

實際：

HTTP 401 Unauthorized

回傳 JSON：

```json
{
  "error": "UNAUTHENTICATED",
  "message": "請先登入。"
}
```

結果：PASS。

#### 測試 B：健康檢查 API

執行：

`curl.exe -i http://localhost:3000/api/health`

預期：

HTTP 200 OK

實際：

HTTP 200 OK

回傳 JSON：

```json
{
  "service": "TaskFlow",
  "status": "ok",
  "milestone": "M1"
}
```

結果：PASS。

註：milestone 欄位維持 M1，是為保留原有健康檢查 API 契約。

### 六、Express Server 啟動

執行：

`npm run dev`

終端機顯示：

```text
TaskFlow | M2-B
Server: http://localhost:3000
Health: http://localhost:3000/api/health
Project API: authentication required (M3 pending)
```

結果：PASS。

### 七、前端回歸驗收

| 項目                       | 結果 |
| -------------------------- | ---- |
| Dashboard 正常顯示         | PASS |
| 左側 Sidebar 正常顯示      | PASS |
| 三欄 Kanban 正常顯示       | PASS |
| 六筆示範任務正常顯示       | PASS |
| 任務統計 6、2、2           | PASS |
| 桌面版主要元素未見明顯重疊 | PASS |

本階段沒有修改 M1 前端核心介面。

### 八、安全限制驗收

| 項目                           | 結果 |
| ------------------------------ | ---- |
| 正式 API 預設拒絕未登入存取    | PASS |
| 測試身分由伺服器可信任函式提供 | PASS |
| 非成員不可存取指定專案         | PASS |
| Member 不可修改專案            | PASS |
| Admin 不可刪除專案             | PASS |
| Owner 刪除需符合版本           | PASS |

以上為 M2-B 所涵蓋的基本存取控制測試，不代表正式登入及完整 RBAC 安全驗收已完成。

### 九、尚未完成的驗證

| 項目                         | 狀態    |
| ---------------------------- | ------- |
| SQLite 檔案重啟持久化測試    | NOT RUN |
| Transaction 失敗回滾專項測試 | NOT RUN |
| 不同連線的並發修改測試       | NOT RUN |
| 正式使用者註冊與登入         | NOT RUN |
| 完整端對端多人操作測試       | NOT RUN |
| M2-B GitHub Commit／Push     | PENDING |

### 十、驗收依據

- VS Code npm test 終端機截圖
- VS Code npm run dev 終端機截圖
- 瀏覽器 Project API 回應截圖
- curl.exe HTTP 401 與 HTTP 200 輸出截圖
- TaskFlow 桌面版 Dashboard 截圖

### 十一、測試結論

M2-B Project CRUD API 的核心功能、基本存取控制、版本衝突處理及目前自動化測試全部通過。

測試統計為 21 passed、0 failed。

正式登入、檔案型資料庫持久化、完整併發與多人即時協作仍未完成。

M2-B 的文件更新及 GitHub 同步仍待完成。

---

## 最新驗收總結

| 階段 | 測試結果 | GitHub |
|---|---|---|
| M0 | 初始化驗證完成 | 已同步 |
| M1 | 4/4 PASS | 已同步 |
| M2-A | 6/6 PASS | 已同步 |
| M2-B | 11/11 PASS | a20aa36 已同步 |
| M2-C | 12/12 PASS | 待本批次提交 |
| 總計 | **33/33 PASS** | 待最終 Push |

### M2-C 實際驗收

- integration.test.js：7/7 PASS
- final-acceptance.test.js：5/5 PASS
- SQLite 持久化：PASS
- Transaction Rollback：PASS
- 資料庫外鍵及完整性：PASS
- HTTP 重開後資料持久化：PASS
- HTTP 400、404、413：PASS
- 未登入冒用身分限制：PASS
- 兩個 Worker 版本競爭：PASS
- 完整回歸測試：33/33 PASS
- Fail：0

### 尚待驗證

- 正式登入流程
- 完整 RBAC 權限矩陣
- 多人即時同步
- 正式環境負載測試
- 完整產品端對端驗收

以上 PASS 僅代表本階段已執行的測試範圍。
