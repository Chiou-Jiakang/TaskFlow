"use strict";
// TaskFlow M6 文檔結案器（只修改六份 Markdown 文件，不提交 Git，也不觸碰正式資料庫）。
// 在 C:\Projects\TaskFlow 中使用：
// node .\scripts\close-m6-docs.js --dry-run
// node .\scripts\close-m6-docs.js
// 重複執行不會重複插入 M6 段落。文件副本保存在 Windows TEMP 中。
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const MARK = "M6-SUMMARY-2026-11-18";
const CURRENT = "M6-CURRENT-STATUS-2026-11-18";
const FILES = ["README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md"];

const SECTIONS = {
  "README.md": "## M6｜Kanban 拖放與排序（2026-11-18）\n\n### 已完成\n\n- M6-A：`server/task-order-repository.js` 與排序交易，處理同欄重排、跨欄移動、position 重排與 version 樂觀鎖。\n- M6-B：`server/task-order-routes.js` 與 `PATCH /api/projects/:id/tasks/:taskId/move`；沿用 Session、CSRF、RBAC、封存限制及 HTTP 409。\n- M6-C：`public/task-board.js`、`public/task-board.css` 的 HTML Drag & Drop；Owner/Admin 可拖曳，Member 不具有排序權限。更新成功後重新取得正式資料；版本衝突時重載，避免顯示與 SQLite 不一致。\n- M6-D：`e2e/kanban-drag.e2e.js` 使用 Microsoft Edge 多身分情境測試實際滑鼠拖放、重整持久化、權限與版本衝突。\n- M5-C2 舊 E2E 的兩處 Owner 狀態修改等待路徑，已配合 M6 從原 Task PATCH 改為 `/move`；Member 的授權狀態更新仍沿用原 PATCH API。\n\n### 驗收（本機終端機截圖，2026-11-18）\n\n- M6-A：11/11；M6-B：14/14；M6-C：9/9；M6-D：15/15，均為既定專項測試通過。\n- `npm test`：**171/171 PASS**；包含上述 Node.js 專項測試，不額外累加。\n- 依序執行四套 Edge E2E：**52/52 PASS**（Auth 8、Member 15、Task 14、Kanban Drag 15），0 FAIL、0 SKIP。\n- 兩個完整程序合計為 223 次通過的測試計數，非 223 項獨立產品需求或安全保證。\n\n### 使用與驗收指令\n\n```powershell\nnpm test\nnpm run test:e2e:drag\nnpm run test:e2e:all\n```\n\n`test:e2e:all` 應包含 `auth-flow.e2e.js`、`member-flow.e2e.js`、`task-flow.e2e.js`、`kanban-drag.e2e.js`；如環境資源造成競爭，可使用 `node --test --test-concurrency=1` 依序執行四個檔案。此說明不代表已驗證所有作業系統或瀏覽器。\n\n### 尚未完成\n\nM7 WebSocket／Socket.IO 即時推播與離線恢復；M8 協作留言及通知；M9 搜尋統計；M10 HTTPS 部署、跨瀏覽器、效能與完整安全驗收。正式 TaskFlow v1.0.0 尚未發布。M6 Git 是否結案以實際 `git status -sb`、`HEAD` 及 `origin/main` 比對為準。",
  "CHANGELOG.md": "### M6 — 2026-11-18｜Kanban Drag & Drop / Ordering\n\n#### Added\n\n- M6-A：Task Order Repository，支援同欄排序、跨欄狀態移動、position 重新編號、樂觀鎖與交易回滾。\n- M6-B：新增 `PATCH /api/projects/:id/tasks/:taskId/move`，整合 Session Cookie、CSRF、RBAC、封存專案限制及 409 衝突處理。\n- M6-C：三欄看板拖曳、放置位置提示、角色限制與資料重載。\n- M6-D：四個獨立 Edge BrowserContext 的多人拖曳 E2E，涵蓋滑鼠拖放、持久化、跨欄、管理權限、版本競爭和封存限制。\n- 將 Kanban Drag E2E 納入 `test:e2e:all`，並保留原有測試指令。\n\n#### Fixed\n\n- 排除真實滑鼠拖曳事件已進入 `drop` 但未發送 `/move` 請求的情況；經 Drag Event Trace 與卡片位置資訊定位後修正，M6-D 回歸 15/15 PASS。\n- 修正 M5-C2 中 Owner 狀態更新 E2E 的兩處 `waitForResponse` 路徑，讓測試監聽新的 `/move` API；未放寬 HTTP 409／200 驗證。\n\n#### Verified\n\n- M6-A 11/11、M6-B 14/14、M6-C 9/9、M6-D 15/15 PASS。\n- `npm test`：**171/171 PASS**。\n- 四套 Microsoft Edge E2E 合併驗收：**52/52 PASS**，0 failed、0 skipped。\n- `git diff --check` 未顯示格式錯誤；GitHub Commit／Push 以實際 SHA 和工作樹核對結果為準。\n\n#### Remaining\n\n- M7 Socket.IO 即時同步、M8 留言通知、M9 搜尋分析、M10 正式部署與安全／相容性驗收。\n- 尚未發布正式 v1.0.0；自動化 PASS 不等於不存在任何程式缺陷。",
  "docs/ARCHITECTURE.md": "## M6｜Kanban 排序與拖放資料流（2026-11-18）\n\n### 一、主要模組與責任\n\n| 層級 | 模組 | 職責 |\n| --- | --- | --- |\n| Browser | `public/task-board.js` | HTML Drag & Drop、目標欄位與位置計算、操作權限、衝突後重新載入 |\n| Styles | `public/task-board.css` | 拖放狀態與插入位置視覺回饋 |\n| Router | `server/task-order-routes.js` | `PATCH .../move`、Session／CSRF／同源與授權驗證 |\n| Repository | `server/task-order-repository.js` | 排序與跨欄移動交易、position 整理、版本及 RBAC 檢查 |\n| DB | SQLite `tasks` | 持久化 `status`、`position`、`version` 與任務資訊 |\n\n### 二、正式任務移動 API\n\n`PATCH /api/projects/:id/tasks/:taskId/move`\n\n- 請求以任務目前的 `version`、目標 `status` 與 `index` 表達一次移動／重排意圖。\n- Owner/Admin 可依後端權限執行拖放排序；Member 不可排序或拖放，但仍保留自己受指派任務的既有授權狀態更新能力。\n- 非成員、匿名、已登出與封存專案依原有政策拒絕寫入；後端不信任前端角色或身分宣告。\n- 過期版本回傳 HTTP 409，不應覆蓋較新任務；前端須重新取得排序和版本資料。\n- 同欄與跨欄位置依 Repository 交易進行持久化；前端不在伺服器成功前假定 SQLite 排序已提交。\n- 原有 `PATCH /api/projects/:id/tasks/:taskId` 仍用於一般任務欄位及 Member 的授權狀態修改，不能一概替換。\n\n### 三、資料一致性與測試邊界\n\n- SQLite 由已存在的 M5 `tasks` 資料表維持持久化；M6 沿用 `position` 和 version 機制，未將正式資料重新初始化。\n- API／Repository 在測試範圍內驗證交易原子性、排序連續性、跨欄移動與版本競爭。\n- `tests/task-order-repository.test.js`、`tests/task-order-api.test.js`、`tests/task-drag-frontend.test.js` 與 `e2e/kanban-drag.e2e.js` 驗證不同層級。\n- Edge E2E 採隔離測試資料庫、獨立 Session 與隨機埠；不需要以正式 SQLite 檔案作為測試資料。\n- M6 是重新取得資料後的一致性處理，**不是**多使用者 WebSocket 即時推播；後者仍屬 M7。\n\n### 四、後續限制\n\n正式 HTTPS、反向代理、多節點部署、其他瀏覽器、長時間穩定性與完整安全稽核均未因 M6 測試通過而自動驗收。",
  "docs/DEVELOPMENT_LOG.md": "## 2026-11-18｜M6 Kanban 拖放與任務排序：開發及回歸紀錄\n\n### 一、M6-A｜Task Order Repository\n\n- 建立 `server/task-order-repository.js`、`tests/task-order-repository.test.js`。\n- 覆蓋同欄排序、跨欄移動、`position` 重整、版本驗證、角色限制、封存專案拒絕與 SQLite Transaction Rollback。\n- M6-A 專項測試：**11/11 PASS**。\n\n### 二、M6-B｜Task Reorder HTTP API\n\n- 建立 `server/task-order-routes.js`、`tests/task-order-api.test.js`，並在 `server/server.js` 整合 `PATCH /api/projects/:id/tasks/:taskId/move`。\n- 沿用原有 Session Cookie、CSRF、同源與 RBAC；驗證權限、非法資料、409 樂觀鎖與跨欄移動。\n- M6-B 專項測試：**14/14 PASS**。\n\n### 三、M6-C｜前端 Drag & Drop\n\n- 修改 `public/task-board.js`、`public/task-board.css`；建立 `tests/task-drag-frontend.test.js`。\n- Owner/Admin 的 active 專案啟用拖放；Member 仍可使用原本獲授權的狀態操作，但無排序權限。\n- 真實滑鼠拖曳使用 dragstart／dragover／drop／dragend；前端按照伺服器交易結果刷新資料，不自行樂觀調整永續順序。\n- M6-C 專項測試：**9/9 PASS**。\n\n### 四、M6-D｜Edge 真實拖曳 E2E 與問題定位\n\n- 新增 `e2e/kanban-drag.e2e.js`，涵蓋四組獨立 Edge Session、Owner 同欄排序及跨欄、Admin 排序、Member 拒絕拖動、封存限制、409 衝突、重整持久化及頁面錯誤。\n- 初期測試出現 15 項中的 7 項失敗，首項等待 `/move` 回應超時。事件追蹤顯示 dragover／drop 已觸發、但 `MOVE REQUESTS: []`，且畫面顯示任務位置沒有變更。\n- 根據 Drag Event Trace 和卡片位置資料修正拖曳行為，重新執行後 M6-D **15/15 PASS**，0 failed。\n- 將 `kanban-drag.e2e.js` 加入整體 E2E 指令。\n\n### 五、跨階段 M5-C2 回歸修復\n\n- 加入 M6 後，`e2e/task-flow.e2e.js` 的兩項 Owner 測試逾時：舊測試監聽 `PATCH /tasks/:taskId`，前端 Owner 狀態操作已改用 `PATCH /tasks/:taskId/move`。\n- 僅調整該兩處 `waitForResponse` 路徑，保留 409 與 200 預期、不更動 Member 的原 API 權限。\n- 單獨 M5-C2 E2E 重新驗證 **14/14 PASS**。\n\n### 六、最終完整回歸與版本管理\n\n- `npm test`：**171/171 PASS**；四套 Microsoft Edge E2E：**52/52 PASS**；均 0 fail、0 skipped。\n- `git diff --check` 未顯示錯誤。工作樹含 M6 新增／修改程式及曾產生的 `taskflow-debug.txt`；後者為除錯暫存，不應提交至 GitHub。\n- 以集中結案制度一次更新六份文件，不覆蓋 M0～M5 既有歷史段落。\n- **提交 SHA 與 Push 狀態不得預填**；以最後本機 `git status -sb`、`git rev-parse HEAD`、`git rev-parse origin/main` 的實際結果為準。\n\n### 七、下一階段\n\n- M7：Socket.IO 即時跨帳號同步、角色／專案授權的廣播範圍、重連後資料對齊及版本競爭測試。\n- M8～M10：通知留言、統計搜尋、部署級安全／效能與正式 Release。\n- M6 的既定自動化驗收通過並不等同於正式產品 v1.0.0 已發布。",
  "docs/PROJECT_PLAN.md": "## M6｜Drag & Drop 最終驗收與 M7 啟動條件（2026-11-18）\n\n### M6 完成範圍\n\n| 子階段 | 交付成果 | 已實測結果 |\n| --- | --- | --- |\n| M6-A | 任務排序 Repository、交易、position、version | 11/11 PASS |\n| M6-B | `PATCH .../move`、Session、CSRF、RBAC、409 | 14/14 PASS |\n| M6-C | 真實三欄拖放、權限、衝突重載 | 9/9 PASS |\n| M6-D | 四個 Edge Session 的真實拖放與資料持久化 E2E | 15/15 PASS |\n| 全套 Node.js | 含 M6 專項在內的既有回歸 | **171/171 PASS** |\n| 全套 Edge | Auth 8 + Members 15 + Tasks 14 + Drag 15 | **52/52 PASS** |\n\n### M6 結案核對表\n\n- [x] Drag & Drop 前端實作及角色限制。\n- [x] 同欄位置與跨欄狀態移動、SQLite 持久化。\n- [x] Session／CSRF／RBAC／封存限制及 Version 衝突處理。\n- [x] M5-C2 監聽路徑同步修復，回歸 14/14。\n- [x] Node.js 171/171、Edge E2E 52/52。\n- [x] `git diff --check` 無格式錯誤（依本機截圖）。\n- [ ] 六份文件落盤後審查 Diff 與歷史紀錄。\n- [ ] 暫存清單無除錯文字檔、正式 SQLite、備份、密鑰與 `.env`。\n- [ ] Git Commit／Push 成功，工作樹乾淨且本機 HEAD 等於 origin/main。\n\n**最後三個核取項目須依實際 Git 執行結果核對，文件產生工具不會自行將其改成已完成。**\n\n### 整體進度與未完成範圍\n\n- M0～M5 已完成 Git 版本結案（M5 commit `93e7741`）。M6 核心開發與既定測試已完成，Git 結案另需確認。\n- TaskFlow v1.0.0 開發完成度粗估 **約 75%**，非精確工程量度，也不代表已有正式 Release。\n- M7：WebSocket／Socket.IO 多使用者即時同步與重新連線恢復。\n- M8：留言、通知、活動紀錄與邀請流程完善。\n- M9：統計、搜尋、篩選與產品體驗。\n- M10：部署、HTTPS、跨瀏覽器、效能、安全驗收與正式 GitHub Release。",
  "docs/TESTING.md": "## 2026-11-18｜M6 完整驗收與 M5 回歸修復\n\n### 一、實測結果\n\n| 測試範圍 | 測試結果 | 證據來源 |\n| --- | --- | --- |\n| M6-A Task Order Repository | 11/11 PASS | 本機 Node.js 測試截圖 |\n| M6-B Task Reorder HTTP API | 14/14 PASS | 本機 Node.js 測試截圖 |\n| M6-C Drag Frontend Smoke | 9/9 PASS | 本機 Node.js 測試截圖 |\n| M6-D Edge 真實拖放 E2E | 15/15 PASS | 本機 Edge E2E 截圖 |\n| M5-C2 修復後獨立 Edge E2E | 14/14 PASS | 本機 Edge E2E 截圖 |\n| 完整 `npm test` | **171/171 PASS** | 本機完整回歸截圖 |\n| 完整四套 Edge E2E | **52/52 PASS** | 本機合併 E2E 截圖 |\n\n- 完整 Node.js 171 和 Edge 52 兩次執行共計 223 個測試計數；表格內專項測試是其子集，**不可全部再加總**。\n- 最終兩套完整回歸均為 0 failed、0 cancelled、0 skipped、0 todo。\n- M6-D 的四個 BrowserContext 驗證不同角色下的排序、權限、狀態切換、版本衝突與重整持久化。\n\n### 二、問題追蹤與修復驗證\n\n1. 真實 Edge 拖曳初期 8/15、7 FAIL：事件追蹤有 dragover/drop，但 `MOVE REQUESTS: []`，操作被判定沒有排序變動。定位並修正後為 15/15 PASS。\n2. M6 導入 `/move` 後，M5-C2 仍監聽舊 `PATCH /tasks/:taskId`；Owner 兩項 `waitForResponse` 30 秒逾時。將兩處監聽路徑改為 `/tasks/:taskId/move`，維持 409/200 驗證，M5-C2 14/14 PASS。\n3. 全部測試再次整合驗證，`npm test` 171/171、Edge 52/52 PASS。\n\n### 三、完整驗收操作\n\n```powershell\nnpm test\nnode --test --test-concurrency=1 e2e/auth-flow.e2e.js e2e/member-flow.e2e.js e2e/task-flow.e2e.js e2e/kanban-drag.e2e.js\n```\n\n對應 `npm run test:e2e:all` 指令包含四套 E2E 檔案；循序執行指令可減少不同 E2E 檔案同時執行造成的資源干擾。\n\n### 四、測試邊界\n\n- E2E 使用獨立 SQLite 記憶體資料庫與隨機埠，不測試正式資料檔。\n- Microsoft Edge PASS 不代表 Chrome、Firefox、Safari 或手機瀏覽器均已驗證。\n- 未包含正式 HTTPS、反向代理、正式部署權限、安全掃描、長期壓力及 WebSocket 即時同步。\n- Git 工作樹與 origin/main 一致性需於實際 Commit／Push 後另行確認。\n\n### 結論\n\nM6-A～M6-D 的**既定功能與自動化測試**通過；最後 Git 結案、正式部署與 v1.0.0 發布仍屬其他獨立驗收項目。"
};
const LATEST = {
  "README.md": "## 最新開發狀態｜M6 核心驗收通過（2026-11-18）\n\n> 本節是最新狀態快照。下方 M0～M5 以及舊的 M5 狀態文字保留歷史時點，若與本節不同，以本節與最新 Git 記錄為準。\n\n- **M0～M5：** 已結案；M5 Git commit `93e7741`。\n- **M6-A～M6-D：** 拖放與排序 Repository、API、前端和 Edge E2E 既定測試均通過。\n- **本次完整驗收：** `npm test` **171/171 PASS**、四套 Edge E2E **52/52 PASS**，0 失敗、0 略過。\n- **歷史相容修正：** M5-C2 的 Owner 狀態選單更新改用 M6 `/move` API，兩個 E2E 監聽條件已更新，14/14 PASS。\n- **提交狀態：** M6 Git 結案須以實際 `HEAD`、`origin/main` 與乾淨工作樹驗證，不預先宣告 Commit／Push 完成。\n- **進度估算：** TaskFlow v1.0.0 約 **75%**；M7～M10 與正式 Release 尚未完成。",
  "docs/ARCHITECTURE.md": "## 最新架構快照｜M6（2026-11-18）\n\n> 以下為目前有效的排序架構；本文件既有 M1～M5 篇章屬各階段歷史記錄。\n\n`public/task-board.js` 的原生 HTML Drag & Drop → `PATCH /api/projects/:id/tasks/:taskId/move` → `server/task-order-routes.js` 的 Session／CSRF／RBAC 驗證 → `server/task-order-repository.js` 的 SQLite 交易與 version 409 檢查 → `tasks` 的 `status`／`position` 持久化。\n\nOwner/Admin 可以使用拖放與排序；Member 只有既有受指派任務的狀態變更權限。衝突時重新載入後端資料。不包含 M7 WebSocket 即時推播。",
  "docs/PROJECT_PLAN.md": "## 最新里程碑狀態｜2026-11-18\n\n- **M0～M5：** 已完成原有 Git 結案，M5 版本為 `93e7741`。\n- **M6：** 既定程式與回歸驗收已通過，Node.js 171/171、Edge 52/52；六份文件與 Git 結案待以實際版本狀態確認。\n- **M7～M10：** Socket.IO、協作／通知、搜尋／統計、正式部署安全與 Release 尚未完成。\n- **整體 TaskFlow v1.0.0：約 75%**，為依規劃範圍的粗略估算；未發布正式版本。\n\n> 下方歷史規劃表與 M5 時點文件保留原始紀錄；目前進度以上方快照及最新 M6 專章為準。",
  "docs/TESTING.md": "## 最新驗收快照｜M6（2026-11-18）\n\n| 範圍 | 已執行結果 |\n| --- | --- |\n| M6-A Repository / M6-B API / M6-C Frontend | 11/11、14/14、9/9 PASS |\n| M6-D Edge Drag E2E | 15/15 PASS |\n| M5-C2 回歸修正 | 14/14 PASS |\n| **完整 `npm test`** | **171/171 PASS** |\n| **四套 Microsoft Edge E2E** | **52/52 PASS** |\n\n以上都是本機測試截圖的結果，均 0 fail；專項數目為完整測試的子集。正式部署、HTTPS、跨瀏覽器、效能與完整資安尚未驗收。"
};

