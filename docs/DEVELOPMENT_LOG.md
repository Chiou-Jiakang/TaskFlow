# TaskFlow｜開發歷程紀錄

本文件詳細記錄專案各階段的實作內容、技術決策、問題處理、驗證結果及後續規劃。

開發紀錄採累積式管理。歷史內容反映當時的開發狀態，最新進度以文件最後的紀錄及 PROJECT_PLAN.md 為準。

## 2026-11-15｜M0：專案初始化

### 一、階段目標

建立可獨立管理、具備版本控制及完整文件架構的 TaskFlow 專案開發環境。

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

其中正式 Git Repository 位於 C:\Projects\TaskFlow，而 docs、public、server 最初建立在 C:\Taskflow。

### 四、問題處理

使用 PowerShell 的 Copy-Item 指令，將三個資料夾複製至正式專案位置。

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

當時尚未完成網站功能測試。

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

專案具備獨立目錄、版本控制、GitHub 遠端儲存庫及基本文件管理架構。

接下來進入 M1 網站骨架與基本介面開發。

當時曾規劃追加文件結案 Commit，後續開發流程已調整為以完整功能批次集中更新文件及提交版本。

---

## 2026-11-15｜M1 npm 測試指令初始化問題

### 問題現象

首次執行 `npm test` 時，出現：

`Error: no test specified`

### 原因

`npm init -y` 產生的 `package.json` 仍保留預設 test 指令，尚未設定 Node.js 自動化測試執行方式。

### 修正方式

使用 `npm pkg set` 設定以下指令：

- start：node server/server.js
- dev：node --watch server/server.js
- test：node --test

### 驗證狀態

初次記錄時，尚待重新執行 npm test。

後續已成功設定測試指令，並取得 M1 自動化測試 4/4 PASS。

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

npm init -y 產生的 package.json 仍使用預設測試指令：

echo "Error: no test specified" && exit 1

此問題屬於測試執行設定未完成，不是 Express 程式或自動化測試案例失敗。

### 四、修正方式

使用 npm pkg set 設定：

start：node server/server.js

dev：node --watch server/server.js

test：node --test

並使用 npm pkg get scripts 確認設定成功。

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

### 七、當時的開發限制

當時測試僅涵蓋 Express 基礎功能。

當時尚未完成：

- 瀏覽器實際畫面驗收
- 前端動態渲染驗證
- 響應式介面確認
- GitHub 本批次版本同步

### 八、當時規劃的後續處理

1. 完成瀏覽器驗收。
2. 更新相關文件。
3. 進行 Git Commit 與 Push。
4. 驗證本機與遠端版本一致。
5. 完成 M1 結案後進入 M2。

---

## 2026-11-15｜M1 網站驗收與 GitHub 同步

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

### 四、剩餘驗收項目

- 手機響應式介面：待補充實際窄螢幕驗收
- 瀏覽器 Console：待補充完整執行錯誤檢查

原先的文件結案提交工作已於後續 Git Commit 處理。

### 五、後續階段

M1 核心介面、伺服器及基礎測試通過後，開始 M2 SQLite 資料庫與專案 CRUD API 開發。

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

本次確認原結案 Commit 僅更新 docs/DEVELOPMENT_LOG.md。

後續需同步修正 README、CHANGELOG、PROJECT_PLAN 與 TESTING 的舊狀態，確保文件反映實際開發進度。

### 後續補充

- 文件整理提交：dceb225。
- 該提交已成功同步 GitHub。
- 手機響應式版面驗收尚待補充。
- 瀏覽器 Console 檢查尚待補充。
- 後續文件管理改採功能批次集中更新。

---

## 2026-11-15｜M2-A SQLite 開發紀錄

### 一、完成內容

- 建立資料庫連線與初始化模組。
- 建立三張核心資料表。
- 設定外鍵、CHECK、UNIQUE 及索引。
- 加入資料庫測試與 npm 指令。
- 確認 SQLite 檔案受到 Git 忽略規則保護。

### 二、技術決策

採用 Node.js 24.15.0 及 node:sqlite。

測試使用記憶體資料庫，避免修改正式資料。

SQLite 檔案啟用 WAL 模式。

### 三、核心資料表

