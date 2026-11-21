# TaskFlow｜專案開發計畫

<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

## 最新里程碑狀態｜M8（2026-11-21）

> 本節是最新狀態。後方 M6／M7 規劃表與「尚未開始」敘述保留為**歷史快照**，不可直接用來判定目前完成度。正式 `v1.0.0` **尚未發布**。

| 里程碑 | 本次確認狀態 | 證據或限制 |
| --- | --- | --- |
| M0～M7 | 歷史階段已結案 | M7 Socket.IO、Session／Room 權限、斷線補抓與 Edge E2E |
| M8-A Schema / Repository | 既定測試完成 | 14/14 PASS；增量 SQLite、留言版本、活動 metadata |
| M8-B Collaboration REST | 既定測試完成 | 21/21 PASS；授權／CSRF／RBAC／409 |
| M8-C1 任務留言介面 | 既定驗收完成 | 留言 CRUD 前端及 Edge 驗收 |
| M8-C2 專案活動時間軸 | 既定驗收完成 | 260/260 Node 當時回歸；Edge 6/6 |
| M8-C3 即時留言／Activity | 既定驗收完成 | 264/264 Node；Edge 專項 7/7；既有 Edge 52/52 |
| **M8-D 文件與 Git 結案** | **文件更新工具已提供；Git 結案以實際紀錄為準** | Commit／Push、HEAD＝origin/main 及乾淨工作樹必須個別檢查 |
| M9 搜尋統計與 UX | 未完成 | 後續規劃 |
| M10 部署與 Release | 未完成 | HTTPS、安全、跨瀏覽器、效能及正式 GitHub Release |

### M8-D 結案查核表

- [x] M8-A～C3 既定功能、相關專項與回歸測試已按終端截圖核對。
- [x] 確認原始 `data/`、`.env` 未被既有 Git 追蹤；未追蹤危險副檔名篩選無輸出（範圍性檢查）。
- [ ] 完成六份文件新增段落，核對 markdown、保留舊紀錄。
- [ ] 執行 `git diff --check`、`git status --short` 和完整 staged 檔名檢查。
- [ ] 確認不含正式 SQLite、`.env`、備份／除錯檔、測試密鑰。
- [ ] M8 集中 Commit／Push；以 `git status -sb`、`git rev-parse HEAD` 和 `git rev-parse origin/main` 核對同步。

**完成度僅能依里程碑定性估算，不是程式覆蓋率或正式產品驗收率。** 留言 Activity 目前限定三種留言事件；原規劃如包含完整邀請核准或所有專案活動審計，這些需求尚不能標記為完成。

---

<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->

<!-- M6-CURRENT-STATUS-2026-11-18 -->
## 最新里程碑狀態｜2026-11-18

- **M0～M5：** 已完成原有 Git 結案，M5 版本為 `93e7741`。
- **M6：** 既定程式與回歸驗收已通過，Node.js 171/171、Edge 52/52；六份文件與 Git 結案待以實際版本狀態確認。
- **M7～M10：** Socket.IO、協作／通知、搜尋／統計、正式部署安全與 Release 尚未完成。
- **整體 TaskFlow v1.0.0：約 75%**，為依規劃範圍的粗略估算；未發布正式版本。

> 下方歷史規劃表與 M5 時點文件保留原始紀錄；目前進度以上方快照及最新 M6 專章為準。
<!-- /M6-CURRENT-STATUS-2026-11-18 -->

<!-- M5-CURRENT-STATUS-2026-11-17 -->
## 最新里程碑狀態｜2026-11-17

- **M0～M4：** 已依各階段既定測試及 Git 紀錄結案。
- **M5-A～M5-C2：** 核心實作、Node.js 測試、Edge E2E 與手動任務操作均通過；**M5 最後文件及 GitHub 同步尚待完成**。
- **下一階段 M6：** Drag & Drop 任務拖曳及排序（未開始）。
- **M7～M10：** WebSocket、活動與通知、統計搜尋、發布驗收尚未開始。
- **整體 v1.0.0：約 65%**（規劃估計，非客觀測量）。

> 歷史章節保留當時的待辦文字，後續狀態以本節與文末 M5 結案摘要為準。
<!-- /M5-CURRENT-STATUS-2026-11-17 -->


## 一、專案目標

建立具備資料持久化、角色權限管理、多人協作及即時同步功能的全端專案管理平台。

本專案以簡化版 Trello / Jira 為設計方向，逐步整合前端介面、後端 API、SQLite 資料庫及 WebSocket 即時協作。

