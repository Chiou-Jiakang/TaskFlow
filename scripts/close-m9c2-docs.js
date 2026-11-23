"use strict";
/** TaskFlow M9-C2 documentation closeout; no Git, database, or network access.
 * Usage: node scripts/close-m9c2-docs.js [--dry-run | --verify]
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const MARKER = "TASKFLOW-M9C2-DOCS-2026-11-23";
const START = `<!-- ${MARKER} -->`;
const END = `<!-- /${MARKER} -->`;
const PREVIOUS = "TASKFLOW-M9C1-DOCS-2026-11-23";
const DOCS = [
  "README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md",
];
const SECTIONS = {
  "README.md": "## 最新開發狀態｜M9-C2 跨功能一致性驗收（2026-11-23）\n\n> 本節為本機功能驗收快照，保留下方 M9-C1 與更早階段的原始紀錄。M9-C2 目前**尚未完成 Git Commit／Push**；TaskFlow v1.0.0 **尚未發布**。\n\n- **基準版本：** M9-C1 Commit `294d06b` 已 Push 到 `origin/main`；本機與遠端 SHA 比對一致。\n- **新增驗收：** `e2e/task-consistency.e2e.js` 以獨立 Owner／Member Session 和隔離專案測試搜尋篩選、全量 Dashboard、Socket.IO 任務同步與跨專案隔離；M9-C2 Edge 專項 **7/7 PASS**。\n- **測試可靠性：** 在完整回歸中，M9-C1 的「HTTP 503 後重試」測試曾受背景 Socket.IO 重新載入干擾，使重試面板在點擊前隱藏。以 `scripts/fix-m9c1-retry-race.js` 僅調整 `e2e/task-ux.e2e.js` 的測試隔離及時序；未為此更動產品 REST／SQLite／前端功能。\n- **最終回歸：** 使用者本機 `npm test` **318/318 PASS**；全部 `e2e/*.e2e.js` 依序執行 **110/110 PASS**；合計 **428 項**，0 fail／skipped／cancelled。M9-C2 專項 7 項與 M9-C1 UX 專項 5 項均已包含在 110 項內，**不可重複加總**，也不代表程式碼覆蓋率。\n- **產品化判定：** M9-C2 定義的跨功能場景未觀察到產品缺陷，故不新增不必要的業務功能；仍須完成本階段文件與 Git 結案。\n- **後續：** M9-C3 響應式與基本無障礙驗收、M9-C4 整合結案、M10 安全與部署／`v1.0.0` Release。\n\n### M9-C2 完整回歸指令\n\n```powershell\nnpm test\n$e2eFiles = @(Get-ChildItem .\\e2e -Filter \"*.e2e.js\" -File | Sort-Object Name | ForEach-Object { $_.FullName })\nnode --test --test-concurrency=1 $e2eFiles\n```\n\n---",
  "CHANGELOG.md": "### M9-C2 — 2026-11-23｜Search / Analytics / Realtime Consistency\n\n#### Added\n\n- 新增 `e2e/task-consistency.e2e.js`：驗證 Owner 與 Member 對任務的新增、狀態變更，對另一頁的篩選清單、Dashboard KPI 與即時同步的影響，以及切換專案後的資料隔離。\n- 新增 `scripts/fix-m9c1-retry-race.js`：針對既有 UX E2E 的重試時序提供備份、預覽、套用及驗證，不修改正式服務程式。\n\n#### Tests / Reliability\n\n- M9-C2 專項 Edge E2E **7/7 PASS**；M9-C1 重試修正後 Edge 專項 **5/5 PASS**。\n- 初次完整 Edge 回歸 **110 tests / 108 pass / 2 fail**（一個子測試與外層測試）：重試面板在 Playwright 點擊前被背景同步隱藏；修正測試隔離後完整回歸 **110/110 PASS**。\n- 完整 Node 測試 **318/318 PASS**；Node＋Edge 完整回歸合計 **428 項**，0 fail、0 skipped、0 cancelled。專項測試包含於完整回歸，不重複計數。\n\n#### Scope\n\n- 本階段屬整合驗證及測試可靠性改善；未新增後端 API、SQLite 欄位或正式產品功能。\n- 本段不表示 M9-C2 已完成 Git Commit／Push；M9-C3／C4 與 M10 部署、正式發布仍未完成。\n\n---",
  "docs/ARCHITECTURE.md": "## 最新架構驗收快照｜M9-C2 跨功能一致性（2026-11-23）\n\n> 此段是測試與資料流驗收補充，不是產品架構重寫；既有 Session／RBAC、REST、Socket.IO、Kanban、M9-A Analytics、M9-B Filter 與 M9-C1 UX 均保留。\n\n```text\nOwner / Member 獨立 Session\n     ├─→ Task REST 寫入／權限與版本檢查\n     └─→ Socket.IO 專案 Room 變更通知\n                     ↓\n          受權限保護的 REST 重新讀取\n                     ↓\n                TaskBoard\n       ├─→ 全量 tasks → Dashboard KPI\n       └─→ 唯讀篩選 → Kanban 卡片與結果數量\n\n跨專案切換：清理舊篩選條件／不混入其他專案資料\n```\n\n- `e2e/task-consistency.e2e.js` 以獨立資料庫、帳號和專案確認訊息與畫面的一致性；Socket 事件僅是刷新提示，任務實際資料仍由授權 REST 回傳。\n- Dashboard 的計算基於完整任務清單，而非篩選後卡片數；跨專案切換須保留資料隔離。\n- M9-C1 重試 E2E 在完整回歸遇到 Socket 背景刷新與模擬失敗的競態；修正點限於測試時序，測試腳本的暫時隔離不得被誤用為正式產品行為。\n- 本階段未改動正式 SQLite schema、後端 API、Session／RBAC 或業務邏輯。\n\n---",
  "docs/DEVELOPMENT_LOG.md": "## 2026-11-23｜M9-C2 跨功能一致性與完整回歸\n\n### 實作／驗收批次\n\n1. 承接 M9-C1 已 Push 並核對 SHA 的 Commit `294d06b`。\n2. 新增 `e2e/task-consistency.e2e.js`，建立隔離帳號、兩個專案及基準任務；測試 Owner／Member 即時更新、搜尋組合篩選、Dashboard 全量統計及跨專案隔離；Edge 專項 **7/7 PASS**。\n3. 完整 Node 回歸 **318/318 PASS**。初次全部 Edge E2E **108/110 PASS**，僅 M9-C1 失敗讀取後重試場景（含其外層測試）受競態影響。\n4. 依 Playwright 診斷：重試按鈕存在但面板已 `hidden`，顯示正常讀取完成；背景 Socket.IO 刷新可能在點擊前清除錯誤狀態。以 `scripts/fix-m9c1-retry-race.js` 僅修正 E2E 隔離／時序，備份原始測試檔，`--verify` 與語法檢查通過。\n5. 修後單獨 M9-C1 E2E **5/5 PASS**；最後完整 Edge E2E **110/110 PASS**，0 fail／skipped／cancelled。整體 Node＋Edge **428 項通過**。\n\n### 技術界線與判定\n\n- 未發現 M9-C2 定義的跨功能一致性產品缺陷；未對正式 `server/`、SQLite 或前端功能做不必要變更。\n- 測試使用隔離記憶體 SQLite、獨立測試 Session；未重新初始化正式資料庫。\n- 此時文件與 Git 結案仍待完成；六份文件必須新增增量快照並保留歷史。\n\n### 下一步\n\n- 更新六份文件、`git diff --check`、精確暫存、Commit／Push 與遠端 SHA 比對。\n- M9-C3 響應式及無障礙、M9-C4 最終整合驗收、M10 安全部署與 Release。\n\n---",
  "docs/PROJECT_PLAN.md": "## 最新里程碑狀態｜M9-C2（2026-11-23）\n\n> 本段為最新快照；較下方 M9-C1 段落仍保留當時尚待 Git 結案的歷史描述。TaskFlow **v1.0.0 尚未正式發布**。\n\n| 里程碑 | 當前狀態 | 已確認／待完成 |\n| --- | --- | --- |\n| M0～M9-B | 已結案 | 既有產品核心功能與文件、Git 歷史保留 |\n| M9-C1｜Kanban UX | 已完成 GitHub 結案 | Commit `294d06b`，本機與 GitHub `main` SHA 已核對 |\n| M9-C2｜跨功能一致性 | 功能與完整回歸通過 | Edge 專項 7/7；完整 Node 318/318、Edge 110/110 |\n| M9-C2｜文件與 Git | 目前進行 | 文件預覽／驗證、精確 staging、Commit／Push、SHA 比對 |\n| M9-C3｜響應式與無障礙 | 尚未開始 | 手機／平板版面、鍵盤操作、焦點、ARIA 基礎驗收 |\n| M9-C4｜總整合結案 | 尚未開始 | 全面品質與文件／Git 收斂 |\n| M10｜正式產品化 | 尚未開始 | 安全、部署、備份／復原與 `v1.0.0` Release |\n\n### M9-C2 Git 結案檢核\n\n- [x] M9-C2 專項 Edge **7/7 PASS**。\n- [x] M9-C1 Retry 測試競態修正，單獨 **5/5 PASS**。\n- [x] 完整 Node **318/318**、完整 Edge **110/110**，均 0 failed／skipped／cancelled。\n- [ ] 六份文件已正確新增 M9-C2 快照，`--verify`、重複 `--dry-run` 通過。\n- [ ] Git 精確暫存測試、修正工具與六份文件，不包含 M8 TXT／ZIP 說明／正式 SQLite。\n- [ ] 已檢視 staged diff、`git diff --cached --check` 通過。\n- [ ] 本機 Commit／GitHub Push 成功，`HEAD` 與遠端 `refs/heads/main` 完整 SHA 相同。\n\n> 文件工具只記錄至寫入前已發生的事實；不得提前勾選 Commit／Push 或宣告 v1.0.0 已發布。\n\n---",
  "docs/TESTING.md": "## 最新測試快照｜M9-C2 Search / Dashboard / Realtime（2026-11-23）\n\n> 依使用者本機 PowerShell 截圖記錄；測試通過率不等於程式碼覆蓋率，也不能取代 M10 安全或部署驗收。\n\n| 項目 | 結果 | 備註 |\n| --- | --- | --- |\n| M9-C2 搜尋、Dashboard、多人同步、跨專案專項 E2E | **7/7 PASS** | 隔離 Session／SQLite／專案 |\n| M9-C1 重試測試競態修正後專項 E2E | **5/5 PASS** | 隔離背景 Socket.IO 干擾；不修改正式產品功能 |\n| `npm test` 完整 Node 回歸 | **318/318 PASS** | fail 0、skipped 0、cancelled 0 |\n| 全部 `e2e/*.e2e.js` Microsoft Edge | **110/110 PASS** | fail 0、skipped 0、cancelled 0 |\n| 完整套件合計 | **428 項 PASS** | 318 + 110；上述專項已包含其中 |\n\n### 測試問題與修復記錄\n\n- 初次全套 Edge：110 tests、108 pass、2 fail（M9-C1 retry 子測試與外層測試）。診斷顯示重試按鈕存在、未停用，但面板在點擊前隱藏；當時任務已成功載入。\n- 修正 `e2e/task-ux.e2e.js` 的測試隔離／時序，避免背景 Socket.IO REST 刷新搶先恢復畫面。執行修正工具的 `--dry-run`、`--apply`、`--verify`，再做 `node --check`。\n- 修後單獨 Edge **5/5 PASS**，最後完整 Edge **110/110 PASS**。此測試競態不等同正式產品缺陷。\n- M9-C2 的 7 項 Edge 專項已包括於全部 110 項中，不能另外加總成 117。完整測試不代表所有部署、安全、負載與跨瀏覽器情境都已涵蓋。\n\n### 完整回歸指令\n\n```powershell\nnpm test\n$e2eFiles = @(Get-ChildItem .\\e2e -Filter \"*.e2e.js\" -File | Sort-Object Name | ForEach-Object { $_.FullName })\nnode --test --test-concurrency=1 $e2eFiles\n```\n\n---"
};

function normalize(text) { return text.replace(/\r\n/g, "\n"); }
function count(text, token) { return text.split(token).length - 1; }
function planDoc(rel, original) {
  if (!DOCS.includes(rel)) throw new Error(`不是允許更新的文件：${rel}`);
  const bom = original.startsWith("\ufeff") ? "\ufeff" : "";
  const body = bom ? original.slice(1) : original;
  const normalized = normalize(body);
  if (!normalized.includes(PREVIOUS)) throw new Error(`${rel}：找不到 M9-B 記錄，拒絕改寫`);
  const nStart = count(normalized, START), nEnd = count(normalized, END);
  if (nStart !== nEnd || nStart > 1) throw new Error(`${rel}：M9-C2 文件標記損壞或重複`);
  const expected = `${START}\n\n${SECTIONS[rel].trim()}\n\n${END}`;
  if (nStart === 1) {
    const begin = normalized.indexOf(START);
    const finish = normalized.indexOf(END);
    if (finish <= begin) throw new Error(`${rel}：文件標記順序錯誤`);
    const actual = normalized.slice(begin, finish + END.length);
    if (actual !== expected) throw new Error(`${rel}：M9-C2 已存在但內容與模板不同，避免覆蓋人工修改；請人工審查`);
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
  const required = ["e2e/task-consistency.e2e.js", "e2e/task-ux.e2e.js", "scripts/fix-m9c1-retry-race.js"];
  for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`缺少 M9-C2 必要檔案：${file}`);
  return DOCS.map(rel => planDoc(rel, fs.readFileSync(path.join(root, rel), "utf8")));
}
function apply(root, {dryRun = false, verify = false} = {}) {
  if (dryRun && verify) throw new Error("dry-run 與 verify 不可同時使用");
  const plans = makePlan(root);
  if (verify && plans.some(p => p.changed)) throw new Error("仍有文件尚未寫入 M9-C2 記錄");
  const pending = plans.filter(p => p.changed);
  if (verify || dryRun || pending.length === 0) return {plans, backup:null, written:0};
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9C2-docs-"));
  for (const p of pending) {
    const back = path.join(backup, p.rel);
    fs.mkdirSync(path.dirname(back), {recursive:true});
    fs.writeFileSync(back, p.original, "utf8");
  }
  const touched = [];
  try {
    for (const p of pending) {
      const target = path.join(root, p.rel);
      const tmp = `${target}.m9c2-tmp-${process.pid}`;
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
    console.error("使用方式：node scripts/close-m9c2-docs.js [--dry-run | --verify]");
    process.exitCode=2;return;
  }
  const {plans,backup,written}=apply(path.resolve(__dirname,".."), {dryRun:args[0]==="--dry-run",verify:args[0]==="--verify"});
  for(const p of plans) console.log(`[${args[0]==="--verify"?"已核對":p.changed?(args[0]==="--dry-run"?"預覽待更新":"已更新"):"已存在，跳過"}] ${p.rel}`);
  if(backup) console.log(`原始備份位置：${backup}`);
  console.log(args[0]==="--verify"?"M9-C2 六份文件標記驗證通過。":args[0]==="--dry-run"?"預覽完成；沒有寫入檔案。":`M9-C2 文件更新完成（本次寫入 ${written} 份）；尚未 Git Commit/Push。`);
}
if(require.main === module) {try{cli();}catch(error){console.error("M9-C2 文件工具安全中止：",error.message);process.exitCode=1;}}
module.exports={DOCS,MARKER,START,END,SECTIONS,planDoc,makePlan,apply};
