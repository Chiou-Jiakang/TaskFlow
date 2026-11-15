# TaskFlow｜開發歷程紀錄

本文件詳細記錄專案各階段的實作內容、技術決策、
問題處理、驗證結果及後續規劃。

## 2026-11-15｜M0：專案初始化

### 一、階段目標

建立可獨立管理、具備版本控制及完整文件架構的
TaskFlow 專案開發環境。

### 二、已完成工作

1. 建立 C:\Projects\TaskFlow 專案目錄。
2. 使用 git init -b main 初始化版本控制。
3. 設定 GitHub origin。
4. 建立 docs、public、server 資料夾。
5. 規劃七份核心文件。
6. 確立分階段開發與同步維護原則。

### 三、遇到的問題

初期建立資料夾時，曾出現兩個不同位置：

- C:\Projects\TaskFlow
- C:\Taskflow

其中正式 Git Repository 位於 C:\Projects\TaskFlow，
而 docs、public、server 最初建立在 C:\Taskflow。

### 四、問題處理

使用 PowerShell 的 Copy-Item 指令，
將三個資料夾複製至正式專案位置。

執行 Get-ChildItem 後，確認正式專案目錄包含：

- .git
- docs
- public
- server

VS Code 檔案總管亦顯示三個資料夾。

### 五、技術決策

- 沿用 Node.js、Express 與 SQLite。
- 第一版不強制導入 React。
- 使用 REST API 處理資料操作。
- 規劃使用 Socket.IO 處理即時事件。
- 採取後端驗證權限的設計。
- 以逐階段測試及 Git Commit 控制變更。

### 六、階段驗證

已由 PowerShell 終端機截圖確認：

- 正式專案目錄存在。
- Git Repository 已初始化。
- origin 已設定。
- 三個基礎資料夾已建立。

尚未完成網站功能測試。

### 七、後續工作

- 補齊所有初始文件。
- 完成首次 Git Commit 與 Push。
- 進入 M1：網站骨架及基本介面開發。

---

## 2026-11-15｜M0 結案紀錄

### 一、文件初始化

完成七份核心專案文件及兩個 .gitkeep 檔案。

### 二、首次 Git Commit

- Commit：8c2a2e6
- Branch：main
- 新增追蹤檔案：9 個
- 新增內容：390 行

Commit Message：

chore: initialize TaskFlow project structure and documentation

### 三、GitHub Push

成功執行：

git push -u origin main

GitHub Repository：

https://github.com/Chiou-Jiakang/TaskFlow

遠端分支 origin/main 已建立。

### 四、版本一致性

執行以下指令完成檢查：

- git status -sb
- git log -1 --oneline
- git remote -v

檢查結果：

- 本機分支為 main。
- main 已追蹤 origin/main。
- 本機與遠端追蹤分支指向相同 Commit。
- 工作目錄沒有待提交變更。

### 五、M0 結案

M0 專案初始化工作已完成。

專案具備獨立目錄、版本控制、
GitHub 遠端儲存庫及基本文件管理架構。

接下來進入 M1 網站骨架與基本介面開發。

註：本結案紀錄更新完成後，
仍須建立文件結案 Commit 並再次 Push。

### M1｜npm 測試指令初始化問題

**問題現象：**

首次執行 `npm test` 時，出現：

`Error: no test specified`

**原因：**

`npm init -y` 產生的 `package.json` 仍保留預設
test 指令，尚未設定 Node.js 自動化測試執行方式。

**修正方式：**

使用 `npm pkg set` 設定以下指令：

- start：node server/server.js
- dev：node --watch server/server.js
- test：node --test

**驗證狀態：**

待重新執行 `npm test` 確認。

---

## 2026-11-15｜M1 網站骨架開發紀錄

### 一、階段目標

建立 TaskFlow 第一個可執行的網站雛型。

本階段包含：

- Node.js 開發環境
- Express HTTP Server
- 健康檢查 API
- 深色系 Dashboard
- Kanban 看板
- 基礎自動化測試

### 二、實作內容

#### Backend

建立 server/server.js。

使用 Express 5 實作：

- HTTP Server
- GET /api/health
- 靜態檔案服務
- API 404 回應

#### Frontend

建立：

- public/index.html
- public/style.css
- public/app.js

實作：

- Dashboard 介面
- 三欄 Kanban
- 六筆示範任務
- 任務優先度與負責人
- 任務統計
- 響應式版面