#### users

- id
- email
- password_hash
- display_name
- created_at

#### projects

- id
- name
- description
- owner_id
- status
- version
- created_at
- updated_at

#### project_members

- project_id
- user_id
- role
- joined_at

### 四、資料庫模組

- server/schema.sql
- server/db.js
- server/init-db.js
- tests/database.test.js

### 五、驗證結果

- npm run db:init：PASS
- 再次初始化：PASS
- npm test：10/10 PASS
- 測試失敗：0
- 測試耗時：303.3564 ms
- git check-ignore：PASS

後續重新測試結果：

- tests：10
- pass：10
- fail：0
- duration_ms：254.6897

### 六、當時待處理事項

- 檔案型資料庫重啟持久化驗證
- Project CRUD API
- M2-A GitHub 同步

其中 Project CRUD 已於 M2-B 核心實作，GitHub 同步也已於後續完成。

檔案型資料庫重啟持久化驗證仍保留至 M2-C。

### 七、GitHub 提交

功能提交：

- Commit：d557020
- Message：feat: implement M2A SQLite database foundation
- 修改檔案：9
- 新增行數：602
- 刪除行數：10
- GitHub Push：成功

文件架構整理：

- Commit：113765c
- Message：docs: clean M2A records and align project status
- GitHub Push：成功
- main 與 origin/main：當時版本一致

### 八、下一階段

M2-B：Project CRUD API。

---

## 2026-11-15｜文件管理流程調整

### 一、原本問題

專案初期曾要求每完成少量程式碼修改，就立即更新多份 Markdown 文件並執行 Commit、Push。

此流程雖有助於追蹤變更，但對個人開發而言，造成過高的文件管理成本。

另外，部分文件曾因手動複製 ChatGPT 回覆而混入操作教學及介面標記。

### 二、新的管理原則

改採完整功能批次更新。

每個主要開發批次依序完成：

1. 程式碼實作。
2. 自動化及必要手動測試。
3. 問題修正。
4. 集中更新相關文件。
5. 一次主要 Git Commit。
6. GitHub Push。
7. 版本一致性確認。

不需要每修改一個檔案就更新所有文件。

### 三、文件管理方式

- README：功能與使用方式有重大變更時更新。
- CHANGELOG：記錄每個有實質成果的功能批次。
- DEVELOPMENT_LOG：累積技術決策、重要錯誤與成果。
- TESTING：記錄測試結果及尚未驗證的項目。
- ARCHITECTURE：架構或資料表發生實質變更時更新。
- PROJECT_PLAN：開發階段開始、完成或目標調整時更新。

歷史開發紀錄保留，不因新功能完成而刪除過去發生的問題。

---

## 2026-11-15｜M2-B Project CRUD API 開發

### 一、開發目標

建立可操作 SQLite 專案資料的 REST API，讓 TaskFlow 從僅有資料表的系統，逐步成為能夠管理實際專案資料的全端應用。

同時為 M3 使用者登入與 M4 RBAC 權限管理保留擴充能力。

### 二、本階段新增檔案

- server/project-repository.js
- server/project-routes.js
- tests/projects.test.js

### 三、本階段修改檔案

- server/server.js

原本 M1 前端程式及 M2-A 資料庫核心保留，避免重複改寫已通過測試的功能。

### 四、主要實作內容

#### Project CRUD

建立五個 REST API：

1. POST /api/projects
2. GET /api/projects
3. GET /api/projects/:id
4. PATCH /api/projects/:id
5. DELETE /api/projects/:id

#### Repository

建立 Project Repository，處理：

- SQLite 資料讀取
- 專案建立
- 專案更新
- 專案刪除
- 成員角色檢查
- Transaction
- version 版本衝突

#### Router

建立 Project Router，處理：

- HTTP 路由
- 請求資料驗證
- 專案 ID 驗證
- 版本編號驗證
- JSON 回應
- 存取控制入口

#### Express 整合

修改 server/server.js：

- 掛載 Project Router
- 保留 M1 健康檢查
- 保留靜態網站服務
- 保留 API 404
- 加入統一錯誤處理

### 五、資料一致性

建立專案時，使用 Transaction 同時執行：

