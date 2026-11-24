# TaskFlow｜測試與驗證紀錄

<!-- TASKFLOW-M10A5B2-LOCAL-2026-11-24 -->
## M10-A5b-2｜本機 HTTP 與認證安全測試（2026-11-24）

| 測試 | 實際結果 | 判定 |
| --- | --- | --- |
| GET /api/health | 200 | PASS |
| 匿名 GET /api/projects | 401 | PASS |
| 跨來源 POST /api/auth/register | 403 | PASS |
| HTTP 安全標頭與 API no-store | 均出現在三次 HTTP 回應 | PASS |
| auth-api、auth-abuse-api、auth-abuse-guard | 20/20，ExitCode 0 | PASS |
| 既有帳號手動登入 | 401 | 未完成驗收 |
| 正式 HTTPS／Secure Cookie／HSTS | 未執行 | NOT RUN |
| 完整 CSP 與代理部署 | 未執行 | NOT RUN |

三項 HTTP 測試及 20 項 Node 認證測試屬不同驗證範圍。
本次沒有重新執行完整 Node、Edge E2E。
20 項認證測試不可額外加至先前 350 項完整 Node 回歸。
測試通過不代表程式碼覆蓋率或正式環境安全性 100%。
<!-- /TASKFLOW-M10A5B2-LOCAL-2026-11-24 -->

---

<!-- TASKFLOW-M10A5A-DOCS-2026-11-24 -->

## M10-A5a｜基礎 CSP／Permissions-Policy 自動化驗收（2026-11-24）

> 依使用者本機 PowerShell 截圖記錄，並保留過往歷史結果；測試通過數量不是程式碼覆蓋率，也不能取代正式安全稽核。

| 範圍 | 實際結果 | 證據／限制 |
| --- | --- | --- |
| `node --check scripts/apply-m10a5a.js` | **PASS** | 無語法錯誤輸出 |
| `scripts/apply-m10a5a.js --apply/--verify/--dry-run` | **PASS** | 只修改 `server/server.js`、保留備份、再次執行跳過 |
| `node --check server/server.js` | **PASS** | 增量更新後可正常解析 |
| `node --test tests/security-policy.test.js` | **5/5 PASS** | 首頁 CSP／Permissions、Health 200／no-store、未知 API 404／政策、本機 HSTS 行為 |
| `npm test` | **336/336 PASS** | fail 0／cancelled 0／skipped 0 |
| 全體 Edge E2E | **110/110 PASS** | 以 `node --test --test-concurrency=1` 依序執行所有 `*.e2e.js` |
| 公網 TLS／HSTS、全面 CSP 驗證 | **NOT RUN** | 當前僅基礎 CSP，尚未設定完整來源限制 |
| M9-C3 手機／鍵盤／無障礙 | **Deferred / Not Verified** | 延續已知保留事項 |

### 重現指令

```powershell
node --test .\tests\security-policy.test.js
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
```

- 5/5 Node 專項**包含在** 336/336 完整 Node 中，不能重複算成 341；Node 336 與 Edge 110 為兩組測試計數。
- 全部 Edge 綠燈表示既定瀏覽器互動測試通過，並未直接證明所有 CSP 資源違規、正式 HTTPS、Session 生產環境、滲透測試或可用性符合標準。
- M10-A5a 文件工具相關測試需完成後補充本節以外的執行證據，不預先宣告已通過或 Git Push 已完成。

---

<!-- /TASKFLOW-M10A5A-DOCS-2026-11-24 -->


<!-- TASKFLOW-M10A4-DOCS-2026-11-24 -->

## M10-A4｜HTTP 安全標頭與 Node 回歸（2026-11-24）

> 本節依 2026-11-23～24 使用者本機終端截圖記錄；下方歷史測試結果保留不更動。測試通過率不等於程式碼覆蓋率，也不是全面安全保證。

| 測試或實測 | 結果 | 備註 |
| --- | --- | --- |
| `node --check server/server.js` | **PASS** | JS 語法通過 |
| `node --test tests/security-headers.test.js` | **4/4 PASS** | 三個具體案例與外層測試；0 fail |
| 首頁 `GET /` | **200** | 已見安全標頭；首頁不套用 API `no-store` 規則 |
| 匿名 `GET /api/projects` | **401** | `nosniff`、`DENY`、Referrer-Policy、`Cache-Control: no-store` |
| 原始並行 `npm test` | **328 total／327 pass／1 fail** | 安全標頭測試檔案層級失敗；尚未定位根因 |
| `node --test --test-concurrency=1` | **331/331 PASS** | 0 fail、0 skipped、0 cancelled |
| 更新後正式 `npm test` | **331/331 PASS** | 以 package.json 設定的循序方式執行 |
| M10-A4 全部 Edge E2E | **Not Re-run** | 前一輪 M9-C2 Edge 110/110 屬歷史快照，不是本輪執行 |

### 可重現指令（Windows PowerShell）

