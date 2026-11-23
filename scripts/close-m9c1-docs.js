"use strict";
/**
 * TaskFlow M9-C1 documentation closeout (non-destructive, idempotent).
 * Usage: node scripts/close-m9c1-docs.js [--dry-run | --verify]
 * Restricted to six existing Markdown files. No Git, database or network actions.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MARKER = "TASKFLOW-M9C1-DOCS-2026-11-23";
const START = `<!-- ${MARKER} -->`;
const END = `<!-- /${MARKER} -->`;
const PREVIOUS = "TASKFLOW-M9B-DOCS-2026-11-23";
const DOCS = [
  "README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md",
];

const SECTIONS = {
  'README.md': String.raw`## 最新開發狀態｜M9-C1 看板 UX 與載入回饋（2026-11-23）

> 本節為最新進度快照；下方 M9-B 以前段落保留原始歷程。TaskFlow v1.0.0 尚未發布，M9-C1 目前完成實作與本機驗收；本節**不預先宣告** M9-C1 Git Commit／Push。

- **基準版本：** M9-B 已於 Commit @@BT@@3581f62@@BT@@ Push 至 @@BT@@origin/main@@BT@@，並以 40 位 SHA 驗證與本機一致。
- **UX 改善：** 在現有正式 Kanban 顯示任務載入狀態、全專案無任務提示、空欄位說明及資料讀取失敗時的重新嘗試按鈕。將「篩選沒有結果」與「專案原本沒有任務」區分。
- **實作檔案：** @@BT@@public/index.html@@BT@@、@@BT@@public/task-board.js@@BT@@ 進行最小掛接；新增 @@BT@@public/task-ux.css@@BT@@、@@BT@@scripts/apply-m9c1.js@@BT@@、@@BT@@tests/apply-m9c1.test.js@@BT@@、@@BT@@e2e/task-ux.e2e.js@@BT@@。
- **測試修正：** 初版重試 E2E 在異常網路模擬中按鈕點擊逾時；後以可控 HTTP 503、等待前項操作結束與診斷資訊改善測試時序。修正後 M9-C1 Edge 專項 5/5 PASS。該問題**不是已證實的產品功能錯誤**。
- **完整回歸：** 本機 @@BT@@npm test@@BT@@ 314/314 PASS；所有 @@BT@@e2e/*.e2e.js@@BT@@ 依序執行 103/103 PASS；總計 417 項測試，0 fail／skipped／cancelled。此數字不是程式碼覆蓋率。M9-C1 整合工具 4/4 Node 測試包含於完整回歸。
- **設計界線：** 不重置正式 SQLite，不改動 Session／RBAC、REST Payload、Socket.IO、Kanban 原子排序或 M9-A／M9-B 資料邏輯。空狀態與錯誤重試純屬畫面互動層。
- **後續：** M9-C2 搜尋／Dashboard／即時同步一致性；M9-C3 響應式與無障礙；M9-C4 整體文件與 Git 結案，最後 M10 安全部署與 Release。

### M9-C1 回歸指令

@@BT@@@@BT@@@@BT@@powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
@@BT@@@@BT@@@@BT@@

---`,
  'CHANGELOG.md': String.raw`### M9-C1 — 2026-11-23｜Kanban UX: Loading, Empty States & Retry

#### Added

- 透過 @@BT@@public/index.html@@BT@@、@@BT@@public/task-board.js@@BT@@ 加入載入回饋、全專案空看板與空欄位狀態、讀取失敗重試按鈕；不與搜尋空結果混淆。
- 新增 @@BT@@public/task-ux.css@@BT@@，與既有深色看板風格整合。
- 新增可預覽／備份／驗證且冪等的 @@BT@@scripts/apply-m9c1.js@@BT@@，以及 @@BT@@tests/apply-m9c1.test.js@@BT@@ 和 @@BT@@e2e/task-ux.e2e.js@@BT@@。

#### Tests / Reliability

- 初版重試 E2E 遇到 Playwright 點擊逾時；調整測試等待時序與失敗模擬為可控 HTTP 503，並加入診斷資訊。修正版 Edge E2E 5/5 PASS，未因此修改產品 API／SQLite。
- 完整 Node 314/314 PASS、全部 Edge E2E 103/103 PASS，0 failed、0 skipped；Node 4 項工具測試包含在 314 項內，Edge 5 項專項包含在 103 項內。
- 使用者回報 M9-C1 功能操作與本機環境正常；Git 暫存、Commit、Push 尚待結案前確認。

#### Scope

- M9-B 已於 @@BT@@3581f62@@BT@@ 完成 GitHub 同步；本段為 M9-C1 **功能與測試**階段紀錄，不能視為 M9-C1 Git 結案證據。
- M9-C2／C3／C4 與 M10 正式部署及 Release 仍待完成。

---`,
  'docs/ARCHITECTURE.md': String.raw`## 最新架構快照｜M9-C1 Kanban UX（2026-11-23）

> 本節記錄 M9-C1 的顯示層增量；既有 M9-A Dashboard、M9-B 前端篩選、M7 Socket.IO 與 M5/M6 任務 API 維持原有資料流程。

@@BT@@@@BT@@@@BT@@text
Session 驗證 → 現有 Project / Members / Tasks REST
    → public/task-board.js 的專案狀態與完整任務陣列
       ├─ M9-A analytics：全量統計，不受篩選影響
       ├─ M9-B filters：唯讀篩選後呈現卡片
       └─ M9-C1 UX：載入／錯誤重試／全空專案與空欄位回饋
                   ↓
            public/index.html + public/task-ux.css
@@BT@@@@BT@@@@BT@@

- @@BT@@task-board.js@@BT@@ 仍依既有 Session、CSRF 與 RBAC 執行 CRUD、狀態修改及拖放排序；M9-C1 不增加後端新端點、Socket 事件或 SQLite 欄位。
- UI 空狀態應區分：專案未選取／目前專案沒有任何任務／某一欄沒有任務／篩選條件無符合資料。重試動作僅重新取得既有 REST 資料。
- 背景刷新同一專案不得清空編輯中的表單；權限撤銷與真正的專案切換仍需清理舊資料。載入失敗不得保留可能失權的舊任務資料。
- @@BT@@scripts/apply-m9c1.js@@BT@@ 僅供開發期間安全掛接，禁止視為正式伺服器啟動必備步驟；保留原檔備份與冪等驗證。
- M9-C2 與 M9-C3 尚需針對同步狀態一致性、響應式與鍵盤操作繼續驗收；M10 另處理部署／安全／效能。

---`,
  'docs/DEVELOPMENT_LOG.md': String.raw`## 2026-11-23｜M9-C1 看板 UX 開發與驗收紀錄

### 實作與技術選擇

- 承接 M9-B GitHub 結案版本 @@BT@@3581f62@@BT@@。新增看板載入狀態、空專案／空欄提示、載入失敗重試，使用 @@BT@@public/task-ux.css@@BT@@ 並以 @@BT@@scripts/apply-m9c1.js@@BT@@ 安全整合進 @@BT@@public/index.html@@BT@@ 和 @@BT@@public/task-board.js@@BT@@。
- 整合工具先通過 4/4 Node 測試與 dry-run，正式套用後 @@BT@@--verify@@BT@@ 及重複 @@BT@@--dry-run@@BT@@ 均顯示已是最新；備份存放於系統 Temp，不涉及 SQLite 重建。
- 初版 @@BT@@e2e/task-ux.e2e.js@@BT@@ 出現讀取失敗後點擊重試逾時，修正版改善 E2E 模擬及等待時序，用可控 503 測試；修後 5/5 Edge PASS，不在缺乏證據下直接修改產品 API。

### 已驗證的結果（本機終端輸出）

- 完整 Node @@BT@@npm test@@BT@@：314/314 PASS、fail 0、skipped 0、cancelled 0。
- 全部 Microsoft Edge E2E：103/103 PASS、fail 0、skipped 0、cancelled 0。
- M9-C1 Edge 專項：5/5 PASS；整合工具 Node：4/4 PASS（均屬上述完整套件子集）。
- 使用者表示功能操作正常；@@BT@@git diff --check@@BT@@ 未回報差異格式錯誤；這不代表已完成 Git Commit／Push。

### 後續

- M9-C1 六份文件更新、精確 Git 暫存與遠端 SHA 比對。
- M9-C2：搜尋、統計、即時同步狀態一致性；M9-C3：響應式與無障礙；M9-C4：UX 整合結案；M10：部署安全與 Release。

---`,
  'docs/PROJECT_PLAN.md': String.raw`## 最新里程碑狀態｜M9-C1（2026-11-23）

> 此為最新快照；下方 M9-B 和更早階段紀錄是原始歷史，不可將其中舊的「待 Git 結案」誤判為目前狀態。TaskFlow v1.0.0 **尚未發布**。

| 里程碑 | 當前狀態 | 已確認／仍需完成 |
| --- | --- | --- |
| M0～M9-B | 已完成階段結案 | M9-B Commit @@BT@@3581f62@@BT@@ 已與 @@BT@@origin/main@@BT@@ SHA 比對一致 |
| M9-C1｜看板 UX | 功能與完整回歸通過 | Node 314/314；Edge 103/103；載入、空狀態、重試的 E2E 5/5 |
| M9-C1｜六份文件與 Git | 待結案 | 文件 dry-run／verify；精確 staging；Commit、Push、HEAD 與遠端 SHA 比對 |
| M9-C2｜多功能同步一致性 | 尚未開始 | 搜尋／看板／Dashboard／多人即時變更整合 |
| M9-C3｜響應式與無障礙 | 尚未開始 | 行動版與鍵盤操作、焦點狀態、基本無障礙 |
| M9-C4｜整體文件結案 | 尚未開始 | 多階段整合驗收與文件／Git 收斂 |
| M10｜安全部署與 Release | 尚未開始 | 正式環境配置、風險審核、備份、Release |

### M9-C1 Git 結案標準

- [x] M9-C1 專項 5/5 Edge 與整合工具 4/4 Node 完成。
- [x] 全部 Node 314/314、全部 Edge 103/103，無失敗與跳過。
- [ ] 六份文件成功加入 M9-C1 段落，@@BT@@--verify@@BT@@、冪等 @@BT@@--dry-run@@BT@@ 通過。
- [ ] 精確 staged 必要程式、測試、文件，排除 M8 與工具 README TXT、憑證及正式 SQLite。
- [ ] @@BT@@git diff --cached --check@@BT@@ 通過，審查 staged 差異與檔案數量。
- [ ] Git Commit／Push 後比較 @@BT@@HEAD@@BT@@ 與 GitHub @@BT@@refs/heads/main@@BT@@ SHA 完全相同。

> 最後三項僅供結案流程核對，不由文件腳本代替實際驗證。

---`,
  'docs/TESTING.md': String.raw`## 最新測試快照｜M9-C1 Kanban UX（2026-11-23）

> 依使用者提供之本機終端截圖與操作回報記錄。下方 M9-B 與更早歷史測試保留。此處不代表 M10 部署安全、負載與跨瀏覽器驗收完成。

| 範圍 | 驗收結果 | 補充 |
| --- | --- | --- |
| M9-C1 apply 工具 Node 專項 | 4/4 PASS | 腳本定位、冪等、拒絕非預期結構 |
| M9-C1 Edge UX 專項（修正版） | 5/5 PASS | 全空專案、空欄位、模擬 503 失敗重試、篩選空結果 |
| @@BT@@npm test@@BT@@ 完整 Node 回歸 | 314/314 PASS | fail 0、skipped 0、cancelled 0 |
| 全部 @@BT@@e2e/*.e2e.js@@BT@@ | 103/103 PASS | fail 0、skipped 0、cancelled 0 |
| 本機人工操作 | 使用者回報功能正常 | 不是額外的自動化測試 |

- 兩套完整測試合計 **417 項**，專項測試已包含其中，不能重複加總成 426 項或宣稱程式碼覆蓋率 100%。
- 初次 M9-C1 Edge E2E 為 5 tests、3 pass、2 fail（包含外層測試）；點擊重試按鈕等待逾時。後以可控 HTTP 503 模擬與操作時序修訂測試，專項 5/5 PASS，隨後完整 Edge 103/103 PASS。
- 測試資料使用隔離 SQLite、隨機 Port；沒有透過 E2E 重新初始化正式資料庫。
- 最終確認 @@BT@@git diff --check@@BT@@ 無格式錯誤，但 M9-C1 的 Git Commit／Push 尚須另行驗證。

### M9-C1 完整回歸指令

@@BT@@@@BT@@@@BT@@powershell
npm test
$e2eFiles = @(Get-ChildItem .\e2e -Filter "*.e2e.js" -File | Sort-Object Name | ForEach-Object { $_.FullName })
node --test --test-concurrency=1 $e2eFiles
@@BT@@@@BT@@@@BT@@

---`,
};
for (const key of Object.keys(SECTIONS)) SECTIONS[key] = SECTIONS[key].replaceAll("@@BT@@", "`");

function normalize(text) { return text.replace(/\r\n/g, "\n"); }
function count(text, token) { return text.split(token).length - 1; }
function planDoc(rel, original) {
  if (!DOCS.includes(rel)) throw new Error(`不是允許更新的文件：${rel}`);
  const bom = original.startsWith("\ufeff") ? "\ufeff" : "";
  const body = bom ? original.slice(1) : original;
  const normalized = normalize(body);
  if (!normalized.includes(PREVIOUS)) throw new Error(`${rel}：找不到 M9-B 記錄，拒絕改寫`);
  const nStart = count(normalized, START), nEnd = count(normalized, END);
  if (nStart !== nEnd || nStart > 1) throw new Error(`${rel}：M9-C1 文件標記損壞或重複`);
  const expected = `${START}\n\n${SECTIONS[rel].trim()}\n\n${END}`;
  if (nStart === 1) {
    const begin = normalized.indexOf(START);
    const finish = normalized.indexOf(END);
    if (finish <= begin) throw new Error(`${rel}：文件標記順序錯誤`);
    const actual = normalized.slice(begin, finish + END.length);
    if (actual !== expected) throw new Error(`${rel}：M9-C1 已存在但內容與模板不同，避免覆蓋人工修改；請人工審查`);
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
  const required = ["public/task-board.js", "public/task-ux.css", "scripts/apply-m9c1.js", "tests/apply-m9c1.test.js", "e2e/task-ux.e2e.js"];
  for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`缺少 M9-C1 必要檔案：${file}`);
  return DOCS.map(rel => planDoc(rel, fs.readFileSync(path.join(root, rel), "utf8")));
}
function apply(root, {dryRun = false, verify = false} = {}) {
  if (dryRun && verify) throw new Error("dry-run 與 verify 不可同時使用");
  const plans = makePlan(root);
  if (verify && plans.some(p => p.changed)) throw new Error("仍有文件尚未寫入 M9-C1 記錄");
  const pending = plans.filter(p => p.changed);
  if (verify || dryRun || pending.length === 0) return {plans, backup:null, written:0};
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9C1-docs-"));
  for (const p of pending) {
    const back = path.join(backup, p.rel);
    fs.mkdirSync(path.dirname(back), {recursive:true});
    fs.writeFileSync(back, p.original, "utf8");
  }
  const touched = [];
  try {
    for (const p of pending) {
      const target = path.join(root, p.rel);
      const tmp = `${target}.m9c1-tmp-${process.pid}`;
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
    console.error("使用方式：node scripts/close-m9c1-docs.js [--dry-run | --verify]");
    process.exitCode=2;return;
  }
  const {plans,backup,written}=apply(path.resolve(__dirname,".."), {dryRun:args[0]==="--dry-run",verify:args[0]==="--verify"});
  for(const p of plans) console.log(`[${args[0]==="--verify"?"已核對":p.changed?(args[0]==="--dry-run"?"預覽待更新":"已更新"):"已存在，跳過"}] ${p.rel}`);
  if(backup) console.log(`原始備份位置：${backup}`);
  console.log(args[0]==="--verify"?"M9-C1 六份文件標記驗證通過。":args[0]==="--dry-run"?"預覽完成；沒有寫入檔案。":`M9-C1 文件更新完成（本次寫入 ${written} 份）；尚未 Git Commit/Push。`);
}
if(require.main === module) {try{cli();}catch(error){console.error("M9-C1 文件工具安全中止：",error.message);process.exitCode=1;}}
module.exports={DOCS,MARKER,START,END,SECTIONS,planDoc,makePlan,apply};