1. 新增 projects 記錄。
2. 新增 project_members Owner 關聯。

若任一步驟失敗，執行 Rollback。

專案修改使用 version 欄位檢查請求版本。

當資料版本不一致時，回傳 HTTP 409 Conflict。

### 六、基本角色限制

- Owner：可以讀取、修改及刪除專案。
- Admin：可以讀取及修改專案。
- Member：僅能讀取專案。
- 非成員：不可存取指定專案。

目前是 M2-B 的基本專案操作限制，完整 RBAC 將於 M4 實作。

### 七、身分驗證設計

M3 尚未完成正式登入功能。

因此正式啟動的 Project API 預設不提供已登入身分。

未登入的專案 API 請求回傳 HTTP 401。

測試環境使用可信任函式注入測試身分，不以客戶端提供的 user_id 作為認證依據。

### 八、自動化測試

執行：

npm test

測試結果：

- tests：21
- pass：21
- fail：0
- cancelled：0
- skipped：0
- todo：0
- duration_ms：344.72

測試分類：

- M1 Express：4
- M2-A SQLite：6
- M2-B Project CRUD：11

M2-B 的 11 個計數包含外層測試群組及 10 個子測試。

### 九、Project CRUD 測試內容

1. 未登入時不可操作專案。
2. 專案列表初始為空。
3. 建立專案並建立 Owner 成員。
4. 查詢專案列表與單筆資料。
5. 輸入驗證及拒絕客戶端指定 Owner。
6. 只有專案成員可以讀取專案。
7. Member 不可修改，Admin 可以修改。
8. 舊版本更新回傳 409。
9. 刪除僅限 Owner 且必須符合版本。
10. 刪除後回傳 404，畸形 JSON 回傳 400。

### 十、正式 HTTP API 驗收

GET /api/projects

- 預期：HTTP 401 Unauthorized
- 實際：HTTP 401 Unauthorized
- 結果：PASS

GET /api/health

- 預期：HTTP 200 OK
- 實際：HTTP 200 OK
- 結果：PASS

回傳資料：

- service：TaskFlow
- status：ok
- milestone：M1

健康檢查保留 M1 的既有回傳契約，並不代表 M2-B 尚未執行。

### 十一、網站顯示驗收

- npm run dev：PASS
- Express Server 啟動：PASS
- localhost:3000：正常
- Dashboard 桌面版：PASS
- Kanban 三欄顯示：PASS
- 六筆示範任務：PASS
- 任務統計 6、2、2：PASS

### 十二、技術決策

- Repository 與 Router 分層。
- 採用 SQLite 及 Prepared Statements。
- 使用 Transaction 保護相關資料操作。
- 使用 version 作為樂觀鎖。
- 保留原本 M1 前端介面。
- 暫不建立正式登入頁面。
- 暫不開放匿名使用者修改專案。
- 避免在同一階段加入其他大型功能。

### 十三、目前限制

- 正式使用者註冊與登入尚未完成。
- Project CRUD 尚未與正式前端操作介面整合。
- Kanban 任務仍使用前端示範資料。
- 檔案型 SQLite 重啟持久化測試尚未完成。
- Transaction 異常 Rollback 尚需補充專項整合測試。
- 多連線並發操作尚需進一步驗證。
- 真正多人即時同步尚未實作。

### 十四、本階段結案前工作

- 完成六份核心文件的集中更新。
- 清理 README 與 TESTING 誤貼的教學內容。
- 檢查 Git 暫存變更。
- 建立 M2-B 功能與文件 Commit。
- Push 至 GitHub。
- 確認 main 與 origin/main 同步。

### 十五、下一階段

M2-C：資料持久化及整合驗收。

預計驗證：

1. 關閉並重新開啟 SQLite 後資料仍存在。
2. Transaction 失敗時資料完整回滾。
3. 版本衝突不會造成舊資料覆蓋新資料。
4. 不同資料庫連線的併發操作。
5. API 邊界與異常處理。
6. 全部回歸測試。
7. M2 正式結案。

---

## 2026-11-16｜M2-C 最終整合驗收

### 開發目標

驗證 SQLite 資料持久化、交易一致性、
Project CRUD API 與並發版本衝突處理。