```powershell
node --check .\server\server.js
node --test .\tests\security-headers.test.js
npm test
curl.exe -sS -D - -o NUL http://127.0.0.1:3000/
curl.exe -sS -D - -o NUL http://127.0.0.1:3000/api/projects
```

### 尚未解除的驗證風險

- 並行測試不穩定原因未定位；循序測試通過不證明可安全恢復平行執行。
- CSP／Socket.IO 相容性、公開 HTTPS／HSTS、登入防濫用、備份／還原及正式部署未於 M10-A4 驗收。
- M9-C3 響應式、鍵盤與無障礙仍標示 **Deferred / Not Verified**。

---

<!-- /TASKFLOW-M10A4-DOCS-2026-11-24 -->


<!-- TASKFLOW-M9C34-CLOSEOUT-2026-11-23 -->

## 最新驗收快照｜M9-C3 / M9-C4（2026-11-23）

> 本節明確區分**已執行測試**、**人工檢視**與**未驗證項目**。

| 範圍 | 結果 | 證據／限制 |
| --- | --- | --- |
| M9-C2 完整 Node 回歸 | **318/318 PASS** | 已完成，沿用既有截圖結果；非本階段重跑 |
| M9-C2 完整 Edge E2E | **110/110 PASS** | 已完成，含 M9-C2／C1 專項；非本階段重跑 |
| 桌面版 UI 空任務畫面 | **初步視覺檢查** | 截圖未見明顯重疊；不含互動／非空卡片測試 |
| 768px 平板及 390px／320px 手機 | **Deferred / Not Verified** | 使用者決定暫緩，尚無裝置模擬／水平溢出測試結果 |
| 鍵盤導覽、焦點管理、ARIA／讀屏 | **Deferred / Not Verified** | 不得宣稱已通過基本無障礙或 WCAG 驗收 |
| M10 安全、部署、備份／還原 | **Not Tested** | 必須在正式對外發布前獨立執行 |

### 已知風險與限制

- CSS 在寬度 720px 以下隱藏 Sidebar；替代導航可用性待確認。
- 頁面可見開發期 `M5-C1` 版本標籤，正式發布前待清理。
- 完整 Node + Edge 合計 **428 項 PASS**，不表示全裝置測試、程式碼覆蓋率 100% 或 production-ready。

### 後續 M10 驗收條件

- Session／RBAC／CSRF、秘密與環境變數、公開 HTTPS、錯誤處理、資料庫備份與復原，以及發布管線檢查。
- 如需宣稱支援手機／平板或無障礙標準，必須補跑對應驗收；若僅提供桌面本機作品，README 必須清楚限制支援範圍。

---

<!-- /TASKFLOW-M9C34-CLOSEOUT-2026-11-23 -->

<!-- TASKFLOW-M9C2-DOCS-2026-11-23 -->

## 最新測試快照｜M9-C2 Search / Dashboard / Realtime（2026-11-23）

> 依使用者本機 PowerShell 截圖記錄；測試通過率不等於程式碼覆蓋率，也不能取代 M10 安全或部署驗收。

| 項目 | 結果 | 備註 |
| --- | --- | --- |
| M9-C2 搜尋、Dashboard、多人同步、跨專案專項 E2E | **7/7 PASS** | 隔離 Session／SQLite／專案 |
| M9-C1 重試測試競態修正後專項 E2E | **5/5 PASS** | 隔離背景 Socket.IO 干擾；不修改正式產品功能 |
| `npm test` 完整 Node 回歸 | **318/318 PASS** | fail 0、skipped 0、cancelled 0 |
| 全部 `e2e/*.e2e.js` Microsoft Edge | **110/110 PASS** | fail 0、skipped 0、cancelled 0 |
| 完整套件合計 | **428 項 PASS** | 318 + 110；上述專項已包含其中 |

### 測試問題與修復記錄

- 初次全套 Edge：110 tests、108 pass、2 fail（M9-C1 retry 子測試與外層測試）。診斷顯示重試按鈕存在、未停用，但面板在點擊前隱藏；當時任務已成功載入。
- 修正 `e2e/task-ux.e2e.js` 的測試隔離／時序，避免背景 Socket.IO REST 刷新搶先恢復畫面。執行修正工具的 `--dry-run`、`--apply`、`--verify`，再做 `node --check`。
- 修後單獨 Edge **5/5 PASS**，最後完整 Edge **110/110 PASS**。此測試競態不等同正式產品缺陷。
- M9-C2 的 7 項 Edge 專項已包括於全部 110 項中，不能另外加總成 117。完整測試不代表所有部署、安全、負載與跨瀏覽器情境都已涵蓋。

### 完整回歸指令

```powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
```

---

<!-- /TASKFLOW-M9C2-DOCS-2026-11-23 -->

<!-- TASKFLOW-M9C1-DOCS-2026-11-23 -->

## 最新測試快照｜M9-C1 Kanban UX（2026-11-23）