## 二、開發里程碑

| 階段 | 工作內容                 | 目前狀態               |
| ---- | ------------------------ | ---------------------- |
| M0   | 專案與 Git 初始化        | 已完成                 |
| M1   | 網站骨架與基本介面       | 核心完成，部分驗收待補 |
| M2   | SQLite 與專案 CRUD API   | 已完成                 |
| M3 | 使用者註冊、登入與前端 E2E | 已完成（M3-C2 8/8 PASS） |
| M4 | 成員管理與 RBAC | 核心驗收完成（Git 版本以實際提交為準） |
| M5 | 任務 CRUD 與 Kanban 看板 | 已結案（commit 93e7741） |
| M6 | Drag & Drop、排序與衝突控制 | 核心驗收完成（Node 171/171、Edge 52/52），Git 依實際提交核對 |
| M7   | WebSocket 即時同步       | 未開始                 |
| M8   | 留言、通知及活動紀錄     | 未開始                 |
| M9   | Dashboard 與搜尋篩選     | 未開始                 |
| M10  | 測試、安全檢查及 Release | 未開始                 |

## 三、開發原則

1. 以完整功能批次為單位進行開發。
2. 優先確保程式碼及資料結構正確。
3. 每個主要功能批次完成必要測試。
4. 相關文件在功能驗收後集中更新。
5. 定期完成 Git Commit 與 Push。
6. 所有程式碼與文件以 VS Code 管理。
7. 優先確保架構、資料與 API 一致性。
8. 開發日誌與測試紀錄採累積式維護。
9. 未通過測試的功能不得宣告完成。
10. 不為無實質內容的文字修改反覆建立 Commit。

## 四、文件管理制度

### README.md

用途：

- 專案介紹
- 主要功能
- 使用及安裝方法
- 目前開發狀態

更新時機：

- Milestone 完成
- 使用方法改變
- 重要功能新增

### CHANGELOG.md

用途：

- 產品功能新增
- 功能改善
- 修正及版本變更

更新時機：

- 每個有實質成果的功能批次

### DEVELOPMENT_LOG.md

用途：

- 開發歷程
- 技術決策
- 重要問題與修正
- 測試及版本紀錄

更新時機：

- 主要開發批次完成時

### TESTING.md

用途：

- 自動化測試結果
- 手動驗收結果
- 已知問題
- 尚未執行的測試

更新時機：

- 完成一組有意義的測試時

### ARCHITECTURE.md

用途：

- 前後端架構
- 資料庫結構
- API 設計
- 模組責任

更新時機：

- 架構、資料表或 API 發生實質變更時

### PROJECT_PLAN.md

用途：

- Milestone 規劃
- 階段進度
- 驗收標準
- 後續開發目標

更新時機：

- 開始新階段
- 完成階段
- 重要開發規劃變更時

## 五、每階段完成標準

每個主要 Milestone 必須具備：

- 可確認的功能開發成果
- 必要的測試與驗證
- 更新完成的相關文件
- 可追溯的 Git Commit
- GitHub Push
- 已確認的本機與遠端版本一致性

如有尚未完成的非核心測試，必須清楚列出，不得預先標記為 PASS。

## 六、版本目標

第一個正式穩定版本：

v1.0.0

預計包含：

- 使用者註冊與登入
- 專案 CRUD
- 成員管理
- 角色權限
- 任務 CRUD
- Kanban 拖曳
- WebSocket 多人即時同步
- 留言及活動紀錄
- Dashboard 與搜尋
- 完整測試
- GitHub Release

正式發布前必須完成必要的安全與整合驗收。

---

## 七、M0｜專案初始化

### 已完成

- 建立 C:\Projects\TaskFlow。
- 初始化 Git Repository。
- 設定 GitHub origin。
- 建立 docs、public、server。
- 建立核心專案文件。
- 完成首次 Commit 與 Push。
- 驗證 main 與 origin/main 同步。

### 版本紀錄

首次 Commit：

8c2a2e6

### 階段狀態

已完成。

---

## 八、M1｜網站骨架與基本介面

### 已完成實作

- Node.js 專案初始化
- Express 5 安裝
- HTTP Server 建立
- 健康檢查 API 建立
- 深色系 Dashboard
- Kanban 三欄介面
- 示範任務與統計
- 自動化測試程式建立

### 已完成測試

