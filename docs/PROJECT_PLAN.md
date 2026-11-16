# TaskFlow｜專案開發計畫

## 一、專案目標

建立具備資料持久化、角色權限管理、多人協作及即時同步功能的全端專案管理平台。

本專案以簡化版 Trello / Jira 為設計方向，逐步整合前端介面、後端 API、SQLite 資料庫及 WebSocket 即時協作。

## 二、開發里程碑

| 階段 | 工作內容                 | 目前狀態               |
| ---- | ------------------------ | ---------------------- |
| M0   | 專案與 Git 初始化        | 已完成                 |
| M1   | 網站骨架與基本介面       | 核心完成，部分驗收待補 |
| M2   | SQLite 與專案 CRUD API   | 已完成                 |
| M3   | 使用者註冊與登入         | M3-B 後端驗收完成      |
| M4   | 成員管理與 RBAC          | 未開始                 |
| M5   | 任務 CRUD 與 Kanban 看板 | 未開始                 |
| M6   | Drag & Drop              | 未開始                 |
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

尚未開始。

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

尚未開始。

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

### 正在處理

- M3-B 文件與程式集中版本管理；依 GitHub main 最新提交核對

### 下一階段

M3-C：前端註冊、登入、登出與 Session 整合。

### 最終目標

TaskFlow v1.0.0 多人專案管理平台。