> 依使用者提供之本機終端截圖與操作回報記錄。下方 M9-B 與更早歷史測試保留。此處不代表 M10 部署安全、負載與跨瀏覽器驗收完成。

| 範圍 | 驗收結果 | 補充 |
| --- | --- | --- |
| M9-C1 apply 工具 Node 專項 | 4/4 PASS | 腳本定位、冪等、拒絕非預期結構 |
| M9-C1 Edge UX 專項（修正版） | 5/5 PASS | 全空專案、空欄位、模擬 503 失敗重試、篩選空結果 |
| `npm test` 完整 Node 回歸 | 314/314 PASS | fail 0、skipped 0、cancelled 0 |
| 全部 `e2e/*.e2e.js` | 103/103 PASS | fail 0、skipped 0、cancelled 0 |
| 本機人工操作 | 使用者回報功能正常 | 不是額外的自動化測試 |

- 兩套完整測試合計 **417 項**，專項測試已包含其中，不能重複加總成 426 項或宣稱程式碼覆蓋率 100%。
- 初次 M9-C1 Edge E2E 為 5 tests、3 pass、2 fail（包含外層測試）；點擊重試按鈕等待逾時。後以可控 HTTP 503 模擬與操作時序修訂測試，專項 5/5 PASS，隨後完整 Edge 103/103 PASS。
- 測試資料使用隔離 SQLite、隨機 Port；沒有透過 E2E 重新初始化正式資料庫。
- 最終確認 `git diff --check` 無格式錯誤，但 M9-C1 的 Git Commit／Push 尚須另行驗證。

### M9-C1 完整回歸指令

```powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
```

---

<!-- /TASKFLOW-M9C1-DOCS-2026-11-23 -->

<!-- TASKFLOW-M9B-DOCS-2026-11-23 -->

## 最新測試快照｜M9-B（驗收紀錄至 2026-11-22，文件整理 2026-11-23）

> 來源：使用者提供的本機 PowerShell 與瀏覽器操作結果；本段記錄 M9-B 功能驗收，不等同 M10 正式部署、安全或壓測完成。

| 測試範圍 | 結果 | 失敗／跳過 |
| --- | --- | --- |
| M9-B1 篩選純函式 | 10/10 PASS | 0 / 0 |
| M9-B2 篩選與整合 Node 專項 | 14/14 PASS | 0 / 0 |
| M9-B2 Edge E2E 專項 | 6/6 PASS | 0 / 0 |
| M7-D 修復後單獨 Edge E2E（第 1 次、第 2 次） | 各 10/10 PASS | 各 0 / 0 |
| `npm test` 完整 Node 回歸 | 306/306 PASS | 0 / 0 |
| 全部 `e2e/*.e2e.js`（單檔依序執行） | 98/98 PASS | 0 / 0 |
| 本機網站人工操作 | 使用者確認正常 | 非自動化測試 |

- M9-B1、M9-B2 Node 專項已包含於完整 306 項 Node 測試；Edge 專項亦包含在 98 項完整 Edge E2E 中。完整兩套合計 404 項測試，非 404 項獨立產品功能，也非程式碼覆蓋率 100%。
- 完整 Edge 第一次執行為 98／93 pass／5 fail（含 M7-D 父測試）；修正 `task-board.js` 的語法殘留與背景表單重設問題後，單獨 M7-D 兩次全部通過，隨後完整 Edge 98/98 PASS。
- M9-B2 `apply` 與重跑 `--dry-run` 顯示無重複寫入；正式 `data/taskflow.db` 無須初始化。
- Edge 測試使用隔離記憶體 SQLite／隨機 Port，並非對真實資料庫執行破壞性測試。

### 重現指令（PowerShell）

```powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
```

---

<!-- /TASKFLOW-M9B-DOCS-2026-11-23 -->

<!-- TASKFLOW-M9A-DOCS-2026-11-21 -->

## 最新測試快照｜M9-A Dashboard Analytics（2026-11-21）

> 來源：使用者提供的本機 PowerShell 截圖。這些是 M9-A 當次驗收紀錄，與下方 M0～M8 歷史結果區分；未執行 M10 的部署／安全專項。

| 測試程序 | 終端機確認 | 結果 |
| --- | --- | --- |
| `node --test .\tests\task-analytics.test.js` | 12 tests／12 pass | 0 fail、0 skipped |
| `node --test .\e2e\task-analytics.e2e.js` | 5 tests／5 pass | 0 fail、0 skipped |
| `npm test -- --test-concurrency=1` | 282 tests／282 pass | 0 fail、0 skipped |
| `npm run test:e2e:all` | 52 tests／52 pass | 0 fail、0 skipped |

