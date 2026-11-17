"use strict";

// TaskFlow M4 結案：集中更新六份文件。
// 不執行 Git、不修改正式 SQLite、不刪除既有開發紀錄。

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const marker = "<!-- M4-SUMMARY-2026-11-17 -->";

const sections = {
  "README.md": `
## M4｜成員管理與 RBAC 驗收總結（2026-11-17）

### 階段成果

- M4-A：Member Repository、Owner / Admin / Member 權限矩陣，11/11 PASS。
- M4-B：成員 REST API，18/18 PASS。
- M4-C1：成員管理頁面、Dashboard 入口，6/6 PASS。
- M4-C2：四組獨立 Edge BrowserContext、五個測試帳號，15/15 PASS。
- 最新 npm test：94/94 PASS。
- 最新 npm run test:e2e:all：23/23 PASS。
- 以上測試均為 0 failed。

### 已實作功能

- 查看專案成員清單。
- 依 Email 新增已註冊成員。
- 修改 Admin、Member 角色。
- 依照權限移除成員。
- Admin、Member 自行退出專案。
- Owner 身分保護。
- Session、CSRF、同源及角色權限檢查。
- 專案 version 版本衝突偵測。
- 跨帳號資料隔離。
- 前端安全文字渲染。

### 本機驗證指令

    npm test
    npm run test:e2e:members
    npm run test:e2e:all

### M4 範圍限制

- 目前是依 Email 直接加入已註冊帳號，不是完整邀請確認流程。
- Kanban 六張卡片仍為示範資料；正式 Task CRUD 排定於 M5。
- Socket.IO 即時同步、正式 HTTPS、跨瀏覽器及部署級安全測試尚未完成。
- 驗收結果只代表既定測試範圍通過，不代表產品不存在其他潛在問題。
`,

  "CHANGELOG.md": `
### M4 — 2026-11-17｜Member Management / RBAC

#### Added

- M4-A：Member Repository 與角色權限矩陣。
- M4-B：GET、POST、PATCH、DELETE 成員管理 API。
- M4-C1：成員管理介面與 Dashboard 入口。
- M4-C2：Microsoft Edge 多帳號瀏覽器端對端驗收。
- 新增 test:e2e:members、test:e2e:all 指令。

#### Verified

- M4-A：11/11 PASS。
- M4-B：18/18 PASS。
- M4-C1：6/6 PASS。
- M4-C2：15/15 PASS。
- 完整 Node.js 回歸：94/94 PASS。
- 合併 Edge E2E：23/23 PASS。
- Failed：0。

#### Security and Integrity

- 非專案成員資料隔離。
- Session Cookie 與 CSRF 保護。
- Owner 身分與權限限制。
- 舊版資料操作回傳 HTTP 409。
- SQLite Transaction 與資料一致性驗證。
- E2E 測試資料與正式 SQLite 隔離。

#### Remaining

- 完整邀請確認與到期機制。
- 正式任務 CRUD 與 Kanban 資料整合。
- WebSocket 即時同步。
- 正式部署安全與跨瀏覽器驗收。
`,

  "docs/ARCHITECTURE.md": `
## M4｜Member Management 與 RBAC 實際架構（2026-11-17）

### Frontend

- public/dashboard-auth.js：提供成員管理入口。
- public/members.html：成員管理頁面結構。
- public/members.css：成員管理介面樣式。
- public/members.js：操作事件、API 請求與資料顯示。

### Backend

- server/server.js：掛載成員 Router，沿用 Authentication Middleware。
- server/member-routes.js：請求驗證與 HTTP 回應。
- server/member-repository.js：成員資料操作、角色權限及交易控制。

### 資料庫

使用既有核心資料表：

- users
- projects
- project_members
- auth_sessions

M4 並未新增 tasks 資料表。正式任務管理留待 M5。

### 成員管理 API

| 方法 | 路徑 | 功能 |
| --- | --- | --- |
| GET | /api/projects/:id/members | 查詢成員 |
| POST | /api/projects/:id/members | 新增成員 |
| PATCH | /api/projects/:id/members/:userId | 修改角色 |
| DELETE | /api/projects/:id/members/:userId?version=N | 移除或退出 |

### 權限控制

- Owner 可以管理成員與角色。
- Admin 可以依權限矩陣管理 Member。
- Member 只能查看成員及自行退出。
- 非成員不能取得指定專案的私人資料。
- Owner 不能透過一般成員管理 API 自行退出。
- 所有權限限制均由後端重新檢查。

### 資料一致性

- 新增、修改及移除成員使用 SQLite Transaction。
- projects.version 用於樂觀並發控制。
- 過期版本操作回傳 HTTP 409。
- 前端取得版本衝突後重新載入資料。
- 不採信客戶端提供的使用者身分欄位。

### 安全設計

- Session Cookie
- CSRF Token
- 同源要求
- 後端 RBAC 驗證
- 非成員資料隔離
- textContent 安全文字渲染

### 尚未實作

- 完整邀請接受、拒絕與到期流程。
- 正式 Task CRUD。
- Kanban 任務資料持久化。
- Socket.IO 即時同步。
- 完整正式部署安全稽核。
`,

  "docs/DEVELOPMENT_LOG.md": `
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
`,

  "docs/PROJECT_PLAN.md": `
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
- 正式任務 CRUD 尚未實作。
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
`,

  "docs/TESTING.md": `
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
`,
};

