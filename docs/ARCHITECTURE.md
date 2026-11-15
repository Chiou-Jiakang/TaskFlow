# TaskFlow｜系統架構說明

## 一、架構概述

TaskFlow 採用前後端分離責任的全端架構。

本文件描述目前的規劃架構，
不代表各模組已經實際完成。

## 二、Frontend

規劃技術：

- HTML5
- CSS3
- JavaScript

主要負責：

- 顯示使用者介面
- 處理表單與互動
- 顯示專案及任務資料
- 發送 API 請求
- 接收 Socket.IO 即時事件

## 三、Backend

規劃採用 Node.js 與 Express。

主要服務模組：

- Auth Service：身分驗證
- Project Service：專案管理
- Task Service：任務管理
- Permission Service：權限檢查
- Activity Service：活動紀錄
- Socket.IO：即時事件通知

## 四、Database

規劃使用 SQLite。

初步資料表：

- users
- projects
- project_members
- tasks
- comments
- activities

正式欄位、外鍵及索引將於後續階段設計。

## 五、角色權限

預計採用：

- Owner
- Admin
- Member

所有受保護的操作都必須由後端確認權限。

詳細權限矩陣將於 M4 確定。

## 六、多人即時同步

規劃流程：

1. 使用者發送更新請求。
2. 後端驗證身分與操作權限。
3. 資料庫執行更新。
4. 更新成功後發布 Socket.IO 事件。
5. 其他授權使用者收到更新通知。
6. 前端取得或套用最新資料。

資料庫是持久化資料的權威來源。

後續需處理版本衝突、斷線重連、
事件授權及同步失敗等問題。

## 七、安全性

規劃包含：

- 密碼安全雜湊
- 身分驗證
- RBAC
- 輸入驗證
- SQL 參數化查詢
- 專案資料存取隔離
- 錯誤處理
- 機密設定保護

## 八、架構狀態

目前進入 M1 網站骨架與介面驗收階段。

已建立：

- Express HTTP Server
- GET /api/health
- HTML / CSS / JavaScript 前端
- 三欄 Kanban 示範看板
- Node.js 自動化測試

尚未建立：

- SQLite 資料庫
- 正式使用者驗證
- REST API 資料 CRUD
- RBAC 權限管理
- Socket.IO 即時同步
- 正式多人協作功能

## 九、M1 實際程式架構

### Backend

檔案：server/server.js

職責：

- 啟動 Express HTTP Server
- 提供靜態網站
- 處理 GET /api/health
- 處理不存在的 API 路徑

### Frontend

檔案：

- public/index.html
- public/style.css
- public/app.js

職責：

- 呈現 Dashboard 及 Kanban 版面
- 渲染示範任務
- 計算各狀態任務數量
- 提供響應式介面

### Testing

檔案：tests/server.test.js

使用 Node.js 內建測試框架。

測試項目：

- 健康檢查 API
- 首頁及靜態資源
- 不存在的 API 路徑

### 資料流程

M1：

前端示範資料
→ JavaScript 渲染
→ Dashboard / Kanban

未來 M2 至 M7：

前端
→ REST API
→ Express Services
→ SQLite

資料庫操作成功後，
再透過 Socket.IO 通知其他授權使用者。

### 架構設計原則

資料庫為正式資料的權威來源。

所有正式的身分驗證與權限判斷
必須由後端執行。

M1 僅為介面及伺服器基礎，
不代表多人協作已經完成。

---

## M2-A｜SQLite 資料庫實際架構

### 已建立檔案

- server/schema.sql：資料表及約束
- server/db.js：SQLite 連線與 Schema 初始化
- server/init-db.js：資料庫初始化工具
- tests/database.test.js：資料庫自動化測試

### 核心資料表

- users
- projects
- project_members

### 資料庫設定

- 使用 Node.js node:sqlite。
- 啟用 Foreign Keys。
- 檔案型資料庫使用 WAL 模式。
- 使用索引與資料完整性約束。
- 正式資料庫不提交至 GitHub。

### 後續工作

M2-B 將開始建立 Project CRUD API。