- 專項測試與完整套件可重疊，不把數量簡單相加當成獨立測試案例數。
- 檔案存在、語法檢查通過；整合腳本更新兩個已追蹤檔案，再執行 dry-run 均判定已更新、跳過。
- Edge 專項涵蓋統計計算、切換／清除專案的資料隔離，並確認 M6 Kanban 相容性。
- `git diff --stat` 只統計已追蹤檔案，不包含新建的 M9-A CSS／JS／測試檔。git 格式驗收應於 staged 後再檢查。
- 本階段通過不等於正式 HTTPS、完整安全稽核、跨瀏覽器、效能及正式 Release 均通過。

### M9-A 回歸指令

```powershell
node --test .\tests\task-analytics.test.js
node --test .\e2e\task-analytics.e2e.js
npm test -- --test-concurrency=1
npm run test:e2e:all
```

---

<!-- /TASKFLOW-M9A-DOCS-2026-11-21 -->

<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

## 最新驗收快照｜M8-A～M8-C3（2026-11-21）

> 以下數字取自本機終端截圖，反映相對應階段實際執行的結果。M8-D 的 Git 文件／同步結果仍須由 Git 紀錄另行確認；正式 Release 尚未驗收。下方 M6、M7 的舊數字均為歷史當次記錄。

| 測試範圍 | 已觀察結果 | 說明 |
| --- | --- | --- |
| M8-A `collaboration-repository.test.js` | **14/14 PASS** | SQLite、版本、授權、Trigger 與活動 metadata |
| M8-B `collaboration-api.test.js` | **21/21 PASS** | CRUD、RBAC、Session、CSRF、衝突與封存 |
| M8-C1 留言前端 | **既定測試通過** | 專項細項數量未由完整終端截圖核實，不臆填 |
| M8-C2 活動模組 | **10/10 PASS** | 模組測試包含在後續 Node 全套數量內 |
| M8-C2 `npm test` | **260/260 PASS** | 當時完整單元／整合回歸 |
| M8-C2 `task-activity.e2e.js` | **6/6 PASS** | Edge 活動時間軸與分頁 |
| M8-C3 `collaboration-realtime.test.js` | **4/4 PASS** | metadata 通知協議、不傳正文、Room 範圍 |
| M8-C3 `npm test -- --test-concurrency=1` | **264/264 PASS** | 最新完整單元／整合測試，0 fail、0 skipped |
| M8-C3 `collaboration-realtime.e2e.js` | **7/7 PASS** | Edge 雙人留言同步、活動刷新及重新連線 |
| M8-C3 `npm run test:e2e:all` | **52/52 PASS** | 原有 Edge E2E 回歸，0 fail、0 skipped |

**注意：** 單項測試通常是完整測試套件的子集，表格中的 pass 數不可直接累加。`test:e2e:all` 在此次記錄中是**既有** E2E 四組回歸，不得說成已包含新 M8 專項；M8 Edge 已獨立執行。

### M8-D 再次核對指令

```powershell
node --test .\tests\collaboration-repository.test.js
node --test .\tests\collaboration-api.test.js
node --test .\tests\collaboration-realtime.test.js
npm test -- --test-concurrency=1
node --test .\e2e\task-activity.e2e.js
node --test .\e2e\collaboration-realtime.e2e.js
npm run test:e2e:all
git diff --check
```

- 如程式碼已經完成測試且僅更動文件，無需反覆重跑整套 Edge；但最後若有任一 `.js`／`.sql` 變更，應重新檢驗受影響的測試與必要回歸。
- M8-D 文件生成器不得接觸 `data/taskflow.db`；測試用 SQLite 隔離，Git 暫存前仍應審查未追蹤檔案內容與敏感資訊。
- 本機截圖的通過紀錄**不是**正式 HTTPS、壓力測試、完整安全稽核、跨瀏覽器或 GitHub Release 的通過證明。

---

<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

<!-- M6-CURRENT-STATUS-2026-11-18 -->
## 最新驗收快照｜M6（2026-11-18）

| 範圍 | 已執行結果 |
| --- | --- |
| M6-A Repository / M6-B API / M6-C Frontend | 11/11、14/14、9/9 PASS |
| M6-D Edge Drag E2E | 15/15 PASS |
| M5-C2 回歸修正 | 14/14 PASS |
| **完整 `npm test`** | **171/171 PASS** |
| **四套 Microsoft Edge E2E** | **52/52 PASS** |

以上都是本機測試截圖的結果，均 0 fail；專項數目為完整測試的子集。正式部署、HTTPS、跨瀏覽器、效能與完整資安尚未驗收。
<!-- /M6-CURRENT-STATUS-2026-11-18 -->

<!-- M5-CURRENT-STATUS-2026-11-17 -->
## 最新驗收快照｜M5-C2（2026-11-17）