function read(file) {
  const full = path.join(root, file);

  if (!fs.existsSync(full)) {
    throw new Error(`找不到必要文件：${file}`);
  }

  return fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
}

function replaceOne(text, oldText, newText, file) {
  if (text.includes(newText)) {
    return text;
  }

  if (!text.includes(oldText)) {
    throw new Error(
      `${file} 找不到預期原文，停止修改：${oldText.slice(0, 60)}`,
    );
  }

  return text.replace(oldText, newText);
}

function addLatest(text, block, file) {
  if (text.includes(marker)) {
    return text;
  }

  if (file === "CHANGELOG.md") {
    return replaceOne(
      text,
      "## [Unreleased]",
      `## [Unreleased]\n\n${marker}\n${block.trim()}\n`,
      file,
    );
  }

  return `${text.trimEnd()}\n\n${marker}\n${block.trim()}\n`;
}

function update(file, text) {
  if (file === "README.md") {
    text = replaceOne(text, "RBAC（M4 規劃）", "RBAC（M4 核心已實作）", file);

    text = replaceOne(
      text,
      "- M4～M10：尚未開始。",
      "- M4：成員管理與 RBAC 已通過既定驗收（Node.js 94/94、Edge E2E 23/23 PASS）。\n- M5～M10：尚未開始。",
      file,
    );

    text = replaceOne(
      text,
      "目前仍屬開發階段：帳號驗證、前端登入及 SQLite 專案建立已完成；完整 RBAC、任務管理與多人同步仍待實作。",
      "目前仍屬開發階段：帳號驗證、專案與成員管理、RBAC 核心功能已完成既定測試；正式邀請核准、任務管理與多人即時同步仍待實作。",
      file,
    );
  }

  if (file === "docs/PROJECT_PLAN.md") {
    text = text.replace(
      /^\| M3\s*\|[^\n]*$/m,
      "| M3 | 使用者註冊、登入與前端 E2E | 已完成（M3-C2 8/8 PASS） |",
    );

    text = text.replace(
      /^\| M4\s*\|[^\n]*$/m,
      "| M4 | 成員管理與 RBAC | 核心驗收完成（Git 版本以實際提交為準） |",
    );

    const start = text.indexOf("## 十一、M4｜成員管理與 RBAC");
    const end = text.indexOf("## 十二、M5｜", start);

    if (start < 0 || end < 0) {
      throw new Error("找不到 PROJECT_PLAN 的 M4 章節，停止修改。");
    }

    const before = text.slice(start, end);

    const after = replaceOne(
      before,
      "### 狀態\n\n尚未開始。",
      "### 狀態\n\nM4-A～M4-C2 核心實作與既定測試完成；邀請核准流程仍未實作。版本以實際 Git 提交紀錄為準。",
      file,
    );

    text = text.slice(0, start) + after + text.slice(end);
  }

  if (file === "docs/ARCHITECTURE.md") {
    text = replaceOne(
      text,
      "Project CRUD API 雖然已於後端建立，但尚未串接正式的前端專案管理介面。",
      "Project CRUD 已與前端專案清單整合，M4 亦新增成員管理頁及權限 API；正式任務看板仍使用示範資料。",
      file,
    );

    text = replaceOne(
      text,
      "M4 將建立完整的權限矩陣、成員管理及角色變更機制。",
      "M4 已建立成員管理、角色矩陣與版本驗證；具邀請接受／拒絕的完整流程尚未實作。",
      file,
    );

    text = replaceOne(
      text,
      "## 十二、目前架構限制與後續擴充",
      "## 十二、M2 時點架構限制與後續擴充（歷史紀錄）",
      file,
    );
  }

  return addLatest(text, sections[file], file);
}

const outputs = new Map();
const changed = [];

// 先讀取所有文件並計算更新內容
for (const file of Object.keys(sections)) {
  const original = read(file);
  const updated = update(file, original);

  outputs.set(file, {
    original,
    updated,
  });

  if (original !== updated) {
    changed.push(file);
  }
}

// 全部檢查通過後才寫入文件
for (const file of changed) {
  fs.writeFileSync(path.join(root, file), outputs.get(file).updated, "utf8");

  console.log(`已更新：${file}`);
}

if (changed.length === 0) {
  console.log("六份文件已更新過，未重複加入內容。");
}

console.log("M4 文件更新完成，尚未 Git Commit／Push。");

console.log("下一步：git diff --check、git diff --stat。");
