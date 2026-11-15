# TaskFlow｜多人專案管理平台

TaskFlow 是一套以多人協作為核心的全端專案管理系統，
目標是提供專案建立、成員管理、任務追蹤及即時同步功能。

## 專案目標

建立一套簡化版的 Trello / Jira，
讓多位使用者可以透過同一個網站共同管理工作進度。

## 規劃功能

- 使用者註冊、登入及登出
- 專案建立、編輯及封存
- 專案成員邀請及管理
- RBAC 角色權限控制
- Kanban 任務看板
- 任務新增、編輯、刪除及指派
- Drag & Drop 任務拖曳
- WebSocket 多人即時同步
- 任務留言、通知及活動紀錄
- 統計儀表板及搜尋篩選

## 技術規劃

| 層級            | 技術                  |
| --------------- | --------------------- |
| Frontend        | HTML、CSS、JavaScript |
| Backend         | Node.js、Express      |
| Database        | SQLite                |
| API             | REST API              |
| Authentication  | 後端身分驗證          |
| Authorization   | RBAC                  |
| Real-time       | Socket.IO             |
| Version Control | Git、GitHub           |

## 專案狀態

- 已完成階段：M0 — 專案初始化
- M1：網站雛型與基本測試已完成，部分瀏覽器驗收待補
- 目前階段：M2 — SQLite 資料庫與專案 CRUD API（進行中）
- M2-A：SQLite 資料庫基礎與自動化測試已通過
- M2-B：Project CRUD API 尚未開始
- 開發狀態：建置中
- 正式版本：尚未發布
- 預定首個正式版本：v1.0.0

M1 已建立 Express Server、Dashboard、
三欄 Kanban 看板及基礎自動化測試。

M2-A 已建立三張 SQLite 核心資料表，
並通過 10 項自動化測試，0 項失敗。

目前 M2-A 尚待完成 GitHub 提交。
正式登入、專案 CRUD 與多人即時同步尚未實作。

## M1 本機開發說明

### 系統需求

- Node.js 22 或以上支援中的 LTS 版本
- npm
- VS Code

### 安裝相依套件

在 TaskFlow 專案根目錄執行：

`npm install`

### 啟動開發伺服器

`npm run dev`

網站網址：

http://localhost:3000

健康檢查 API：

http://localhost:3000/api/health

### 自動化測試

`npm test`

目前 M1 Express Smoke Tests：
4 個測試項目通過，0 個失敗。

### M1 已建立功能

- Node.js 與 Express 5 開發環境
- Express HTTP Server
- 健康檢查 API
- 深色系 Dashboard
- 三欄 Kanban 看板
- 六筆示範任務
- 任務數量統計
- 響應式樣式
- Node.js 自動化測試

### M1 限制

目前為介面雛型。

尚不支援真正的使用者登入、
資料庫儲存、任務 CRUD、拖曳或多人同步。

## M2-A｜SQLite 資料庫初始化

本階段使用 Node.js 內建的 node:sqlite，
建立 TaskFlow 的正式資料庫基礎。

### 資料庫初始化

在 TaskFlow 專案根目錄執行：

`npm run db:init`

### 執行自動化測試

`npm test`

目前 M2-A 測試結果：

- 自動化測試總數：10
- 通過：10
- 失敗：0
- SQLite Schema 測試：6/6 PASS
- Express 回歸測試：4/4 PASS

### 資料庫儲存位置

`data/taskflow.db`

資料庫檔案已由 .gitignore 排除，
不會提交至 GitHub。

### 已建立的核心資料表

- users：使用者基本資料
- projects：專案資料
- project_members：專案成員與角色

### 本階段限制

M2-A 目前僅完成資料庫基礎，
尚未提供正式的 Project CRUD API。

新增、查詢、修改及刪除專案的 API，
將於 M2-B 階段實作。

```

### Step 3｜確認最後的排列順序

修改完畢後，你的 README 應該長這樣：

<box border radius="lg" padding={3} gap={2}>
  <row align="center" gap={2}>
    <icon name="file-text" color="secondary"/>
    **README.md**
  </row>
  <box padding={{left:4}} gap={2}>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 專案目標</row>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 規劃功能</row>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 技術規劃</row>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 專案狀態（更新）</row>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> M1 本機開發說明</row>
    <box border={{left:{size:3,color:"#22a06b"}}} padding={{left:3,top:2,bottom:2}} gap={1}>
      <row align="center" gap={2}>
        <icon name="plus-circle" color="success" size="sm"/>
        **M2-A｜SQLite 資料庫初始化**
      </row>
      <text color="secondary" size="xs">本次新增於 M1 說明之後</text>
    </box>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 開發方式</row>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 專案文件</row>
    <row align="center" gap={2}><icon name="hash" color="secondary" size="sm"/> 授權</row>
  </box>
</box>

這樣 M1 和 M2-A 各自都有清楚的說明，日後進入 M2-B、M3 時，也能按照同樣的結構繼續擴充。

---

## 三、完成後需要做什麼？

1. 按 `Ctrl + S` 儲存 `README.md`。
2. 不要刪除 M0、M1 的其他說明。
3. 接著再處理 `CHANGELOG.md`、`DEVELOPMENT_LOG.md`、`TESTING.md` 等本批次文件。

**目前先不用 Commit 或 Push。** 我們等 M2-A 的必要文件都更新完畢，再一次提交到 GitHub，就不必像之前那樣反覆 Commit。

你現在先完成 README 這兩處修改即可，接下來就可以繼續處理 M2-A 的其他文件，並正式進入 M2-B 的 Project CRUD 開發。

## 開發方式

本專案使用 VS Code 進行開發，
所有程式碼與文件存放於獨立的 TaskFlow 專案資料夾。

每個開發批次原則上應完成：

1. 功能開發
2. 必要驗證及測試
3. 文件同步更新
4. Git Commit
5. GitHub Push
6. 檢查版本一致性

## 專案文件

- `CHANGELOG.md`：產品功能變更紀錄
- `docs/DEVELOPMENT_LOG.md`：詳細開發歷程
- `docs/PROJECT_PLAN.md`：開發進度與里程碑
- `docs/ARCHITECTURE.md`：系統架構
- `docs/TESTING.md`：測試與驗證紀錄

## 授權

目前尚未選定授權條款。
```