| 類別 | 已執行結果 | 說明 |
| --- | --- | --- |
| M5-A Repository | 15/15 PASS | Schema、RBAC、Transaction、Version、重啟持久化 |
| M5-B HTTP API | 20/20 PASS | Task CRUD、CSRF、Session、角色與版本驗證 |
| M5-C1 前端 | 8/8 PASS | 正式看板、表單接線、安全文字渲染 |
| M5-C2 Edge E2E | 14/14 PASS | 多身分、多 Session 的完整任務操作 |
| `npm test` | **137/137 PASS** | 包含上述 Node.js 子群組；不可再累加 |
| `npm run test:e2e:all` | **37/37 PASS** | 包含既有 23 與新增 14 個計數 |
| 人工瀏覽器驗收 | 6 項操作正常 | 新增、看板、狀態、重整、編輯、刪除 |

上述是**測試當次執行紀錄**，不能推論正式 HTTPS、其他瀏覽器、效能、WebSocket 或全部安全情境已驗證。
<!-- /M5-CURRENT-STATUS-2026-11-17 -->


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

## M2-C 驗收總結（歷史紀錄）

| 階段 | 測試結果 | GitHub |
|---|---|---|
| M0 | 初始化驗證完成 | 已同步 |
| M1 | 4/4 PASS | 已同步 |
| M2-A | 6/6 PASS | 已同步 |
| M2-B | 11/11 PASS | a20aa36 已同步 |
| M2-C | 12/12 PASS | 878dfec 已同步 |
| 總計 | **33/33 PASS** | 878dfec 已同步 |

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

---

## M3-A 驗收總結（歷史紀錄）

### 自動化測試結果

| 階段 | 測試數量 | 結果 |
|---|---:|---|
| M1 Express | 4 | PASS |
| M2-A SQLite | 6 | PASS |
| M2-B Project CRUD | 11 | PASS |
| M2-C Integration | 12 | PASS |
| M3-A Authentication | 9 | PASS |
| 總計 | **42** | **42/42 PASS** |

### M3-A 測試範圍

- Session Schema 重複初始化
- Email 正規化
- 密碼雜湊與安全回傳
- 重複 Email 拒絕
- 不同 Salt
- 正確與錯誤密碼驗證
- Session Token 雜湊
- Session 到期與清理
- Session 撤銷
- Session 跨資料庫重開
- 刪除使用者後 Session 連動清除

### 實際執行結果

- node --check：PASS
- M3-A：9/9 PASS
- npm test：42/42 PASS
- Failed：0
- Cancelled：0
- Skipped：0

### 尚待測試

- 正式註冊與登入 HTTP API
- Session Cookie 安全屬性
- CSRF 防護
- 登入限速
- 正式登入後的 Project CRUD
- 前端使用者操作流程
- 完整產品端對端驗收

以上測試通過不代表完整 M3 已完成。

### 版本狀態

M2-C：Commit 878dfec，已同步。

M3-A：9/9 PASS，已於 Commit 1f94ce7 同步 GitHub。

---

## M3-B 最新驗收總結｜2026-11-16

### 自動化測試（node:test）

| 階段 | 測試數 | 結果 |
|---|---:|---|
| M1 Express | 4 | PASS |
| M2-A SQLite | 6 | PASS |
| M2-B Project CRUD | 11 | PASS |
| M2-C SQLite/HTTP Integration | 12 | PASS |
| M3-A Authentication Foundation | 9 | PASS |
| M3-B Authentication HTTP API | 11 | PASS |
| **總計** | **53** | **53/53 PASS** |

- Failed：0；Skipped：0；Cancelled：0。
- M3-B 單獨執行：11/11 PASS。
- 上表是自動化測試數量；不要把 22 個 HTTP 驗收點加進 53，兩者為不同驗證流程。

### 正式本機 HTTP 操作驗收（accept-m3b.js）

- 22/22 PASS，0 failed。
- Health：200；匿名 me / projects：401。
- 註冊：201；重複 Email：409；錯誤密碼：401；跨來源：403。
- 登入：200；HttpOnly / SameSite=Strict Cookie 與 CSRF Token 驗證通過。
- 取得使用者、專案列表：200；無 CSRF 寫入：403。
- 專案建立 201、修改 200、舊版本 409、刪除 204、刪除後 404。
- 無 CSRF 登出 403；合法登出 204；撤銷 Session 後 me / projects 401。
- 正式 `npm run db:init` 成功，存在 auth_sessions、users、projects、project_members 四張主要資料表。
- `curl.exe` 正式健康檢查：HTTP 200。

### 故障紀錄

首次連線曾出現 fetch failed；後續維持 npm run dev 運作並從獨立終端機測試後，22/22 PASS。
此錯誤沒有在後續實測中重現；不能據此宣稱所有部署網路問題已獲驗證。

### 測試資料及安全限制

- 22 項 HTTP 驗收直接使用正式本機資料庫，不是記憶體資料庫。
- 隨機測試帳號仍保留；測試專案已刪除、Session 已撤銷。
- 目前完成的是本機受測流程；前端登入、正式 HTTPS、反向代理、多程序限速及完整安全稽核仍未驗收。
- M3-A GitHub 提交：1f94ce7；M3-B 版本以 GitHub main 最新提交為準。

### 結論

