"use strict";
// TaskFlow M8-D — six-document incremental update. Does NOT run git/db commands.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const START = "<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->";
const END = "<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->";
const sections = {
  "README.md": "## 最新開發狀態｜M8 留言、活動時間軸與即時同步（2026-11-21）\n\n> 此節為目前最新進度快照。後文 M0～M7 的「未完成」或進度百分比敘述屬**當時**的歷史紀錄；不可直接當成現在的狀態。**TaskFlow v1.0.0 尚未正式發布**。\n\n- **M0～M7：** 先前已完成 GitHub 結案；M7 包含 Socket.IO 授權 Room、成功寫入後的事件通知、重新連線補抓與多人 Edge 驗收。\n- **M8-A：** SQLite 增量 Schema 與 Repository，包含 `task_comments`、`project_activity`、同專案外鍵／觸發器、留言版本管理及軟刪除。\n- **M8-B：** 留言 CRUD 與活動查詢 REST API，沿用 Session、CSRF、RBAC、封存限制及 409 版本衝突規則。\n- **M8-C1：** 任務留言介面；**M8-C2：** 專案活動時間軸與分頁；**M8-C3：** 經授權 Socket Room 的留言異動提示、前端 REST 重新抓取、斷線重連補抓。\n- **最新本機驗收（M8-C3）：** `npm test -- --test-concurrency=1` **264/264 PASS**；M8-C3 Edge 專項 **7/7 PASS**；既有 `npm run test:e2e:all` **52/52 PASS**，截圖所示均 `fail 0`。M8-C2 歷史驗收為 **260/260** 與 Edge **6/6**。此處的專項測試包含在對應全套計數內，**不能重複加總**。\n- **安全界線：** Socket 推播僅含資源變更識別資訊、不包含留言正文；權限以 REST 與 Socket Room 的 Session／成員資格再次核驗。測試使用獨立記憶體 SQLite，正式 `data/taskflow.db` 不列為測試目標。\n- **活動範圍限制：** 目前 `project_activity` 記錄的事件為 `comment_created`、`comment_updated`、`comment_deleted`；**尚未涵蓋所有任務／成員動作的通用事件流**。\n- **結案狀態：** M8 功能及既定測試已通過；**本節不預先宣告 Git Commit／Push 已成功**，請以實際 `HEAD`／`origin/main` 與乾淨工作樹作最終依據。正式 GitHub Release 尚未發布。\n- **後續：** M9 搜尋／統計／篩選與產品體驗，M10 部署、HTTPS、跨瀏覽器、效能、完整安全驗收與正式 Release；較完整的邀請／核准流程若仍在原需求內，須另列後續工作。\n\n### M8 主要檔案與驗收指令\n\n- 資料層：`server/collaboration-schema.sql`、`server/collaboration-repository.js`。\n- API／即時層：`server/collaboration-routes.js`、`server/realtime-notifier.js`、`server/realtime-hub.js`。\n- 前端：`public/task-comments.js`、`public/task-comments.css`、`public/task-activity.js`、`public/task-activity.css`、`public/task-realtime.js`。\n- 專項驗收：`node --test tests/collaboration-repository.test.js`、`node --test tests/collaboration-api.test.js`、`node --test tests/collaboration-realtime.test.js`、`node --test e2e/task-activity.e2e.js`、`node --test e2e/collaboration-realtime.e2e.js`。\n\n---\n",
  "CHANGELOG.md": "### M8 — 2026-11-21｜Collaboration Comments, Activity Timeline & Realtime\n\n#### Added\n\n- **M8-A**：增量 `task_comments`、`project_activity` SQLite Schema 與 Repository，支援留言版本、軟刪除、分頁、專案隔離與操作事件 metadata。\n- **M8-B**：任務留言 GET／POST／PATCH／DELETE 與專案活動清單 GET；保留 Session、CSRF、RBAC、409 與封存專案限制。\n- **M8-C1**：任務留言面板、文字安全呈現、角色限制、讀寫與錯誤回饋。\n- **M8-C2**：專案活動時間軸、分頁、刷新及切換專案時的內容隔離。\n- **M8-C3**：Socket.IO `comment` 資源異動通知，已開啟留言／活動介面以授權 REST 補抓，斷線重連重新訂閱後同步。\n- **M8-D**：累積更新六份文件並進行 Git 版本結案準備，保存 M0～M7 歷史記錄。\n\n#### Security / Consistency\n\n- 留言資料及 Activity 所屬專案受 Repository、Session／RBAC 與 SQLite 條件約束；不接受跨專案存取。\n- 成功 REST 寫入後才發送通知；非 2xx／409 不當成更新成功，Socket 訊息不包含留言正文。\n- Activity 目前僅記錄 `comment_created`、`comment_updated`、`comment_deleted`；非通用審計日誌。\n- Edge E2E 使用隔離的測試資料庫與 Session，不以正式 `data/taskflow.db` 作為測試資料。\n\n#### Verified（來自本機終端機截圖）\n\n- M8-A Repository **14/14 PASS**；M8-B REST API **21/21 PASS**。\n- M8-C2 時點 `npm test` **260/260 PASS**；專項活動時間軸 Edge **6/6 PASS**。\n- M8-C3 協議測試 **4/4 PASS**；M8-C3 時點完整 Node.js **264/264 PASS**；M8-C3 Edge **7/7 PASS**；既有 Edge 回歸 **52/52 PASS**，均 `fail 0`。\n- 上述專項可能已包含在完整套件中，不可將各列直接相加作為獨立測試總數。\n\n#### Remaining\n\n- M8 Git Commit／Push／同步結果須以實際 `HEAD`、`origin/main`、工作樹狀態核對；本紀錄不預填 Git 成功結果。尚未正式 GitHub Release。\n- M9 搜尋統計與 UX、M10 正式部署／跨瀏覽器／壓測與完整資安審核；邀請核准等未交付功能須另追蹤。\n\n---\n",
  "docs/ARCHITECTURE.md": "## 最新架構快照｜M8 留言／Activity／Socket.IO（2026-11-21）\n\n> 以下描述 M8 **目前已交付且完成既定測試**的路徑。後文 M6／M7 及更早架構敘述為當時的階段紀錄；M9／M10 的產品化能力尚未完成。\n\n### 資料與 HTTP 流程\n\n1. `public/task-comments.js` 經由授權 REST API 讀取／建立／修改／軟刪除任務留言；`public/task-activity.js` 讀取專案活動時間軸（含分頁）。\n2. `server/collaboration-routes.js` 處理 `/api/projects/:projectId/tasks/:taskId/comments` 及 `/api/projects/:projectId/activity` 路徑，沿用既有登入 Session、同源／CSRF 與角色授權流程。\n3. `server/collaboration-repository.js` 使用 SQLite `task_comments` 與 `project_activity`，在同專案約束、版本驗證及交易語義下寫入留言；留言變更產生**不含正文**的活動 metadata。\n4. 留言修改與刪除採 version 樂觀鎖；過期版本回覆 409，不把失敗寫入偽裝成成功事件。\n\n### Socket.IO 事件流程（M8-C3）\n\n```text\n留言 REST 寫入成功 → res.locals 成功異動 metadata → HTTP finish 通知器\n  → 已授權 project:<id> Socket Room → comment 變更提示（不含留言正文）\n  → 已開啟的留言／Activity 介面經 REST 重新取得最新資料\n```\n\n- Room 由既有 `server/realtime-hub.js` 維持 Session、Origin、專案成員核驗；新 `comment` 類型不得越權或跨專案推送。\n- Socket 事件只是失效提示（invalidation signal），**不直接作為頁面正文或資料庫更新來源**；斷線重連後重新訂閱並使用 REST 補抓。\n- M7 既有 `task`、`member`、`project` 變更協議仍在；留言事件不應觸發不必要的整張 Kanban 重刷。\n- 目前沒有耐久事件佇列／跨程序 adapter；不得宣告具備多節點可靠交付或完整審計能力。\n\n### SQLite 結構與資料安全\n\n- `task_comments`：`project_id`、`task_id`、`author_id`、`body`、`version`、`is_deleted`、建立／更新時間；使用觸發器防止將留言掛到其他專案的 Task。\n- `project_activity`：`project_id`、`actor_id`、`task_id`、`comment_id`、`action`、建立時間；`action` 目前限 `comment_created`、`comment_updated`、`comment_deleted`。\n- Schema 初始化採 `CREATE TABLE IF NOT EXISTS` 等增量方式；M8 開發曾先備份正式 SQLite，測試使用獨立 `:memory:` 資料庫。\n- 當前驗收不涵蓋正式 HTTPS、跨網域部署、壓力／長期連線可靠性、其他瀏覽器或全面資安審核。\n\n---\n",
  "docs/DEVELOPMENT_LOG.md": "## 2026-11-21｜M8 留言與活動協作開發結案前紀錄\n\n### M8-A｜Schema / Repository\n\n- 建立 `task_comments`、`project_activity`、專案一致性觸發器、關聯索引；留言支援版本檢查及軟刪除，活動僅保存事件 metadata。\n- 初次 Repository 驗證曾有個別測試失敗，修正後專項 **14/14 PASS**，並保留既有正式 SQLite；操作正式 Schema 前已完成備份與完整性核對。\n\n### M8-B｜REST API\n\n- 建立留言清單、單筆讀取、建立、修改、軟刪除及專案活動 GET API；沿用 Session、CSRF、RBAC 與 400／401／403／404／409 等預期錯誤語義。\n- M8-B 專項 **21/21 PASS**，測試涵蓋外專案拒絕、作者／Admin／Owner 的權限、過期版本與封存限制。\n- 開發階段完整測試曾出現一次與舊 `member-frontend.test.js` 有關的失敗；以順序執行重驗後 **241/241 PASS**。不得將歷史失敗刪除或誤寫為當次全程無錯。\n\n### M8-C1｜任務留言前端\n\n- 新增 `public/task-comments.js` 與 `.css`，局部接線至既有 Task Board；保留原本 M7/M6 的看板與 Session 行為。\n- 已依當時提供的本機結果完成專項與整體驗收；沒有完整截圖證據的細項數量不在此處臆填。\n\n### M8-C2｜專案活動時間軸\n\n- 新增 `public/task-activity.js`、`.css`，支援活動清單、分頁、刷新及切換專案隔離。這是**留言變更活動**，不是所有 Task／Member 操作的完整稽核歷史。\n- 單元與整合套件 **260/260 PASS**，M8-C2 Edge 專項 **6/6 PASS**。\n\n### M8-C3｜留言 + Activity Socket.IO 即時同步\n\n- 增量整合 `server/realtime-notifier.js`、`server/realtime-hub.js`、`server/collaboration-routes.js`、`public/task-realtime.js`、`public/task-comments.js`、`public/task-activity.js`。\n- 成功留言變更才發布 `comment` metadata，限制 Socket Room 專案權限；已開啟介面透過 REST 補抓，保護草稿、重新連線後補同步。\n- M8-C3 協議測試 **4/4 PASS**；完整 `npm test -- --test-concurrency=1` **264/264 PASS**；M8-C3 Edge 專項 **7/7 PASS**；既有 Edge 回歸 **52/52 PASS**。\n\n### M8-D｜文件、Git 與發布界線\n\n- 已完成六份累積文件的新增摘要設計：保留早期 M0～M7 歷史，不覆寫既有版本紀錄。\n- Git 安全預檢：本機 `git ls-files -- data/ .env` 無輸出；對未追蹤檔案的 `.db`／`.env`／`.txt`／`.zip`／backup／debug 篩選無輸出。此檢查是範圍性檢查，仍須核對完整暫存清單與 `.gitignore`。\n- 不在產生文件時擅自執行 Git、修改正式 SQLite 或宣告已發布 `v1.0.0`。\n- **Git 結案程序：** 依序執行本機 dry-run、正式文件更新、`git diff`／暫存安全檢查、M8 Commit／Push 與 `HEAD == origin/main` 驗證。此紀錄不臆填未執行的 Git 結果。\n- **後續：** M9 搜尋／統計與體驗、M10 正式部署／安全／效能／跨瀏覽器驗收；未完成的邀請／核准需求另列待辦。\n\n",
  "docs/PROJECT_PLAN.md": "## 最新里程碑狀態｜M8（2026-11-21）\n\n> 本節是最新狀態。後方 M6／M7 規劃表與「尚未開始」敘述保留為**歷史快照**，不可直接用來判定目前完成度。正式 `v1.0.0` **尚未發布**。\n\n| 里程碑 | 本次確認狀態 | 證據或限制 |\n| --- | --- | --- |\n| M0～M7 | 歷史階段已結案 | M7 Socket.IO、Session／Room 權限、斷線補抓與 Edge E2E |\n| M8-A Schema / Repository | 既定測試完成 | 14/14 PASS；增量 SQLite、留言版本、活動 metadata |\n| M8-B Collaboration REST | 既定測試完成 | 21/21 PASS；授權／CSRF／RBAC／409 |\n| M8-C1 任務留言介面 | 既定驗收完成 | 留言 CRUD 前端及 Edge 驗收 |\n| M8-C2 專案活動時間軸 | 既定驗收完成 | 260/260 Node 當時回歸；Edge 6/6 |\n| M8-C3 即時留言／Activity | 既定驗收完成 | 264/264 Node；Edge 專項 7/7；既有 Edge 52/52 |\n| **M8-D 文件與 Git 結案** | **文件更新工具已提供；Git 結案以實際紀錄為準** | Commit／Push、HEAD＝origin/main 及乾淨工作樹必須個別檢查 |\n| M9 搜尋統計與 UX | 未完成 | 後續規劃 |\n| M10 部署與 Release | 未完成 | HTTPS、安全、跨瀏覽器、效能及正式 GitHub Release |\n\n### M8-D 結案查核表\n\n- [x] M8-A～C3 既定功能、相關專項與回歸測試已按終端截圖核對。\n- [x] 確認原始 `data/`、`.env` 未被既有 Git 追蹤；未追蹤危險副檔名篩選無輸出（範圍性檢查）。\n- [ ] 完成六份文件新增段落，核對 markdown、保留舊紀錄。\n- [ ] 執行 `git diff --check`、`git status --short` 和完整 staged 檔名檢查。\n- [ ] 確認不含正式 SQLite、`.env`、備份／除錯檔、測試密鑰。\n- [ ] M8 集中 Commit／Push；以 `git status -sb`、`git rev-parse HEAD` 和 `git rev-parse origin/main` 核對同步。\n\n**完成度僅能依里程碑定性估算，不是程式覆蓋率或正式產品驗收率。** 留言 Activity 目前限定三種留言事件；原規劃如包含完整邀請核准或所有專案活動審計，這些需求尚不能標記為完成。\n\n---\n",
  "docs/TESTING.md": "## 最新驗收快照｜M8-A～M8-C3（2026-11-21）\n\n> 以下數字取自本機終端截圖，反映相對應階段實際執行的結果。M8-D 的 Git 文件／同步結果仍須由 Git 紀錄另行確認；正式 Release 尚未驗收。下方 M6、M7 的舊數字均為歷史當次記錄。\n\n| 測試範圍 | 已觀察結果 | 說明 |\n| --- | --- | --- |\n| M8-A `collaboration-repository.test.js` | **14/14 PASS** | SQLite、版本、授權、Trigger 與活動 metadata |\n| M8-B `collaboration-api.test.js` | **21/21 PASS** | CRUD、RBAC、Session、CSRF、衝突與封存 |\n| M8-C1 留言前端 | **既定測試通過** | 專項細項數量未由完整終端截圖核實，不臆填 |\n| M8-C2 活動模組 | **10/10 PASS** | 模組測試包含在後續 Node 全套數量內 |\n| M8-C2 `npm test` | **260/260 PASS** | 當時完整單元／整合回歸 |\n| M8-C2 `task-activity.e2e.js` | **6/6 PASS** | Edge 活動時間軸與分頁 |\n| M8-C3 `collaboration-realtime.test.js` | **4/4 PASS** | metadata 通知協議、不傳正文、Room 範圍 |\n| M8-C3 `npm test -- --test-concurrency=1` | **264/264 PASS** | 最新完整單元／整合測試，0 fail、0 skipped |\n| M8-C3 `collaboration-realtime.e2e.js` | **7/7 PASS** | Edge 雙人留言同步、活動刷新及重新連線 |\n| M8-C3 `npm run test:e2e:all` | **52/52 PASS** | 原有 Edge E2E 回歸，0 fail、0 skipped |\n\n**注意：** 單項測試通常是完整測試套件的子集，表格中的 pass 數不可直接累加。`test:e2e:all` 在此次記錄中是**既有** E2E 四組回歸，不得說成已包含新 M8 專項；M8 Edge 已獨立執行。\n\n### M8-D 再次核對指令\n\n```powershell\nnode --test .\\tests\\collaboration-repository.test.js\nnode --test .\\tests\\collaboration-api.test.js\nnode --test .\\tests\\collaboration-realtime.test.js\nnpm test -- --test-concurrency=1\nnode --test .\\e2e\\task-activity.e2e.js\nnode --test .\\e2e\\collaboration-realtime.e2e.js\nnpm run test:e2e:all\ngit diff --check\n```\n\n- 如程式碼已經完成測試且僅更動文件，無需反覆重跑整套 Edge；但最後若有任一 `.js`／`.sql` 變更，應重新檢驗受影響的測試與必要回歸。\n- M8-D 文件生成器不得接觸 `data/taskflow.db`；測試用 SQLite 隔離，Git 暫存前仍應審查未追蹤檔案內容與敏感資訊。\n- 本機截圖的通過紀錄**不是**正式 HTTPS、壓力測試、完整安全稽核、跨瀏覽器或 GitHub Release 的通過證明。\n\n---\n"
};
const targetRoot = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const validArgs = new Set(["--dry-run"]);
if (process.argv.slice(2).some(a => !validArgs.has(a))) {
  console.error("用法：node scripts/close-m8-docs.js [--dry-run]");
  process.exit(2);
}
function detectNewline(s) { return s.includes("\r\n") ? "\r\n" : "\n"; }
function convertNewlines(s,eol) { return s.replace(/\r\n|\r|\n/g, eol); }
function splitHeader(text, rel) {
  if (rel === "CHANGELOG.md") {
    const re = /^## \[Unreleased\]\s*$/m;
    const match = re.exec(text);
    if (!match) throw new Error(`${rel}：找不到 ## [Unreleased] 標題`);
    let p = match.index + match[0].length;
    return [text.slice(0,p), text.slice(p)];
  }
  // Use the first H1 and add a current status immediately after it.
  const re = /^# TaskFlow[^\r\n]*$/m;
  const match = re.exec(text);
  if (!match || match.index !== 0) throw new Error(`${rel}：無法核對 TaskFlow 文件的第一行標題`);
  const p = match[0].length;
  return [text.slice(0,p), text.slice(p)];
}
function planDoc(rel,source) {
  const bom = source.charCodeAt(0) === 0xFEFF ? "\ufeff" : "";
  const text = bom ? source.slice(1) : source;
  const hasStart = text.includes(START), hasEnd = text.includes(END);
  if (hasStart !== hasEnd) throw new Error(`${rel}：只找到一側 M8 標記，請先人工檢查`);
  if (hasStart) {
    if (text.indexOf(START) !== text.lastIndexOf(START) || text.indexOf(END) !== text.lastIndexOf(END) || text.indexOf(END) < text.indexOf(START)) {
      throw new Error(`${rel}：M8 標記重複或順序錯誤，請人工檢查`);
    }
    return {changed:false, result: source};
  }
  if (!text.includes("TASKFLOW-M7-CLOSEOUT-2026-11-19")) {
    throw new Error(`${rel}：找不到 M7 結案標記；檔案版本可能不同，已停止避免誤寫`);
  }
  const eol = detectNewline(text);
  const block = convertNewlines(START+"\n\n"+sections[rel].trimEnd()+"\n\n"+END,eol);
  let result;
  if (rel === "docs/DEVELOPMENT_LOG.md") {
    result = text.replace(/[\s\uFEFF]*$/, "") + eol+eol+block+eol;
  } else {
    const [before,after] = splitHeader(text,rel);
    result = before + eol+eol + block+eol+eol + after.replace(/^(?:\r?\n)+/, "");
  }
  return {changed:true,result:bom+result};
}
function main() {
  const files=Object.keys(sections);
  const plans=[];
  for(const rel of files){
    const full=path.join(targetRoot,...rel.split("/"));
    if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error(`不存在：${rel}`);
    const data=fs.readFileSync(full,"utf8");
    const plan=planDoc(rel,data);
    plans.push({rel,full,before:data,...plan});
  }
  const todo=plans.filter(p=>p.changed);
  for(const p of plans) console.log(`[${p.changed?(dryRun?"預覽":"準備"):"已更新，跳過"}] ${p.rel}`);
  if(dryRun){ console.log(`Dry run 完成：${todo.length} 份待更新，未寫入任何檔案。`);return; }
  if(!todo.length){console.log("六份文件均已更新；無需重寫。未執行 Git Commit／Push。");return;}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"TaskFlow-M8-docs-"));
  for(const p of todo){
    const b=path.join(dir,...p.rel.split("/"));
    fs.mkdirSync(path.dirname(b),{recursive:true});
    fs.copyFileSync(p.full,b);
  }
  let touched=[];
  try {
    for(const p of todo){
      const temp=p.full+`.m8tmp-${process.pid}`;
      try{
        fs.writeFileSync(temp,p.result,{encoding:"utf8",flag:"wx"});
        fs.renameSync(temp,p.full);
      } finally { if(fs.existsSync(temp))fs.unlinkSync(temp); }
      touched.push(p);
      console.log(`[更新] ${p.rel}`);
    }
  }catch(e){
    console.error("寫入異常，嘗試回復已更新檔案：",e.message);
    for(const p of touched.reverse()){
      try{fs.copyFileSync(path.join(dir,...p.rel.split("/")),p.full);}catch(err){console.error(`無法自動回復 ${p.rel}：${err.message}`);}
    }
    throw e;
  }
  console.log(`六份原始文件備份位置：${dir}`);
  console.log("M8-D 文件更新完成；尚未 Git Commit／Push。請檢查 git diff --check、git diff、git status --short。");
}
try{ main(); }catch(error){console.error("M8-D 中止：",error.message);process.exitCode=1;}
