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

目前為 M0 規劃版本。

所有主要應用模組尚待實作。
