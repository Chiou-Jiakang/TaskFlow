"use strict";
/**
 * TaskFlow M9-B4 documentation closeout (non-destructive, idempotent).
 * Usage: node scripts/close-m9b-docs.js [--dry-run | --verify]
 * Restricted to six existing Markdown files. Does not call Git, DB, network, or npm.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MARKER = "TASKFLOW-M9B-DOCS-2026-11-23";
const START = `<!-- ${MARKER} -->`;
const END = `<!-- /${MARKER} -->`;
const PREVIOUS = "TASKFLOW-M9A-DOCS-2026-11-21";
const DOCS = [
  "README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md",
];

const SECTIONS = {
  "README.md": String.raw`## 最新開發狀態｜M9-B 任務搜尋與多條件篩選（文件整理：2026-11-23）

> 本節為目前最新狀態快照，下方 M0～M9-A 章節保留原始開發紀錄。TaskFlow **v1.0.0 尚未發布**。M9-B 功能與本機驗收已完成，Git 結案以實際 Commit、Push 與遠端 Hash 驗證為準。

- **M9-A 已完成 GitHub 結案：** @@BT@@b316c1e@@BT@@（2026-11-21；本機 HEAD 與 GitHub @@BT@@main@@BT@@ SHA 已比對一致）。
- **M9-B：** 任務標題與描述關鍵字搜尋；狀態、優先度、負責人、未指派條件；多條件交集篩選、清除條件、結果數量、空結果提示。
- **資料路徑：** 延用現有 Session 授權的 Project / Member / Task REST 回應；@@BT@@public/task-filters.js@@BT@@ 為唯讀純函式、@@BT@@public/task-board.js@@BT@@ 依篩選顯示卡片。原始 @@BT@@state.tasks@@BT@@ 不被修改，M9-A Dashboard 使用全部任務計算。
- **排序安全：** 篩選期間禁止拖放、移動與任務狀態變更，避免可見清單與全量資料的排序索引不一致；清除篩選後恢復原本操作。
- **同步／表單修復：** 移除 @@BT@@setProjects()@@BT@@ 後錯誤殘留的重複程式碼；同一專案背景更新不再重設正在填寫的任務表單，保留 M7 Socket.IO 同步與既有 REST 授權。
- **測試（本機終端機截圖）：** @@BT@@npm test@@BT@@ 306/306 PASS；包含所有 @@BT@@*.e2e.js@@BT@@ 的完整 Edge E2E 98/98 PASS；M9-B 專項 Node 14/14、Edge 6/6 PASS（已包含於完整回歸，不應加總）。M7-D 修復後單獨 E2E 連續兩次 10/10 PASS。另已回報實際網頁操作正常。
- **工程限制：** 本階段未增加後端搜尋 API、SQLite migration 或資料庫搜尋索引；適用於已載入目前專案任務的前端篩選。M9-C UX／整合及 M10 部署、安全與 GitHub Release 仍待完成。

### 常用驗證

@@BT@@@@BT@@@@BT@@powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
@@BT@@@@BT@@@@BT@@

---`,
  "CHANGELOG.md": String.raw`### M9-B — 文件整理：2026-11-23｜Task Search & Multi-filter

#### Added

- 新增 @@BT@@public/task-filters.js@@BT@@：任務標題、描述關鍵字、狀態、優先度、負責人及未指派的多條件篩選；不修改來源陣列。
- 新增 @@BT@@public/task-filters.css@@BT@@，並在 @@BT@@public/index.html@@BT@@ 與 @@BT@@public/task-board.js@@BT@@ 整合搜尋工具列、結果數量、空結果與清除篩選。
- 新增 @@BT@@scripts/apply-m9b2.js@@BT@@、安全整合腳本測試 @@BT@@tests/apply-m9b2.test.js@@BT@@、篩選測試 @@BT@@tests/task-filters.test.js@@BT@@ 與 Edge E2E @@BT@@e2e/task-filters.e2e.js@@BT@@。

#### Fixed

- 修復 @@BT@@task-board.js@@BT@@ 中 @@BT@@setProjects()@@BT@@ 函式後殘留重複程式碼的語法問題。
- 修復同一專案背景更新意外重設任務表單，導致 M7-D 建立任務及後續即時同步測試連鎖失敗的問題。
- 當有篩選條件時，禁止拖曳／排序／狀態變更以保護位置索引；統計仍依完整任務清單計算。

#### Verified（本機執行紀錄）

- Node 完整回歸 306/306 PASS；所有 Edge E2E 98/98 PASS；無失敗、跳過或取消。
- M9-B 專項 Node 14/14 PASS、Edge 6/6 PASS；專項包含於完整套件內，不重複加總。
- M7-D 修正後 E2E 單獨連續兩次 10/10 PASS；使用者回報瀏覽器操作正常。
- M9-A 先前已於 Commit @@BT@@b316c1e@@BT@@ Push 並核對遠端 SHA。

#### Scope

- 搜尋／篩選為當前已授權專案的前端唯讀運算，不新增後端搜尋 API 或 SQLite Schema。
- M9-C、M10 及 v1.0.0 GitHub Release 尚未完成；本段不預先宣告 M9-B Git Push 結果。

---`,
  "docs/ARCHITECTURE.md": String.raw`## 最新架構快照｜M9-B Search & Multi-filter（2026-11-23）

> 本節覆蓋 M9-B 現行前端架構；下方各階段內容屬歷史快照。

@@BT@@@@BT@@@@BT@@text
登入 Session → 現有 REST（projects / members / tasks）
  → public/task-board.js 的完整 state.tasks（授權的當前專案資料）
     ├─→ public/task-analytics.js → 全量 Dashboard KPI
     └─→ public/task-filters.js(filterTasks) → 顯示用任務子集 → Kanban DOM
@@BT@@@@BT@@@@BT@@

- @@BT@@public/task-filters.js@@BT@@ 為純函式：關鍵字、狀態、優先度、負責人交集篩選，保持來源陣列不變；不讀 Cookie、不發 API、不寫 SQLite。
- @@BT@@public/task-board.js@@BT@@ 在 render 階段套用篩選；三欄 Kanban 顯示匹配項目、計數與空結果。原本 @@BT@@state.tasks@@BT@@ 和 Dashboard 計數均維持完整清單。
- @@BT@@public/index.html@@BT@@ 掛接工具列，@@BT@@public/task-filters.css@@BT@@ 套用深色介面；@@BT@@scripts/apply-m9b2.js@@BT@@ 僅供開發整合，非正式啟動流程。
- 篩選期間禁用拖放、原子排序與卡片狀態變更，防止 DOM 可見順序與 SQLite 全量 position 不一致。清除篩選後恢復管理操作；後端 Move API 保持不變。
- 同專案背景同步需保留進行中的表單內容；真正跨專案切換或撤銷權限時清除舊專案畫面與輸入。最新資料仍由授權 REST 取得，Socket 僅通知更新。
- 權限限制由原有後端 Session／CSRF／RBAC 執行，不因前端篩選而增加任何讀取權限。

### 尚未實作／發布條件

- 目前無伺服器端搜尋 API、跨專案全域搜尋、分頁或大型資料集索引；不要把前端篩選寫成後端權限篩選。
- M9-C 完整 UX、效能與多人操作整合；M10 HTTPS、部署安全、備份與 Release 仍待執行。

---`,
  "docs/DEVELOPMENT_LOG.md": String.raw`## M9-B｜搜尋與多條件篩選開發紀錄（整理日：2026-11-23）

### 工作批次

1. **M9-B1**：加入 @@BT@@public/task-filters.js@@BT@@ 與 @@BT@@tests/task-filters.test.js@@BT@@，純函式 10/10 PASS。
2. **M9-B2**：以 @@BT@@scripts/apply-m9b2.js@@BT@@ 增量整合 @@BT@@index.html@@BT@@、@@BT@@task-board.js@@BT@@、@@BT@@task-filters.css@@BT@@，首次 dry-run 不寫入、正式套用前備份、再次 dry-run 不重複改寫。14/14 Node 專項、6/6 Edge 專項通過。
3. **M9-B3**：全套 Edge 起初 98 tests / 93 pass / 5 fail；定位為 M7-D Owner 建立任務未發出預期 POST，後續狀態變更、版本與排序錯誤屬連鎖失敗。
4. 修正 @@BT@@task-board.js@@BT@@：移除誤貼後殘留的 @@BT@@setProjects()@@BT@@ 重複程式碼，修正背景同專案刷新不應清空正在編輯的表單；未修改正式 SQLite 或後端授權路由。
5. 修正後 M7-D 單獨連續兩次 10/10 PASS，隨後完整 @@BT@@npm test@@BT@@ 306/306 PASS、全部 Edge E2E 98/98 PASS；使用者另確認本機網頁實際操作正常。

### 技術決策與安全邊界

- 篩選不覆寫 @@BT@@state.tasks@@BT@@；Dashboard 使用完整任務清單，篩選僅影響顯示。
- 篩選條件啟用時停用拖放／排序／狀態變更，避免索引與資料庫位置不一致。
- 保留專案切換資料隔離、角色權限、M7 即時同步、M8 留言與 Activity；維持增量更新文件，不直接改動歷史紀錄。
- M9-A Git 結案已透過 @@BT@@b316c1e@@BT@@ 與遠端 main SHA 一致性核對。
- M9-B 程式碼與文件在功能驗收完成後集中 Git Commit／Push；最終 Git 事實以終端實際輸出為準。

### 下一階段

- M9-C：搜尋、看板、統計、即時協作之 UX／整合與例外操作。
- M10：正式部署、安全、效能、備份及 v1.0.0 Release。

---`,
  "docs/PROJECT_PLAN.md": String.raw`## 最新里程碑狀態｜M9-B（2026-11-23）

> 本節為最新狀態；歷史 M9-A、M8、M7 等快照原文保留。v1.0.0 尚未發布，進度不是程式碼覆蓋率。M9-A 已於 @@BT@@b316c1e@@BT@@ 完成 GitHub Push 與 SHA 比對。

| 階段 | 狀態 | 驗證與剩餘工作 |
| --- | --- | --- |
| M0～M9-A | 已按各階段標準完成 | M9-A Commit @@BT@@b316c1e@@BT@@ 與遠端一致 |
| M9-B1｜篩選純函式 | 完成 | 10/10 Node |
| M9-B2｜介面整合 | 完成 | 14/14 Node 專項，6/6 Edge 專項，整合冪等性通過 |
| M9-B3｜回歸／手動驗收 | 完成 | 完整 Node 306/306、全部 Edge 98/98，手動功能正常 |
| M9-B4｜文件／Git 結案 | 文件整理中 | 六份文檔 verify、精確 staged、Commit、Push、HEAD 與遠端 SHA 比對 |
| M9-C｜UX 與整合優化 | 尚未開始 | 整合操作、同步、空狀態、錯誤處理及易用性 |
| M10｜安全部署與 Release | 尚未開始 | HTTPS、安全檢查、跨瀏覽器、效能、備份及正式版本 |

### M9-B4 結案判準

- [x] M9-B1 / B2 / B3 的功能與既定回歸、手動驗收完成。
- [ ] 六份文件更新，@@BT@@--verify@@BT@@ 與重複 @@BT@@--dry-run@@BT@@ 不產生變更。
- [ ] 精確挑選 M9-B 新增／修改檔案，不納入三份 M8 TXT、憑證或正式 SQLite。
- [ ] @@BT@@git diff --cached --check@@BT@@ 通過；確認 staged diff 無意外更動。
- [ ] 完成 Git Commit／Push，並比較 @@BT@@git rev-parse HEAD@@BT@@ 和 @@BT@@git ls-remote origin refs/heads/main@@BT@@。

> 此處查核表記錄文件產生時的結案前狀態；真正的 Git 結案事實以 GitHub 分支與本機終端輸出為準，不能由文件腳本預先標記通過。

---`,
  "docs/TESTING.md": String.raw`## 最新測試快照｜M9-B（驗收紀錄至 2026-11-22，文件整理 2026-11-23）

> 來源：使用者提供的本機 PowerShell 與瀏覽器操作結果；本段記錄 M9-B 功能驗收，不等同 M10 正式部署、安全或壓測完成。

| 測試範圍 | 結果 | 失敗／跳過 |
| --- | --- | --- |
| M9-B1 篩選純函式 | 10/10 PASS | 0 / 0 |
| M9-B2 篩選與整合 Node 專項 | 14/14 PASS | 0 / 0 |
| M9-B2 Edge E2E 專項 | 6/6 PASS | 0 / 0 |
| M7-D 修復後單獨 Edge E2E（第 1 次、第 2 次） | 各 10/10 PASS | 各 0 / 0 |
| @@BT@@npm test@@BT@@ 完整 Node 回歸 | 306/306 PASS | 0 / 0 |
| 全部 @@BT@@e2e/*.e2e.js@@BT@@（單檔依序執行） | 98/98 PASS | 0 / 0 |
| 本機網站人工操作 | 使用者確認正常 | 非自動化測試 |

- M9-B1、M9-B2 Node 專項已包含於完整 306 項 Node 測試；Edge 專項亦包含在 98 項完整 Edge E2E 中。完整兩套合計 404 項測試，非 404 項獨立產品功能，也非程式碼覆蓋率 100%。
- 完整 Edge 第一次執行為 98／93 pass／5 fail（含 M7-D 父測試）；修正 @@BT@@task-board.js@@BT@@ 的語法殘留與背景表單重設問題後，單獨 M7-D 兩次全部通過，隨後完整 Edge 98/98 PASS。
- M9-B2 @@BT@@apply@@BT@@ 與重跑 @@BT@@--dry-run@@BT@@ 顯示無重複寫入；正式 @@BT@@data/taskflow.db@@BT@@ 無須初始化。
- Edge 測試使用隔離記憶體 SQLite／隨機 Port，並非對真實資料庫執行破壞性測試。

### 重現指令（PowerShell）

@@BT@@@@BT@@@@BT@@powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
@@BT@@@@BT@@@@BT@@

---`,
};
// Use control char placeholders in raw strings to keep Markdown backticks readable in script.
for (const key of Object.keys(SECTIONS)) SECTIONS[key] = SECTIONS[key].replaceAll("@@BT@@", "`");

function normalize(text) { return text.replace(/\r\n/g, "\n"); }
function count(text, token) { return text.split(token).length - 1; }
function planDoc(rel, original) {
  if (!DOCS.includes(rel)) throw new Error(`不是允許更新的文件：${rel}`);
  const bom = original.startsWith("\ufeff") ? "\ufeff" : "";
  const body = bom ? original.slice(1) : original;
  const normalized = normalize(body);
  if (!normalized.includes(PREVIOUS)) throw new Error(`${rel}：找不到 M9-A 記錄，拒絕改寫`);
  const nStart = count(normalized, START), nEnd = count(normalized, END);
  if (nStart !== nEnd || nStart > 1) throw new Error(`${rel}：M9-B 文件標記損壞或重複`);
  const expected = `${START}\n\n${SECTIONS[rel].trim()}\n\n${END}`;
  if (nStart === 1) {
    const begin = normalized.indexOf(START);
    const finish = normalized.indexOf(END);
    if (finish <= begin) throw new Error(`${rel}：文件標記順序錯誤`);
    const actual = normalized.slice(begin, finish + END.length);
    if (actual !== expected) throw new Error(`${rel}：M9-B 已存在但內容與模板不同，避免覆蓋人工修改；請人工審查`);
    return { rel, original, result: original, changed: false };
  }
  let anchor;
  if (rel === "CHANGELOG.md") {
    anchor = "## [Unreleased]";
  } else {
    const line = normalized.split("\n")[0];
    if (!/^# TaskFlow/.test(line)) throw new Error(`${rel}：不是預期的 TaskFlow 文件`);
    anchor = line;
  }
  if (count(normalized, anchor) !== 1) throw new Error(`${rel}：插入錨點不是唯一`);
  const at = normalized.indexOf(anchor) + anchor.length;
  const after = normalized.slice(at).replace(/^\n+/, "");
  const output = `${normalized.slice(0, at)}\n\n${expected}\n\n${after}`;
  const eol = body.includes("\r\n") ? "\r\n" : "\n";
  return { rel, original, result: bom + output.replace(/\n/g, eol), changed: true };
}
function makePlan(root) {
  const json = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (json.name !== "taskflow") throw new Error("請在 TaskFlow 根目錄執行");
  const required = ["public/task-board.js", "public/task-filters.js", "public/task-filters.css", "tests/task-filters.test.js", "e2e/task-filters.e2e.js"];
  for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`缺少 M9-B 必要檔案：${file}`);
  return DOCS.map(rel => planDoc(rel, fs.readFileSync(path.join(root, rel), "utf8")));
}
function apply(root, {dryRun = false, verify = false} = {}) {
  if (dryRun && verify) throw new Error("dry-run 與 verify 不可同時使用");
  const plans = makePlan(root);
  if (verify && plans.some(p => p.changed)) throw new Error("仍有文件尚未寫入 M9-B 記錄");
  const pending = plans.filter(p => p.changed);
  if (verify || dryRun || pending.length === 0) return {plans, backup:null, written:0};
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9B-docs-"));
  for (const p of pending) {
    const back = path.join(backup, p.rel);
    fs.mkdirSync(path.dirname(back), {recursive:true});
    fs.writeFileSync(back, p.original, "utf8");
  }
  const touched = [];
  try {
    for (const p of pending) {
      const target = path.join(root, p.rel);
      const tmp = `${target}.m9b-tmp-${process.pid}`;
      try {
        fs.writeFileSync(tmp, p.result, {encoding:"utf8",flag:"wx"});
        fs.renameSync(tmp, target);
        touched.push(p);
      } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    }
  } catch(error) {
    for(const p of touched.reverse()) fs.writeFileSync(path.join(root,p.rel),p.original,"utf8");
    throw error;
  }
  return {plans, backup, written:pending.length};
}
function cli() {
  const args=process.argv.slice(2);
  if (args.length > 1 || args.some(a => !["--dry-run", "--verify"].includes(a))) {
    console.error("使用方式：node scripts/close-m9b-docs.js [--dry-run | --verify]");
    process.exitCode=2;return;
  }
  const {plans,backup,written}=apply(path.resolve(__dirname,".."), {dryRun:args[0]==="--dry-run",verify:args[0]==="--verify"});
  for(const p of plans) console.log(`[${args[0]==="--verify"?"已核對":p.changed?(args[0]==="--dry-run"?"預覽待更新":"已更新"):"已存在，跳過"}] ${p.rel}`);
  if(backup) console.log(`原始備份位置：${backup}`);
  console.log(args[0]==="--verify"?"M9-B 六份文件標記驗證通過。":args[0]==="--dry-run"?"預覽完成；沒有寫入檔案。":`M9-B 文件更新完成（本次寫入 ${written} 份）；尚未 Git Commit/Push。`);
}
if(require.main === module) {try{cli();}catch(error){console.error("M9-B 文件工具安全中止：",error.message);process.exitCode=1;}}
module.exports={DOCS,MARKER,START,END,SECTIONS,planDoc,makePlan,apply};