- npm test：4 passed、0 failed
- GET /api/health：PASS
- 首頁及靜態資源：PASS
- API 404：PASS
- Express Server 啟動：PASS
- 桌面版 Dashboard：PASS
- 六筆任務顯示：PASS
- 任務統計 6、2、2：PASS

### 尚待補充

- 手機響應式完整驗收
- 瀏覽器 Console 完整錯誤檢查

### 版本紀錄

- 功能 Commit：e4322a1
- 文件 Commit：2d0d710
- 後續文件同步：dceb225

### 階段狀態

核心功能完成。

部分瀏覽器驗收尚待補充。

---

## 九、M2｜SQLite 與專案 CRUD API

### M2-A｜SQLite 資料庫基礎

#### 已完成

- SQLite 初始化模組
- users 資料表
- projects 資料表
- project_members 關聯表
- 外鍵與完整性約束
- 查詢索引
- version 欄位
- 資料庫自動化測試

#### 測試結果

- SQLite Schema：6/6 PASS
- Express 回歸：4/4 PASS
- 總測試數：10
- 測試失敗：0
- SQLite 初始化：PASS
- 重複初始化：PASS
- Git 忽略規則：PASS

#### GitHub 版本

- 功能 Commit：d557020
- 後續文件整理：113765c
- GitHub Push：成功

#### 狀態

M2-A 核心開發、驗證與 GitHub 同步已完成。

### M2-B｜Project CRUD API

#### 已完成實作

- Project Repository
- Project Router
- POST /api/projects
- GET /api/projects
- GET /api/projects/:id
- PATCH /api/projects/:id
- DELETE /api/projects/:id
- 專案建立與 Owner 關聯 Transaction
- 基本角色限制
- 專案存取隔離
- version 樂觀鎖
- HTTP 409 版本衝突
- 請求驗證與錯誤處理
- 自動化 API 測試

#### 測試結果

- M1 Express：4/4 PASS
- M2-A SQLite：6/6 PASS
- M2-B Project CRUD：11/11 PASS
- 總測試數：21
- 通過：21
- 失敗：0
- GET /api/projects：HTTP 401 PASS
- GET /api/health：HTTP 200 PASS
- Express Server 啟動：PASS
- Dashboard 桌面版顯示：PASS

#### 尚待完成

- 已於 Commit a20aa36 完成文件、
  Git Commit、Push 及版本一致性驗證。

#### 狀態

核心功能與目前規劃的測試已通過。

M2-B 已於 Commit a20aa36 完成 GitHub 同步。

### M2-C｜資料持久化與整合驗收

#### 已完成

- SQLite 持久化與重新開啟驗證
- Transaction Rollback
- 外鍵、WAL 與資料完整性測試
- Project HTTP API 持久化驗收
- HTTP 異常輸入與身分限制
- 雙 Worker 並發版本衝突
- M1～M2-C 回歸測試 33/33 PASS

#### 版本紀錄

- M2-C Commit：878dfec。
- GitHub Push：已完成。
- 本機與遠端版本：已驗證一致。

#### 目前狀態

M2-C 已於 Commit 878dfec 同步 GitHub，M2 正式結案。

### M2 整體結案條件

只有當 M2-A、M2-B、M2-C 全部完成必要驗收後，才將整個 M2 標記為已完成。

---

## 十、M3｜使用者註冊與登入

### 預定功能

- 註冊帳號
- 登入
- 登出
- 安全密碼雜湊
- 登入 Session
- 使用者資料查詢
- Project API 身分驗證整合
- 未登入與權限錯誤處理

### 核心驗收

正式使用者登入後，才能操作自己有權限存取的專案。

未登入使用者不得直接修改專案資料。

### M3-A 已完成

- Authentication Foundation
- auth_sessions Schema
- scrypt 密碼雜湊
- 使用者帳號 Repository
- Session 建立、撤銷與過期
- Session 資料持久化
- M3-A 自動化測試 9/9 PASS
- 完整回歸測試 42/42 PASS

### M3-B 已完成（後端功能及驗收）

- 正式註冊、登入、登出、目前使用者 API。
- Session Cookie、CSRF、來源驗證與簡易登入限速。
- Project CRUD 已整合真實登入身分。
- 正式資料庫初始化新增 auth_sessions。
- 自動化測試：M3-B 11/11；全專案 53/53 PASS。
- 本機 Server 22 項正式 HTTP 操作驗收全部通過。
- 版本提交以 GitHub main 最新 Commit 為準。

### 後續工作