#### Testing

建立 tests/server.test.js。

採用 Node.js 內建 node:test 框架。

### 三、首次 npm test 問題

首次執行 npm test 時出現：

Error: no test specified

原因：

npm init -y 產生的 package.json
仍使用預設測試指令：

echo "Error: no test specified" && exit 1

此問題屬於測試執行設定未完成，
不是 Express 程式或自動化測試案例失敗。

### 四、修正方式

使用 npm pkg set 設定：

start：node server/server.js

dev：node --watch server/server.js

test：node --test

並使用 npm pkg get scripts
確認設定成功。

### 五、重新執行自動化測試

執行指令：

npm test

測試結果：

- tests：4
- pass：4
- fail：0
- cancelled：0
- skipped：0
- todo：0
- duration_ms：223.7354

通過項目：

1. 健康檢查 API 正常
2. 首頁與靜態檔案正常
3. 不存在的 API 回傳 404
4. M1 Express 測試群組通過

### 六、技術決策

- 第一版沿用原生 HTML、CSS、JavaScript。
- 使用 Express 5。
- 採用 server/ 統一存放後端程式。
- 採用 tests/ 統一存放測試程式。
- M1 暫時使用前端示範任務資料。
- SQLite、登入、RBAC 與 WebSocket 留待後續階段。
- 自 M1 起逐步建立自動化測試機制。

### 七、目前限制

目前測試僅涵蓋 Express 基礎功能。

尚未完成：

- 瀏覽器實際畫面驗收
- 前端動態渲染驗證
- 響應式介面確認
- GitHub 本批次版本同步

### 八、後續處理

1. 完成瀏覽器驗收。
2. 更新相關文件。
3. 進行 Git Commit 與 Push。
4. 驗證本機與遠端版本一致。
5. 完成 M1 結案後進入 M2。

---

## 2026-11-15｜M1 最終驗收與 GitHub 同步

### 一、網站啟動驗收

- npm run dev：PASS
- Express HTTP Server：PASS
- 本機網址：http://localhost:3000
- Dashboard 桌面版顯示：PASS
- 六筆示範任務渲染：PASS
- 三欄 Kanban 任務分類：PASS
- 任務統計 6、2、2：PASS

### 二、自動化測試

- 測試數量：4
- 通過數量：4
- 失敗數量：0

### 三、首次 M1 GitHub 提交

- Commit：e4322a1
- Branch：main
- 修改檔案：13
- 新增行數：2226
- 刪除行數：7
- GitHub Push：成功

### 四、最終驗收補充

- 手機響應式介面：待填寫實測結果
- 瀏覽器 Console：待填寫實測結果
- 文件結案 Commit：待完成

### 五、後續階段

M1 全部驗收通過後，
正式進入 M2 SQLite 資料庫與專案 CRUD API。

---

## 2026-11-15｜M1 文件結案提交結果

### GitHub 結案 Commit

- Commit：2d0d710
- Message：docs: finalize M1 dashboard verification
- Branch：main
- Push：成功
- 本機及 origin/main：版本一致
- Git 工作目錄：乾淨

### 文件同步補充

本次確認原結案 Commit 僅更新
docs/DEVELOPMENT_LOG.md。

後續需同步修正 README、CHANGELOG、
PROJECT_PLAN 與 TESTING 的舊狀態，
確保文件反映實際開發進度。

### 尚待確認

- 手機響應式版面測試
- 瀏覽器 Console 檢查
- 最終文件同步 Commit

---

## 2026-11-15｜M2-A SQLite 開發紀錄

### 完成內容

- 建立資料庫連線與初始化模組。
- 建立三張核心資料表。
- 設定外鍵、CHECK、UNIQUE 及索引。
- 加入資料庫測試與 npm 指令。
- 確認 SQLite 檔案受到 Git 忽略規則保護。

### 技術決策

採用 Node.js 24.15.0 及 node:sqlite。
測試使用記憶體資料庫，避免修改正式資料。
SQLite 檔案啟用 WAL 模式。

### 驗證結果

- npm run db:init：PASS
- 再次初始化：PASS
- npm test：10/10 PASS
- 測試失敗：0
- 測試耗時：303.3564 ms
- git check-ignore：PASS

### 待處理

- 檔案型資料庫重啟持久化驗證
- Project CRUD API
- M2-A GitHub 同步

### 下一階段

M2-B：專案 CRUD API。