function count(text, needle) {
  return text.split(needle).length - 1;
}
function wrap(name, body, newline) {
  return [`<!-- ${name} -->`, body.trim(), `<!-- /${name} -->`].join(newline);
}
function preserveNewline(text, addition) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return addition.replace(/\r\n|\n/g, eol);
}
function replaceTableRow(text, milestone, value) {
  const re = new RegExp(`^\\|\\s*${milestone}\\s*\\|[^\\r\\n]*$`, "gm");
  const found = [...text.matchAll(re)];
  if (found.length !== 1) throw new Error(`PROJECT_PLAN 的 ${milestone} 表格列數不是 1，停止更新`);
  return text.replace(re, value);
}
function build(file, original) {
  const oldHistory = "<!-- M5-SUMMARY-2026-11-17 -->";
  if (!original.includes(oldHistory)) throw new Error(`${file} 找不到 M5 歷史區段，為避免誤覆蓋已中止`);
  const open = `<!-- ${MARK} -->`;
  const close = `<!-- /${MARK} -->`;
  const co = count(original, open), cc = count(original, close);
  if (co !== cc || co > 1) throw new Error(`${file} 的 M6 區段標記損毀或重複`);
  const curO = `<!-- ${CURRENT} -->`, curC = `<!-- /${CURRENT} -->`;
  if (count(original, curO) !== count(original, curC)) throw new Error(`${file} 的目前狀態標記未成對`);
  if (co === 1) {
    if (LATEST[file] && count(original, curO) !== 1) throw new Error(`${file} M6 區段存在，但目前狀態快照缺失`);
    return original; // idempotent: never overwrite an already authored M6 chapter
  }
  if (count(original, curO) > 0) throw new Error(`${file} 已有 M6 快照但缺 M6 專章，請先人工檢查`);
  let s = original;
  if (file === "README.md") {
    s = s.replace(/^- M5：核心功能與測試已通過，待 Git 結案；M6～M10：尚未開始。$/m,
      "- M5：已於 Commit 93e7741 完成 Git 結案；M6：核心功能與測試通過；M7～M10 尚待開發。");
  }
  if (file === "docs/PROJECT_PLAN.md") {
    s = replaceTableRow(s, "M5", "| M5 | 任務 CRUD 與 Kanban 看板 | 已結案（commit 93e7741） |");
    s = replaceTableRow(s, "M6", "| M6 | Drag & Drop、排序與衝突控制 | 核心驗收完成（Node 171/171、Edge 52/52），Git 依實際提交核對 |");
  }
  if (file === "CHANGELOG.md") {
    const anchor = "## [Unreleased]";
    if (count(s, anchor) !== 1) throw new Error("CHANGELOG 未找到唯一 [Unreleased] 標題");
    s = s.replace(anchor, `${anchor}\n\n${wrap(MARK, SECTIONS[file], "\n")}`.replace(/\n/g, original.includes("\r\n") ? "\r\n" : "\n"));
  } else {
    const newline = s.includes("\r\n") ? "\r\n" : "\n";
    const block = wrap(MARK, SECTIONS[file], newline);
    s += `${s.endsWith(newline) ? newline : newline + newline}${block}${newline}`;
  }
  if (LATEST[file]) {
    const newline = s.includes("\r\n") ? "\r\n" : "\n";
    const top = wrap(CURRENT, LATEST[file], newline);
    const match = s.match(/^#[^\r\n]+\r?\n/);
    if (!match) throw new Error(`${file} 找不到最上方 # 標題`);
    s = match[0] + newline + top + newline + s.slice(match[0].length);
  }
  if (count(s, oldHistory) !== count(original, oldHistory)) throw new Error(`${file} M5 歷史標記數量不符`);
  if (count(s, open) !== 1 || count(s, close) !== 1) throw new Error(`${file} M6 標記未成對`);
  return s;
}
function main() {
  const dry = process.argv.includes("--dry-run");
  const required = [".git", "server/task-order-repository.js", "server/task-order-routes.js", "public/task-board.js", "public/task-board.css", "e2e/kanban-drag.e2e.js", "e2e/task-flow.e2e.js", "tests/task-order-repository.test.js", "tests/task-order-api.test.js", "tests/task-drag-frontend.test.js"];
  for (const name of required) if (!fs.existsSync(path.join(ROOT, name))) throw new Error(`找不到必要的 M6 檔案或 .git：${name}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  if (pkg.name !== "taskflow" || !String(pkg.scripts?.["test:e2e:all"] || "").includes("kanban-drag.e2e.js")) throw new Error("專案或 E2E 指令未符合 M6 結案要求");
  const plans = [];
  for (const name of FILES) {
    const full = path.join(ROOT, name);
    const before = fs.readFileSync(full, "utf8");
    const after = build(name, before);
    plans.push({name, full, before, after});
  }
  const changes = plans.filter(p => p.before !== p.after);
  if (!changes.length) {console.log("M6 六份文件標記均已存在，無重複修改。");return;}
  for (const x of changes) console.log(`${dry ? "[預覽]" : "[更新]"} ${x.name}`);
  if (dry) {console.log("預覽完成：尚未寫入任何內容。請核對後移除 --dry-run 執行。");return;}
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M6-docs-"));
  for (const x of plans) {
    const dest = path.join(backupDir, x.name);
    fs.mkdirSync(path.dirname(dest), {recursive:true});
    fs.copyFileSync(x.full, dest);
  }
  console.log(`六份原始文件已備份：${backupDir}`);
  let written = [];
  try {
    for (const x of changes) {
      fs.writeFileSync(x.full, x.after, "utf8");
      written.push(x);
    }
    for (const x of plans) {
      const now = fs.readFileSync(x.full, "utf8");
      if (now !== x.after) throw new Error(`${x.name} 寫入後內容不一致`);
    }
  } catch(err) {
    for (const x of written) fs.writeFileSync(x.full, x.before, "utf8");
    throw new Error(`寫入失敗，已還原已寫入的文件：${err.message}`);
  }
  console.log("M6 六份文件更新成功；尚未 Git Commit／Push。");
  console.log("接下來檢查 git diff --check、git diff --stat、git status --short，再進行指定檔案暫存與安全稽核。");
}
try { main(); } catch(error) { console.error(`M6 文件更新已中止：${error.message}`); process.exitCode=1; }