- M3-C：前端註冊、登入、登出及 Session 狀態整合
- 正式 Cookie 與 Session 整合
- 登入安全防護與 API 測試
- M3-C：前端登入介面及整合驗收

### 狀態

M3-A 已於 Commit 1f94ce7 同步 GitHub。
M3-B 後端功能已通過 53/53 自動化與 22/22 正式 HTTP 驗收；M3-C 尚未開始。


---

## 十一、M4｜成員管理與 RBAC

### 預定功能

- 查看專案成員
- 邀請成員
- 移除成員
- 修改成員角色
- Owner / Admin / Member 權限矩陣
- 專案資料存取隔離
- 權限變更驗證

### 狀態

M4-A～M4-C2 核心實作與既定測試完成；邀請核准流程仍未實作。版本以實際 Git 提交紀錄為準。

---

## 十二、M5｜任務 CRUD 與 Kanban

### 預定功能

- tasks 資料表
- 任務新增
- 任務查詢
- 任務修改
- 任務刪除
- 任務負責人
- 任務截止日期
- 任務優先度
- 任務狀態
- 正式 Kanban 資料串接

### 核心目標

將 M1 的六筆前端示範任務，逐步替換為正式資料庫任務資料。

### 狀態

M5-A～M5-C2 核心實作及測試已通過；六份文件整理與 Git 最終結案待完成。

---

## 十三、M6｜Drag & Drop

### 預定功能

- 任務拖曳
- 拖曳更新狀態
- 前端互動回饋
- API 更新與資料持久化
- 拖曳錯誤回復
- 任務版本衝突處理

### 狀態

尚未開始。

---

## 十四、M7｜WebSocket 即時同步

### 預定功能

- Socket.IO Server
- 使用者連線驗證
- 專案 Room
- 任務更新事件
- 跨瀏覽器即時同步
- 斷線重連
- 同步失敗處理
- 事件存取權限

### 核心目標

多位使用者操作同一專案時，能即時看到其他授權成員的任務更新。

### 狀態

尚未開始。

---

## 十五、M8｜留言、通知與活動紀錄

### 預定功能

- 任務留言
- 活動紀錄
- 使用者通知
- 任務異動紀錄
- 協作事件追蹤

### 狀態

尚未開始。

---

## 十六、M9｜Dashboard 與搜尋篩選

### 預定功能

- 專案統計
- 任務完成率
- 逾期任務統計
- 成員工作量統計
- 任務搜尋
- 任務篩選
- Dashboard 資料分析

### 狀態

尚未開始。

---

## 十七、M10｜測試、安全檢查與 Release

### 預定工作

- 全面自動化回歸測試
- 端對端功能驗收
- 資料庫完整性檢查
- 權限安全性檢查
- API 錯誤處理驗收
- 多人同步測試
- 文件完整性檢查
- GitHub Release Notes
- v1.0.0 正式版本發布

### 正式發布條件

- 核心功能完成
- 重大錯誤已修正
- 關鍵安全測試通過
- 資料持久化可靠
- 多使用者權限正確
- 即時同步運作正常
- 文件與程式碼一致
- GitHub 版本同步完成

### 狀態

尚未開始。

---

## 十八、目前開發總結

### 已完成

- M0 專案初始化
- M1 網站核心介面
- M2-A SQLite Schema
- M2-B Project CRUD API
- M2-C 自動化測試 33/33 PASS，已同步 GitHub
- M3-A 9/9 PASS，Commit 1f94ce7 已同步
- M3-B 11/11 PASS；完整回歸測試 53/53 PASS
- M3-B 正式本機 HTTP 驗收 22/22 PASS

### 最近驗收

- M3-C1：已於 Commit `32361a6` 同步 GitHub。
- M3-C2：Edge E2E 8/8、既有回歸 59/59 PASS。

### 下一階段

M4：專案成員管理與 RBAC 權限開發。

### 最終目標

TaskFlow v1.0.0 多人專案管理平台。

## M3-C1｜前端身分驗證驗收（2026-11-16）

### 已完成

- 註冊與登入頁面。
- Dashboard Session 驗證。
- 登出介面。
- 登入者名稱顯示。
- SQLite 專案列表與建立專案。
- 前端 Smoke Tests：6/6 PASS。
- 完整回歸測試：59/59 PASS。
- 使用者回報主要瀏覽器操作驗收通過。

### M3-C1 版本管理

- GitHub Commit `32361a6` 已同步，SHA 比對一致。