### 新增測試檔案

- tests/integration.test.js
- tests/final-acceptance.test.js

### 主要驗證內容

1. SQLite 資料庫重新開啟後資料保留。
2. Transaction 失敗後完整回滾。
3. 外鍵、唯一性及狀態約束持續有效。
4. WAL 與資料庫完整性檢查。
5. HTTP 建立、修改及重啟持久化。
6. HTTP 刪除及重啟後資料一致性。
7. HTTP 無效輸入與錯誤回應。
8. 未登入使用者無法冒用 Owner。
9. 兩個 Worker 並發更新相同 version。

### 自動化測試

- M1 Express：4/4 PASS
- M2-A SQLite：6/6 PASS
- M2-B Project CRUD：11/11 PASS
- M2-C Integration：12/12 PASS
- 全部測試：33/33 PASS
- Fail：0

### 資料安全

測試使用系統暫存 SQLite。
沒有修改正式 data/taskflow.db。

### 技術決策

- 保留現有 Repository 與 Router。
- 不重寫已通過驗證的資料庫模組。
- 使用獨立 Worker Threads 驗證競爭更新。
- 以 version 防止舊版本覆蓋新版本。
- 避免加入超出 M2 範圍的新產品功能。

### 尚未完成

- 正式 Authentication
- 完整 RBAC
- Task CRUD
- Drag & Drop
- Socket.IO
- 壓力與正式部署測試

### GitHub

M2-B 已完成提交：a20aa36。

M2-C 測試及文件將於本批次一次 Commit、
Push 並驗證遠端同步。

### 下一階段

M3：使用者註冊、登入、登出與 Session。

---

## 2026-11-16｜M3-A Authentication Foundation

### 開發目標

建立 TaskFlow 正式登入系統的資料層基礎。

### 開發內容

1. 建立 auth_sessions 資料表。
2. 建立 Session 專用索引。
3. 實作 Email 正規化與驗證。
4. 實作安全密碼雜湊。
5. 實作密碼驗證。
6. 實作使用者註冊。
7. 實作使用者身分查詢。
8. 實作 Session 建立與撤銷。
9. 實作 Session 過期與清理。
10. 建立獨立自動化測試。

### 新增檔案

- server/auth-schema.sql
- server/auth-foundation.js
- tests/auth-foundation.test.js

### 技術決策

- 延用 Node.js 與 SQLite。
- 使用 Node.js 內建 crypto。
- 密碼使用非同步 scrypt。
- 每筆密碼使用隨機 Salt。
- Session 使用隨機 Token。
- 資料庫只儲存 Token 的 SHA-256 雜湊。
- 原本 M2 Repository 與 Router 暫不修改。
- auth-schema.sql 獨立管理 Session Schema。

### 問題及修正紀錄

首次執行 M3-A 測試時發生 SyntaxError。

錯誤位置：

server/auth-foundation.js 第 1 行。

原因：

複製程式碼時，多出不合法的星號字元。

處理方式：

- 移除多餘字元。
- 重新執行 node --check。
- 獨立執行 M3-A 測試。
- 重新執行完整回歸測試。

### 實際驗證

- M3-A 獨立測試：9/9 PASS。
- 原有 M1～M2-C：33/33 PASS。
- 全部測試：42/42 PASS。
- Failed：0。
- Skipped：0。

### M2 版本銜接

M2-C 已於 Commit 878dfec 完成 GitHub 同步。
本階段沒有重新修改已結案的 M2 程式。

### 尚未完成

- M3-B Authentication HTTP API
- 正式 Session Cookie
- CSRF 防護
- 登入限速
- 正式資料庫初始化整合
- 前端註冊與登入介面
- Project API 正式登入身分整合

### GitHub

M3-A 文件及程式將於本批次一併提交。

### 下一階段

M3-B：註冊、登入、登出、使用者資料 API。

---

## 2026-11-16｜M3-B Authentication HTTP API

### 開發範圍

1. 建立 `server/auth-routes.js`，提供四個正式身分驗證 API。
2. 調整 `server/server.js`，將正式 Project CRUD 與 Session 身分串接。
3. 調整 `server/init-db.js`，初始化第四張 auth_sessions 資料表。
4. 建立 `tests/auth-api.test.js`，在隔離的 SQLite 中驗證 API 與安全邊界。
5. 建立 `scripts/accept-m3b.js`，連線正式本機 Server 驗收完整流程。