M3-B 後端核心功能 53/53 自動化、22/22 真實 HTTP 驗收通過；M3-C 前端整合尚未開始。

## M3-C1｜前端驗收紀錄（2026-11-16）

### 自動化測試

- `node --test tests/frontend-auth.test.js`：6/6 PASS。
- `npm test`：59/59 PASS。
- Failed：0。
- Skipped：0。
- Cancelled：0。

以上測試包含靜態資源、API 串接及匿名資料限制，
但不等於自動化瀏覽器 E2E 測試。

### 瀏覽器操作

- 註冊表單切換與顯示：PASS，已提供畫面。
- 註冊、登入、建立專案、Session 持續性與登出：使用者回報 PASS。
- Dashboard SQLite 專案列表與展示 Kanban：已提供畫面。

### 環境問題

- 曾出現 EADDRINUSE 127.0.0.1:3000。
- 既有 HTTP 健康檢查仍回傳 200 OK。

### 尚未驗證

- 正式 HTTPS。
- 跨瀏覽器相容性。
- 自動化瀏覽器 E2E。
- 完整正式部署安全測試。

### 結論

M3-C1 既定自動化測試 59/59 PASS。
主要瀏覽器操作依使用者回報通過。
不以此推論產品所有功能及安全性均已完成。

## M3-C2｜Microsoft Edge E2E（2026-11-16）

### 測試結果
- `npm run test:e2e`：8/8 PASS。
- `npm test`：59/59 PASS。
- Failed：0。
- Skipped：0。

### 測試範圍
- 匿名使用者導向登入頁。
- 註冊表單正常送出。
- 錯誤密碼拒絕、正確密碼登入。
- HttpOnly Cookie 驗證。
- 不同 BrowserContext 的 Session 隔離。
- 專案建立與重新整理後保留。
- 登出後私人專案 API 回應 401。
- 已測試流程無未處理 JavaScript Page Error。

### 測試環境
- Microsoft Edge headless。
- Node.js Test Runner。
- SQLite in-memory database。
- 隨機 HTTP Port。

### 尚未驗證
- 正式 HTTPS。
- Edge 以外的其他瀏覽器。
- 完整部署安全性。
- 多人即時同步。

### 結論
M3-C2 既定瀏覽器測試 8/8 PASS。
既有回歸測試 59/59 PASS。
以上結果僅代表已執行的測試範圍。

<!-- M4-SUMMARY-2026-11-17 -->
## 2026-11-17｜M4 集中驗收紀錄

本節依據本機終端機實際執行截圖。

| 測試範圍 | 測試結果 |
| --- | --- |
| M4-A Member Repository | 11/11 PASS |
| M4-B Member API | 18/18 PASS |
| M4-C1 Frontend Smoke Tests | 6/6 PASS |
| M4-C2 Edge E2E | 15/15 PASS |
| npm test | 94/94 PASS |
| npm run test:e2e:all | 23/23 PASS |

上述單階段測試已包含在完整回歸或合併 E2E 之中，
不能把表格中所有測試數字相加作為獨立案例數量。

### M4-A 驗收

- 角色權限矩陣。
- Owner 身分保護。
- 成員新增及移除。
- Email 驗證及重複加入限制。
- Transaction、版本衝突處理。

結果：11/11 PASS。

### M4-B 驗收

- 成員 GET、POST、PATCH、DELETE。
- Session 驗證。
- CSRF 與跨來源拒絕。
- 非成員資料隔離。
- 權限限制。
- HTTP 409 版本衝突。

結果：18/18 PASS。

### M4-C1 驗收

- Dashboard 成員管理入口。
- 成員管理靜態資源。
- 前端 API 串接。
- CSRF 與 Session。
- 未登入存取限制。

結果：6/6 PASS。

### M4-C2 驗收

- Microsoft Edge 真實瀏覽器操作。
- 五個測試帳號。
- 四個獨立 BrowserContext。
- Owner、Admin、Member 權限。
- 角色升降級。
- 版本衝突及重新整理。
- 成員移除與自行退出。
- Session 撤銷。
- 非成員存取拒絕。
- JavaScript 頁面錯誤檢查。

結果：15/15 PASS。

### 最新完整測試

- npm test：94/94 PASS。
- npm run test:e2e:all：23/23 PASS。
- 兩個測試程序合計：117 次通過。
- Failed：0。
- Skipped：0。

### 測試資料隔離

Edge E2E 使用 SQLite :memory:、動態 Port 與獨立 Session。

不修改正式 data/taskflow.db。

### 尚未驗證

- 完整邀請同意／拒絕流程。
- 正式 Task CRUD。
- 即時多人同步。
- HTTPS 正式部署。
- 其他瀏覽器相容性。
- 完整安全及長期壓力測試。

### 結論

M4-A 至 M4-C2 的既定功能與自動化測試通過。

測試通過不代表產品不存在其他潛在問題。

