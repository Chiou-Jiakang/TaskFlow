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

---

## 2026-11-15｜M2-A 測試驗收

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

自動化測試：10 passed、0 failed。

本次驗證由 VS Code PowerShell 終端機截圖確認。

````

### 5. `docs/PROJECT_PLAN.md` 與 `docs/ARCHITECTURE.md`

這兩份只需要簡短更新即可。

在 `PROJECT_PLAN.md` 將 M2 改為「進行中」，並於文件末尾新增：

```markdown
## M2 開發進度

- M2-A SQLite 基礎：核心測試完成，待 GitHub 同步
- M2-B Project CRUD API：未開始
- M2-C 整合驗收：未開始
````

在 `ARCHITECTURE.md` 末尾新增：

```markdown
## M2-A 實際資料庫架構

- server/schema.sql：資料表及約束
- server/db.js：SQLite 存取與初始化
- server/init-db.js：初始化工具
- tests/database.test.js：資料庫測試

核心資料表：

- users
- projects
- project_members

使用 node:sqlite，啟用 Foreign Keys。
檔案型資料庫採 WAL 模式。
Project CRUD API 將在 M2-B 實作。
```

## 四、Step 3｜提交 M2-A 到 GitHub

六份文件修改並儲存後，在 `C:\Projects\TaskFlow` 終端機依序執行：

```powershell
git status --short
git add -A
git diff --cached --check
git diff --cached --stat
```

確認沒有把資料庫檔案、`node_modules` 或其他不相關內容加入暫存。

接著執行：

```powershell
git commit -m "feat: implement M2A SQLite database foundation"
```

```powershell
git push origin main
```

最後檢查：

```powershell
git status -sb
git log -2 --oneline
```

若沒有錯誤，且顯示 `## main...origin/main` 並無其他變更，M2-A 就可以正式結案。

---

## 五、接下來的 M2-B 會實作什麼？

M2-B 將使用目前建立的 `projects` 與 `project_members` 資料表，開發以下 REST API：

| API                        | 用途                 |
| -------------------------- | -------------------- |
| `POST /api/projects`       | 建立新專案           |
| `GET /api/projects`        | 取得可存取的專案清單 |
| `GET /api/projects/:id`    | 取得指定專案         |
| `PATCH /api/projects/:id`  | 修改專案資料         |
| `DELETE /api/projects/:id` | 刪除指定專案         |

還有幾個關鍵設計會一起處理：新增專案與 Owner 成員關聯必須在同一個資料庫交易中完成；修改時要處理 `version` 版本衝突；API 必須具備輸入驗證、錯誤代碼及自動化測試。

由於 M3 才會正式開發登入，M2-B 會先使用**可注入測試使用者的 API 架構**測試 CRUD，不會在正式伺服器直接開放任何匿名使用者修改專案資料。

<box border radius="lg" padding={3} gap={2}>
  <row align="center" justify="between">
    **TaskFlow｜下一步**
    <badge color="secondary">M2-B</badge>
  </row>
  <text color="secondary" size="sm">預計新增以下程式檔案：</text>
  <box gap={2}>
    {#each ["server/project-repository.js","server/project-routes.js","tests/projects.test.js"] as f}
      <row align="center" gap={2}>
        <icon name="file-code" size="sm" color="secondary"/>
        <text size="sm">{f}</text>
      </row>
    {/each}
  </box>
  <text size="xs" color="secondary">現有 server.js 只做必要的路由整合，避免大規模改寫已通過測試的 M1 程式。</text>
</box>

**現在最適合先完成上面的 M2-A 文件更新與一次 Git Commit／Push。** 這次不再額外安排第二輪結案文件提交。完成後就直接開始 M2-B 的程式實作，讓 TaskFlow 從空資料表正式進入可操作的專案管理系統。