### 重要技術設計

- 延用 M3-A 帳號與 Session Repository，不重寫密碼雜湊與 Token 實作。
- 使用 HttpOnly、SameSite=Strict 的 Session Cookie；正式 HTTPS 情境加上 Secure。
- 寫入專案與登出時檢查 CSRF Token；註冊、登入執行來源驗證。
- 使用者身分由後端 Session 解析，避免將客戶端 user_id 當作授權依據。
- 延用原有 createApp 測試注入接口，保留 M2 測試相容性。
- 以記憶體 Map 實作本機基本登入失敗限速，尚非正式多節點設計。

### 實際驗收結果

- M3-B 獨立自動化測試：11/11 PASS。
- M1～M3-B 全部回歸測試：53/53 PASS，0 failed，0 skipped。
- 正式 `npm run db:init`：四張主要 SQLite 資料表初始化成功。
- `curl.exe -i http://127.0.0.1:3000/api/health`：HTTP 200。
- 正式本機 HTTP 整合驗收：22/22 PASS。
- 驗證註冊、重複 Email、登入、Cookie、CSRF、專案 CRUD、版本衝突、登出撤銷 Session。

### 問題與排除過程

- 驗收腳本首次執行顯示 `fetch failed`，沒有任何 PASS 檢查點。
- 一度未查得 Port 3000 監聽狀態，PowerShell 排查命令亦混入多餘反斜線，造成 CommandNotFoundException。
- 調整為兩個終端機：一個持續執行 `npm run dev`，另一個發送 curl 及 Node.js 驗收請求。
- 後續健康檢查 HTTP 200、22/22 PASS，確認連線問題已排除；沒有為此重寫 Auth API。

### 測試資料處理

- 自動化測試使用隔離資料庫。
- 正式 HTTP 驗收會在 data/taskflow.db 中新增隨機測試帳號。
- 驗收成功時測試專案已刪除、Session 已撤銷；測試帳號仍存在，需視後續資料清理政策處理。
- 不重新初始化或刪除正式 SQLite，避免造成使用者資料遺失。

### 版本與後續工作

- 上一階段 M3-A：Commit 1f94ce7，已同步 GitHub。
- 本次 M3-B 程式、測試與六份文件集中提交；實際提交 SHA 以 Git 記錄為準。
- M3-C：前端登入／註冊／登出、錯誤提示、Session 狀態管理與 Project UI 串接。
- 正式部署、完整 RBAC、Socket.IO、進階安全稽核留待後續 Milestone。

## 2026-11-16｜M3-C1 前端身分驗證

### 一、開發內容

1. 新增 `public/auth.html`。
2. 新增 `public/auth.css`。
3. 新增 `public/auth.js`。
4. 新增 `public/dashboard-auth.js`。
5. 更新 `public/index.html`。
6. 新增 `tests/frontend-auth.test.js`。
7. 保留原有 Kanban 展示結構，加入真實專案資料串接。

### 二、技術決策

- 沿用 M3-B Authentication API，不重新設計後端。
- Session Cookie 由瀏覽器管理。
- 使用 CSRF Token 保護需要驗證的資料寫入。
- 前端顯示與後端權限檢查分離。
- 不修改正式 SQLite Schema。

### 三、自動化測試

- 前端 Smoke Tests：6/6 PASS。
- 全專案回歸測試：59/59 PASS。
- Fail：0。
- Skipped：0。

### 四、實際操作驗收

- 登入與註冊表單正常呈現。
- Dashboard 正常載入。
- 真實專案資料可以顯示。
- 使用者回報其餘帳號與專案操作測試通過。

### 五、問題與處理

- 執行第二個 npm run dev 時出現 EADDRINUSE。
- 本機 Port 3000 已有程序監聽。
- 使用 curl 健康檢查取得 HTTP 200。
- 不因 Port 占用重新修改正常運作的 API。
- 保留既有 SQLite 資料。

### 六、後續工作