<!-- M5-SUMMARY-2026-11-17 -->
## 2026-11-17｜M5 實際驗收總結

### 一、測試環境與執行結果

| 分類 | 指令或方式 | 實際結果 |
| --- | --- | --- |
| M5-A Repository | `node --test .\tests\task-repository.test.js` | 15/15 PASS |
| M5-B HTTP API | `node --test .\tests\task-api.test.js` | 20/20 PASS |
| M5-C1 Frontend | `node --test .\tests\task-frontend.test.js` | 8/8 PASS |
| M5-C2 Edge E2E | `node --test .\e2e\task-flow.e2e.js` | 14/14 PASS |
| 全專案 Node.js | `npm test` | **137/137 PASS** |
| 三套 Edge 合併 | `npm run test:e2e:all` | **37/37 PASS** |
| 瀏覽器手動驗收 | Task Kanban 六項操作 | 6 項結果正常 |

- 全套回歸及 Edge E2E 均為 0 failed、0 cancelled、0 skipped、0 todo。
- **統計注意：** M5-A/B/C1 是 `npm test` 的子群組，M5-C2 是 37 項 Edge E2E 的一部分；不可把以上每一列相加當成獨立測試數量。
- 本次兩次完整測試執行分別為 137 與 37；合計 174 次測試計數，但不代表 174 項完全不同的需求。

### 二、M5-A / M5-B 範圍

- 非專案成員不可讀取與改寫任務；Owner/Admin/Member 分權。
- Member 只能更改自己受指派任務的授權狀態。
- 新增、更新、刪除及指派、欄位格式、日期、狀態、優先度、position 驗證。
- SQLite Foreign Key、Transaction、Rollback、資料遷移與重啟持久化。
- `version` 樂觀鎖定：過期更新 HTTP 409，不覆蓋當前資料。
- Session Cookie、同源、CSRF、錯誤 JSON、HTTP 400/401/403/404/409 等驗證。

### 三、M5-C1 / M5-C2 範圍

- 三欄正式 Kanban 與 Task API 接線，專案選擇、表單輸入、安全渲染和角色限制。
- **手動瀏覽器操作六項：** 建立任務、顯示看板、更新狀態、F5 重整持久化、編輯、刪除；使用者已逐項確認正常。
- **Edge 自動化：** 四身分獨立 Session、Owner 指派、Member 更改受指派任務狀態、Admin 編輯、過期版本 409、Owner 重讀與刪除、Member 登出後 Session 不可再存取，以及頁面錯誤檢查。
- E2E 使用 SQLite `:memory:` + 隨機 Port + 獨立 BrowserContext；並未以正式 `data/taskflow.db` 作為測試資料庫。

### 四、故障與處理紀錄

1. `server/task-repository.js` 曾因空檔造成 `initializeTaskSchema is not a function`；重新貼入完整匯出程式後通過 15/15。
2. `public/index.html` 曾包含兩份 HTML，使前端 smoke test 不通過，既有 Edge E2E 亦發生連帶失敗；備份原檔後保留新版 HTML，再次驗證 DOCTYPE、表單及選擇器數量，最終 8/8、137/137、23/23 全通過。
3. 新增 M5-C2 E2E 後，最終合併瀏覽器驗收 37/37 PASS，未再發現未處理 JavaScript 頁面錯誤。

### 五、尚待測試（NOT RUN／後續）

- M6 Drag & Drop 真實拖曳及排序競爭。
- M7 WebSocket 即時跨瀏覽器推播與斷線恢復。
- 完整邀請核准、留言、通知、統計與搜尋等後續功能。
- 正式 HTTPS、反向代理、部署環境權限、壓力／長時間穩定性、跨瀏覽器相容性、完整安全稽核。
- M5 GitHub Commit／Push 成功與工作樹乾淨，需要在實際執行後才可登記 PASS。

### 六、驗收結論

M5-A～M5-C2 的**既定功能與測試**通過，可進行六份文件最後檢查與 Git 結案；上述 PASS 不保證所有可能的故障或安全問題都已排除。
<!-- /M5-SUMMARY-2026-11-17 -->

<!-- M6-SUMMARY-2026-11-18 -->
## 2026-11-18｜M6 完整驗收與 M5 回歸修復

### 一、實測結果

| 測試範圍 | 測試結果 | 證據來源 |
| --- | --- | --- |
| M6-A Task Order Repository | 11/11 PASS | 本機 Node.js 測試截圖 |
| M6-B Task Reorder HTTP API | 14/14 PASS | 本機 Node.js 測試截圖 |
| M6-C Drag Frontend Smoke | 9/9 PASS | 本機 Node.js 測試截圖 |
| M6-D Edge 真實拖放 E2E | 15/15 PASS | 本機 Edge E2E 截圖 |
| M5-C2 修復後獨立 Edge E2E | 14/14 PASS | 本機 Edge E2E 截圖 |
| 完整 `npm test` | **171/171 PASS** | 本機完整回歸截圖 |
| 完整四套 Edge E2E | **52/52 PASS** | 本機合併 E2E 截圖 |