### 尚待完成
- 正式任務 CRUD、完整成員權限及 WebSocket。
- 正式 HTTPS、其他瀏覽器及部署級安全驗收。

### 下一階段

- M3-C2：額外介面與端對端驗收。
- M4：專案成員管理與 RBAC。
- M5：正式任務 CRUD。

## M3-C2｜正式 E2E 驗收結果（2026-11-16）

### 已完成
- M3-C1：前端 Authentication。
- M3-C1 GitHub Commit：`32361a6`。
- M3-C2 Microsoft Edge E2E：8/8 PASS。
- M1～M3-C1 Regression：59/59 PASS。
- 真實瀏覽器登入、Session、專案建立及登出驗證。

### 版本控制
- M3-C2 將於功能驗收後集中 Commit／Push。
- GitHub 最終狀態以同步後 SHA 檢查為準。

### 下一階段：M4
- 專案成員邀請。
- 成員列表及角色管理。
- Owner、Admin、Member 權限矩陣。
- 成員管理 API 與權限自動化測試。

### 後續限制
- 正式 HTTPS、其他瀏覽器、即時同步及部署驗收尚未完成。

<!-- M4-SUMMARY-2026-11-17 -->
## M4 結案摘要與 M5 啟動條件（2026-11-17）

### M4 完成項目

- M4-A：Member Repository 與 RBAC，11/11 PASS。
- M4-B：成員管理 REST API，18/18 PASS。
- M4-C1：成員管理前端，6/6 PASS。
- M4-C2：Edge 多帳號 E2E，15/15 PASS。
- 全部 Node.js 回歸：94/94 PASS。
- 合併 Edge E2E：23/23 PASS。
- Failed：0。

### M4 已完成的核心功能

- 專案成員管理。
- 已註冊成員直接加入。
- 角色與權限控制。
- 成員移除及自行退出。
- 版本衝突偵測。
- 資料存取隔離。
- 前後端整合驗收。

### M4 後續限制

- 邀請接受、拒絕及到期機制尚未實作。
- M4 當時正式任務 CRUD 尚未實作；已於 M5 完成。
- Socket.IO 即時協作尚未實作。
- 正式部署安全驗收尚未完成。

### M5 下一階段

1. 設計 tasks Schema 與資料庫遷移策略。
2. 實作 Task Repository。
3. 建立 Task REST API。
4. 導入角色權限、交易與版本控制。
5. 建立任務管理自動化測試。
6. 將 M1 示範 Kanban 整合至正式 SQLite 任務。
7. 在完整驗收後集中更新文件與 GitHub。

### 版本目標

TaskFlow v1.0.0 仍屬開發中版本。

M4 結案不代表整體產品完成。

<!-- M5-SUMMARY-2026-11-17 -->
## M5｜任務管理完成情況與正式結案條件（2026-11-17）

### 實際完成範圍

| 子階段 | 交付成果 | 驗收結果 | 狀態 |
| --- | --- | --- | --- |
| M5-A | Task Schema、Repository、增量初始化 | 15/15 PASS | 核心完成 |
| M5-B | Task REST API、Session／CSRF／RBAC／409 | 20/20 PASS | 核心完成 |
| M5-C1 | 正式任務看板、表單、權限及資料持久化 | 8/8 PASS + 六項手動操作 | 核心完成 |
| M5-C2 | 四個 Edge Session 的多人任務操作 | 14/14 PASS | 核心完成 |
| M5 整體回歸 | Node.js 137/137；Edge 37/37 | 0 fail，0 skipped | 核心驗收通過 |
| M5 文件與 Git | 六份文件、最後 Diff、Commit、Push | 尚待執行／確認 | 待結案 |

### M5 最終結案核對表

- [x] Task Schema、Repository 與 REST API 實作。
- [x] SQLite 增量初始化且保留既有資料。
- [x] 完成正式 Task Kanban、狀態、指派、優先度、日期及版本處理。
- [x] 完成 Node.js 全套回歸 137/137。
- [x] 完成 Edge E2E 37/37。
- [x] 完成六項手動任務操作驗收。
- [ ] 六份文件集中更新後執行內容與 Git Diff 審查。
- [ ] 暫存檔案安全檢查（不提交 SQLite、`.env`、密鑰或備份）。
- [ ] M5 Git Commit／Push 及本機、`origin/main` SHA 核對。

以上未勾項目必須於完成後再人工更新，不可因產生本次文件就預先標記 PASS。

### 後續里程碑