- 完成 M3-C1 文件集中更新。
- 執行 Git Commit 與 Push。
- 核對本機與遠端 Commit SHA。
- 後續進行 M3-C2 進階驗收及 M4 成員管理。

## 2026-11-16｜M3-C2 真實瀏覽器端對端驗收

### 一、開發內容
1. 安裝 Playwright Core。
2. 設定 `test:e2e` npm script。
3. 新增 `e2e/auth-flow.e2e.js`。
4. 建立 Edge 自動化瀏覽器測試。
5. 採用隔離 SQLite、隨機 Port 與 BrowserContext。

### 二、測試結果
- Edge E2E：8/8 PASS。
- Node.js Regression：59/59 PASS。
- Failed：0。
- Skipped：0。

### 三、問題紀錄
- 曾發生 Port 3000 重複占用。
- 新測試改用隨機 Port，避免干擾開發 Server。
- Git 曾顯示 LF/CRLF 警告，非測試錯誤。

### 四、版本管理
- M3-C1 已於 Commit `32361a6` 同步 GitHub。
- 本次 M3-C2 Commit／Push 需依實際 Git 結果確認。

### 五、後續工作
- 完成 M3-C2 GitHub 同步與 SHA 驗證。
- 進入 M4 成員管理及 RBAC 權限開發。

<!-- M4-SUMMARY-2026-11-17 -->
## 2026-11-17｜M4 成員管理與權限控制集中結案

### 一、M4-A Member Repository

建立 server/member-repository.js。

主要完成：

- Owner / Admin / Member 權限矩陣。
- 專案成員查詢。
- 新增與移除成員。
- 修改成員角色。
- Owner 身分保護。
- Email 與重複加入檢查。
- Transaction 與 version 控制。

測試：11/11 PASS。

### 二、M4-B REST API

新增 server/member-routes.js，並整合 server/server.js。

實作：

- GET /api/projects/:id/members
- POST /api/projects/:id/members
- PATCH /api/projects/:id/members/:userId
- DELETE /api/projects/:id/members/:userId

沿用既有 Authentication、CSRF、同源檢查與錯誤處理。

不採信客戶端自行指定的 actorId。

測試：18/18 PASS。

### 三、M4-C1 成員管理前端

新增：

- public/members.html
- public/members.css
- public/members.js

修改：

- public/dashboard-auth.js
- public/auth.css

完成：

- Dashboard 成員管理入口。
- 成員列表。
- 依 Email 新增成員。
- 修改角色。
- 移除與退出。
- 版本衝突提示。
- 安全文字顯示。

測試：6/6 PASS。

當時完整回歸：94/94 PASS。

### 四、M4-C2 Edge 多帳號 E2E

新增 e2e/member-flow.e2e.js。

使用：

- Microsoft Edge
- Playwright Core
- 四個獨立 BrowserContext
- 五個測試帳號
- SQLite 記憶體資料庫
- 動態 Port

驗證：

- 登入與 Session 隔離。
- Owner 新增 Admin、Member。
- Admin 與 Member 權限差異。
- 非成員資料拒絕。
- 角色升級與降級。
- 版本衝突及重新操作。
- 移除與自行退出。
- Session 撤銷。
- 未處理 JavaScript 錯誤檢查。

M4-C2：15/15 PASS。

合併 Edge E2E：23/23 PASS。

Node.js 完整回歸：94/94 PASS。

Failed：0。

### 五、開發流程與技術決策

本階段沿用集中結案制度：

1. 完成核心程式。
2. 執行必要測試。
3. 修正問題。
4. 完成跨模組驗收。
5. 集中更新六份文件。
6. Git Commit／Push。
7. 驗證 Git 版本一致性。

程式沒有重新初始化正式 SQLite 資料庫。

瀏覽器 E2E 使用獨立記憶體資料庫。

Git 的 LF/CRLF 提示屬換行格式警告，不代表測試失敗。

### 六、尚未完成

- 完整邀請確認流程。
- 正式任務管理。
- 多人即時推播。
- 正式部署與完整安全稽核。

### 七、後續工作

進入 M5：Task Schema、Task Repository、Task API 與正式 Kanban 整合。

本階段 GitHub 同步結果及 SHA 以實際提交紀錄為準。