- 完整 Node.js 171 和 Edge 52 兩次執行共計 223 個測試計數；表格內專項測試是其子集，**不可全部再加總**。
- 最終兩套完整回歸均為 0 failed、0 cancelled、0 skipped、0 todo。
- M6-D 的四個 BrowserContext 驗證不同角色下的排序、權限、狀態切換、版本衝突與重整持久化。

### 二、問題追蹤與修復驗證

1. 真實 Edge 拖曳初期 8/15、7 FAIL：事件追蹤有 dragover/drop，但 `MOVE REQUESTS: []`，操作被判定沒有排序變動。定位並修正後為 15/15 PASS。
2. M6 導入 `/move` 後，M5-C2 仍監聽舊 `PATCH /tasks/:taskId`；Owner 兩項 `waitForResponse` 30 秒逾時。將兩處監聽路徑改為 `/tasks/:taskId/move`，維持 409/200 驗證，M5-C2 14/14 PASS。
3. 全部測試再次整合驗證，`npm test` 171/171、Edge 52/52 PASS。

### 三、完整驗收操作

```powershell
npm test
node --test --test-concurrency=1 e2e/auth-flow.e2e.js e2e/member-flow.e2e.js e2e/task-flow.e2e.js e2e/kanban-drag.e2e.js
```

對應 `npm run test:e2e:all` 指令包含四套 E2E 檔案；循序執行指令可減少不同 E2E 檔案同時執行造成的資源干擾。

### 四、測試邊界

- E2E 使用獨立 SQLite 記憶體資料庫與隨機埠，不測試正式資料檔。
- Microsoft Edge PASS 不代表 Chrome、Firefox、Safari 或手機瀏覽器均已驗證。
- 未包含正式 HTTPS、反向代理、正式部署權限、安全掃描、長期壓力及 WebSocket 即時同步。
- Git 工作樹與 origin/main 一致性需於實際 Commit／Push 後另行確認。

### 結論

M6-A～M6-D 的**既定功能與自動化測試**通過；最後 Git 結案、正式部署與 v1.0.0 發布仍屬其他獨立驗收項目。
<!-- /M6-SUMMARY-2026-11-18 -->

<!-- TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

## 2026-11-19｜M7 Socket.IO 與多使用者即時同步驗收

### 已知在前一輪通過的測試

| 範圍 | 截圖證據 |
| --- | --- |
| M7-A Socket Session／Room | 15/15 PASS |
| M7-B REST 通知器 | 9/9 PASS |
| M7-C 同步協調器 | 11/11 PASS |
| 完整 Node.js（當時） | 206/206 PASS |
| 原有 Edge E2E（當時） | 52/52 PASS |
| M7-C 新增 Edge E2E | 6/6 PASS |

上方為 M7-D 開始之前已確認的歷史執行結果，不能視為執行了本次 M7-D 測試。

### M7-D 新增驗收

`e2e/realtime-resilience.e2e.js`：四組獨立 Session、兩專案隔離、Owner 新增同步、Member 狀態同步、Owner/Admin 平行樂觀鎖 200/409、API 跨專案限制、原子跨欄排序持久化、成員撤權後停止接收、登出 Session 失效與頁面錯誤檢查。

### 執行命令

```powershell
node --check .\e2e\realtime-resilience.e2e.js
npm test
npm run test:e2e:all
node --test .\e2e\realtime-sync.e2e.js
node --test .\e2e\realtime-resilience.e2e.js
git diff --check
```

- 必須從本機的 M7-D 終端輸出核對實際 pass/fail；本文不預填尚未執行的結果。
- 新增測試採 `:memory:` SQLite、隨機本機 Port 與 `example.test` 帳號，無正式資料寫入。
- 單一瀏覽器 Edge 測試不能推導其他瀏覽器、HTTPS／反向代理、多節點部署、壓力或完整資安均已驗收。
- Git Commit／Push 並非自動執行，須核對 `git status -sb`、`HEAD`、`origin/main`。

<!-- /TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

<!-- TASKFLOW-M10A5B1-2026-11-24 -->

### M10-A5b-1｜驗收指令及涵蓋範圍

1. `node --check server/auth-routes.js` 與 `node --check server/auth-abuse-guard.js`。
2. `node --test tests/auth-abuse-guard.test.js tests/auth-abuse-api.test.js`：限流視窗、10 次失敗、並發保護、錯誤釋放、容量上限、HTTP 429、Session 啟動清理。
3. `npm test`：驗證既有 Auth/Project/Task API 回歸。
4. `node --test --test-concurrency=1 e2e/*.e2e.js`：Edge 瀏覽器多階段回歸（需本機 Edge）。
5. `git diff --check`、`git status --short`。

**注意：** 本文件只列測試方法，不預先聲稱測試已通過；以本機終端機最後的 pass/fail 實際紀錄為準。