1. M6：Drag & Drop、排序及後端權限一致性驗證。
2. M7：WebSocket 多使用者即時資料同步及版本競爭處理。
3. M8：留言、通知及活動紀錄。
4. M9：統計、搜尋、過濾與介面改善。
5. M10：正式部署、HTTPS、效能、安全、跨瀏覽器與版本發布驗收。

TaskFlow v1.0.0 **尚未正式發布**。整體工作量目前估計約完成 65%，屬規劃判斷而非精準進度計量。
<!-- /M5-SUMMARY-2026-11-17 -->

<!-- M6-SUMMARY-2026-11-18 -->
## M6｜Drag & Drop 最終驗收與 M7 啟動條件（2026-11-18）

### M6 完成範圍

| 子階段 | 交付成果 | 已實測結果 |
| --- | --- | --- |
| M6-A | 任務排序 Repository、交易、position、version | 11/11 PASS |
| M6-B | `PATCH .../move`、Session、CSRF、RBAC、409 | 14/14 PASS |
| M6-C | 真實三欄拖放、權限、衝突重載 | 9/9 PASS |
| M6-D | 四個 Edge Session 的真實拖放與資料持久化 E2E | 15/15 PASS |
| 全套 Node.js | 含 M6 專項在內的既有回歸 | **171/171 PASS** |
| 全套 Edge | Auth 8 + Members 15 + Tasks 14 + Drag 15 | **52/52 PASS** |

### M6 結案核對表

- [x] Drag & Drop 前端實作及角色限制。
- [x] 同欄位置與跨欄狀態移動、SQLite 持久化。
- [x] Session／CSRF／RBAC／封存限制及 Version 衝突處理。
- [x] M5-C2 監聽路徑同步修復，回歸 14/14。
- [x] Node.js 171/171、Edge E2E 52/52。
- [x] `git diff --check` 無格式錯誤（依本機截圖）。
- [ ] 六份文件落盤後審查 Diff 與歷史紀錄。
- [ ] 暫存清單無除錯文字檔、正式 SQLite、備份、密鑰與 `.env`。
- [ ] Git Commit／Push 成功，工作樹乾淨且本機 HEAD 等於 origin/main。

**最後三個核取項目須依實際 Git 執行結果核對，文件產生工具不會自行將其改成已完成。**

### 整體進度與未完成範圍

- M0～M5 已完成 Git 版本結案（M5 commit `93e7741`）。M6 核心開發與既定測試已完成，Git 結案另需確認。
- TaskFlow v1.0.0 開發完成度粗估 **約 75%**，非精確工程量度，也不代表已有正式 Release。
- M7：WebSocket／Socket.IO 多使用者即時同步與重新連線恢復。
- M8：留言、通知、活動紀錄與邀請流程完善。
- M9：統計、搜尋、篩選與產品體驗。
- M10：部署、HTTPS、跨瀏覽器、效能、安全驗收與正式 GitHub Release。
<!-- /M6-SUMMARY-2026-11-18 -->

<!-- TASKFLOW-M7-CLOSEOUT-2026-11-19 -->

## M7｜即時協作完成範圍與後續規劃（2026-11-19）

| 子階段 | 核心交付 | 結案證據 |
| --- | --- | --- |
| M7-A | Socket.IO、Session／Origin／Room 權限 | M7-A 專項及完整回歸 |
| M7-B | 成功 REST 寫入才觸發通知 | M7-B 專項及完整回歸 |
| M7-C | 前端即時同步、重連補抓 | Node／Edge 專項與回歸 |
| M7-D | 多帳號併發、409、隔離、排序、撤權及登出 | `realtime-resilience.e2e.js` 和回歸結果 |

### 結案檢查

- [x] M7-A～M7-C 既定功能與專項驗收。
- [ ] M7-D 本機測試與全部回歸重新驗證 0 fail。
- [ ] 六份文件保存歷史、比對修改內容。
- [ ] 確認不提交正式 SQLite、`.env`、密鑰、暫存日誌及備份。
- [ ] 完成 Git Commit／Push，確認 HEAD 與 origin/main 一致且工作樹乾淨。

以上待辦需用實際終端機結果核對，文件產生器不會自動假定完成。

### 尚未完成

M8 通知／留言及協作延伸、M9 統計／搜尋、M10 部署及安全壓力驗收，正式 v1.0.0 Release 另需審核。

<!-- /TASKFLOW-M7-CLOSEOUT-2026-11-19 -->
