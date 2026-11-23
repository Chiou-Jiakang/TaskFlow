"use strict";
/**
 * TaskFlow M9-C3 (deferred) / M9-C4 (documentation freeze) closeout.
 * Usage: node scripts/close-m9c34-docs.js [--dry-run | --verify]
 * This tool does NOT modify product code, database, Git, or network state.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MARKER = "TASKFLOW-M9C34-CLOSEOUT-2026-11-23";
const START = `<!-- ${MARKER} -->`;
const END = `<!-- /${MARKER} -->`;
const PREVIOUS_START = "<!-- TASKFLOW-M9C2-DOCS-2026-11-23 -->";
const PREVIOUS_END = "<!-- /TASKFLOW-M9C2-DOCS-2026-11-23 -->";
const DOCS = [
  "README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md",
];

const SECTIONS = {
  "README.md": `## 最新專案狀態｜M9-C3 暫緩驗收、M9-C4 文件收斂（2026-11-23）

> 此段記錄**範圍決策與已知風險**，不表示手機版或無障礙檢查已通過，也不表示 TaskFlow v1.0.0 已正式發布。下方 M9-C2 及更早段落保留為歷史快照；其中「尚未 Push」屬當時的開發紀錄。

- **已核對 Git 基準：** M9-C2 Commit \`7e11836\` 已 Push 至 GitHub \`main\`；本機 HEAD 與 \`refs/heads/main\` 的完整 SHA 一致（依 2026-11-23 終端截圖）。
- **最近一次完整回歸：** Node \`318/318 PASS\`、Microsoft Edge E2E \`110/110 PASS\`，合計 428 項，均 0 fail／skipped／cancelled。這是既有測試套件結果，**不是**響應式或 WCAG 驗證，也非程式碼覆蓋率。
- **M9-C3 決策：** 使用者選擇不再繼續手機／平板與鍵盤／無障礙測試，以 \`Deferred / Not Verified\` 暫緩結案；沒有實作新的行動版修正，也不將未驗證項目標成 PASS。
- **已做的視覺檢視：** 桌面寬度截圖中，專案列表、任務表單、Dashboard、篩選及三欄看板的**空任務畫面**沒有明顯重疊／裁切；未涵蓋真實手機尺寸與非空任務卡片。
- **待處理風險：** 目前 CSS 在 720px 以下隱藏 Sidebar；未驗證手機版是否具備等效導航；頁面仍顯示 \`M5-C1\` 開發期標籤。公開部署前需先處理或明確限制支援環境。
- **M9-C4 文件收斂：** 保存驗收範圍、保留事項與 M10 發布條件；此批文件工具只更新文件，Git Commit／Push 與遠端 SHA 仍須以後續操作確認。
- **M10 Release Gate：** 安全與權限檢查、敏感資料／金鑰掃描、正式環境 Session／CSRF／HTTPS、備份與還原演練、部署驗收和版本標記；全部未完成前不得宣稱 production-ready 或已 Release。

---`,
  "CHANGELOG.md": `### M9-C3 / M9-C4 — 2026-11-23｜Responsive Verification Deferred / Documentation Freeze

#### Decision / Documentation

- M9-C3 手機、平板響應式測試及鍵盤／焦點／ARIA 無障礙檢查由使用者決定暫緩；狀態記為 **Deferred / Not Verified**，不是 PASS。
- 已檢視桌面寬度的空專案／空任務畫面；未進行 320px、390px、768px 真實裝置模擬驗收，也未驗證非空任務卡片在行動版的表現。
- 已識別候選風險：720px 以下 Sidebar 隱藏、行動版替代導航尚未驗證，以及畫面上仍顯示 \`M5-C1\` 舊開發標籤。
- M9-C4 合併處理文件與發版前的待辦收斂；保留 M9-C2 Commit \`7e11836\` 的 GitHub SHA 比對結果。

#### Previously Verified（沿用，不重新宣稱新測試）

- 上一輪完整 Node **318/318 PASS**、Edge E2E **110/110 PASS**；共 428 項。這不涵蓋此輪未執行的響應式、無障礙及 M10 安全／部署驗收。
- 本階段無正式產品程式碼、SQLite Schema、REST API 修改。

#### Release status

- **Unreleased**：v1.0.0 尚未發布。正式部署／Release 需在 M10 另行通過安全、環境、備份與復原等檢核；本段不預先宣告 Git Commit／Push 成功。

---`,
  "docs/ARCHITECTURE.md": `## M9-C3 / M9-C4｜UI 支援邊界與發布風險（2026-11-23）

> 此節為範圍及技術風險紀錄，不新增架構元件。

- 已觀察桌面寬度的既有 Sidebar、表單、Analytics、Filter 和 Kanban 空狀態排版；沒有取得 768px、390px、320px 或鍵盤／讀屏驗收結論。
- \`public/style.css\` 包含 720px 以下隱藏 \`.sidebar\` 的響應式規則；尚未驗證同等可用的行動版導覽機制。這是待驗證風險，**不能等同已證實無法導航**。
- \`public/index.html\` 仍有 \`M5-C1\` 開發期版本標記；未於本階段修改。
- 保留既有 \`Task REST → 授權讀取 → TaskBoard 完整任務 → Analytics / Filters / Kanban\` 以及 Socket.IO 通知／重新抓取資料的架構；M9-C3／C4 不調整 Session／RBAC、REST、SQLite 或 UI 原始碼。
- M10 若選擇公開部署，必須針對支援裝置、使用者可達性及安全邊界重新檢查；在驗收之前不主張 WCAG 符合性或全裝置支援。

---`,
  "docs/DEVELOPMENT_LOG.md": `## 2026-11-23｜M9-C3 風險接受與 M9-C4 文件收斂

### 決策與證據

1. M9-C2 Commit \`7e11836\` 已 Push，使用者已比對本機與遠端 40 位 SHA 一致。
2. 保留上一輪完整測試證據：Node 318/318、Edge 110/110 PASS；此數據沒有涵蓋新一輪行動裝置／無障礙測試。
3. 使用者提供桌面版的專案列表、任務建立表單、Dashboard Analytics、任務搜尋與三欄 Kanban 截圖；空任務場景未見明顯重疊或裁切。
4. 已提出 768px、390px、320px 的裝置模擬、水平溢出、鍵盤焦點及 ARIA 檢查，但使用者決定**先不執行，直接條件式結案**。
5. 將 M9-C3 的未執行項目正式列為 \`Deferred / Not Verified\`；注意 720px Sidebar 隱藏、行動替代導航未確認與 \`M5-C1\` 標籤待清理。
6. M9-C4 合併收斂六份文件；本工具只提供 \`--dry-run\`、安全備份、重複跳過與 \`--verify\`，不改動正式功能或資料。

### 尚未完成的工作

- 本批文件仍須經人工差異檢查、精確 Git staging、Commit、Push 和完整 SHA 驗證；不得提前標成完成。
- M10 必須驗收安全、部署方式、Session／CSRF／HTTPS、備份還原、設定與秘密管理，以及 v1.0.0 Release；視發布範圍補做未驗證的 UI 支援項目。

---`,
  "docs/PROJECT_PLAN.md": `## 最新里程碑狀態｜M9-C3 / M9-C4 條件式結案（2026-11-23）

> 此為決策快照。下方較舊里程碑表格的「尚未開始／待 Push」是當時狀態，不應與最新驗收混淆。TaskFlow **v1.0.0 尚未發布**。

| 里程碑 | 最新狀態 | 判定依據 |
| --- | --- | --- |
| M0～M9-C1 | 已完成階段結案 | 既有功能、文件和 Git 履歷 |
| M9-C2 | 已完成 GitHub 結案 | Commit \`7e11836\`，本機／遠端 SHA 一致；Node 318/318、Edge 110/110 |
| M9-C3｜桌面版視覺檢查 | 初步完成（有限範圍） | 桌面空任務截圖，未見明顯排版重疊 |
| M9-C3｜手機／平板響應式 | **Deferred / Not Verified** | 320px／390px／768px 未進行實際驗收 |
| M9-C3｜鍵盤與無障礙 | **Deferred / Not Verified** | 焦點管理、ARIA、讀屏／鍵盤路徑未實測 |
| M9-C4｜文件收斂 | 進行中 | 六份文件更新、差異審查與 Git 結案待確認 |
| M10｜產品正式發布 | 尚未開始 | 安全、部署、備份還原、支援環境與 Release Gate |

### M9-C4 文件與 Git 結案條件

- [ ] 六份文件增量更新成功，\`--verify\` 與重複 \`--dry-run\` 通過。
- [ ] 審查本次文件差異並核對 \`Deferred / Not Verified\` 不被誤寫為 PASS。
- [ ] 只暫存本次六份 Markdown、結案腳本與測試；排除各階段 ZIP README TXT、資料庫及私密設定。
- [ ] \`git diff --cached --check\` 通過，Git Commit／Push 成功且 HEAD 與遠端完整 SHA 一致。
- [ ] 進入 M10 前，保留未驗證的行動版／無障礙風險，決定公開部署或本機原始碼 Release 範圍。

> 文件中不會自行勾選 Git 操作完成；實際結果以終端機及遠端證據為準。

---`,
  "docs/TESTING.md": `## 最新驗收快照｜M9-C3 / M9-C4（2026-11-23）

> 本節明確區分**已執行測試**、**人工檢視**與**未驗證項目**。

| 範圍 | 結果 | 證據／限制 |
| --- | --- | --- |
| M9-C2 完整 Node 回歸 | **318/318 PASS** | 已完成，沿用既有截圖結果；非本階段重跑 |
| M9-C2 完整 Edge E2E | **110/110 PASS** | 已完成，含 M9-C2／C1 專項；非本階段重跑 |
| 桌面版 UI 空任務畫面 | **初步視覺檢查** | 截圖未見明顯重疊；不含互動／非空卡片測試 |
| 768px 平板及 390px／320px 手機 | **Deferred / Not Verified** | 使用者決定暫緩，尚無裝置模擬／水平溢出測試結果 |
| 鍵盤導覽、焦點管理、ARIA／讀屏 | **Deferred / Not Verified** | 不得宣稱已通過基本無障礙或 WCAG 驗收 |
| M10 安全、部署、備份／還原 | **Not Tested** | 必須在正式對外發布前獨立執行 |

### 已知風險與限制

- CSS 在寬度 720px 以下隱藏 Sidebar；替代導航可用性待確認。
- 頁面可見開發期 \`M5-C1\` 版本標籤，正式發布前待清理。
- 完整 Node + Edge 合計 **428 項 PASS**，不表示全裝置測試、程式碼覆蓋率 100% 或 production-ready。

### 後續 M10 驗收條件

- Session／RBAC／CSRF、秘密與環境變數、公開 HTTPS、錯誤處理、資料庫備份與復原，以及發布管線檢查。
- 如需宣稱支援手機／平板或無障礙標準，必須補跑對應驗收；若僅提供桌面本機作品，README 必須清楚限制支援範圍。

---`,
};

function normalize(s) { return s.replace(/\r\n/g, "\n"); }
function occurrences(text, needle) { return text.split(needle).length - 1; }
function planDoc(rel, original) {
  if (!DOCS.includes(rel)) throw new Error(`拒絕修改非白名單文件：${rel}`);
  const hasBom = original.startsWith("\ufeff");
  const bom = hasBom ? "\ufeff" : "";
  const body = hasBom ? original.slice(1) : original;
  const normalized = normalize(body);
  if (occurrences(normalized, PREVIOUS_START) !== 1 || occurrences(normalized, PREVIOUS_END) !== 1 || normalized.indexOf(PREVIOUS_END) < normalized.indexOf(PREVIOUS_START)) {
    throw new Error(`${rel}：找不到完整、唯一的 M9-C2 原始標記；拒絕修改`);
  }
  const startCount = occurrences(normalized, START), endCount = occurrences(normalized, END);
  if (startCount !== endCount || startCount > 1) throw new Error(`${rel}：M9-C3/C4 標記不完整或重複`);
  const expected = `${START}\n\n${SECTIONS[rel].trim()}\n\n${END}`;
  if (startCount === 1) {
    const start = normalized.indexOf(START), end = normalized.indexOf(END);
    if (end < start) throw new Error(`${rel}：標記順序錯誤`);
    const actual = normalized.slice(start, end + END.length);
    if (actual !== expected) throw new Error(`${rel}：已有 M9-C3/C4 區段但內容被修改，拒絕覆蓋，請人工審核`);
    return {rel, original, result: original, changed: false};
  }
  let anchor;
  if (rel === "CHANGELOG.md") anchor = "## [Unreleased]";
  else {
    anchor = normalized.split("\n")[0];
    if (!anchor.startsWith("# TaskFlow")) throw new Error(`${rel}：第一行不是 TaskFlow 標題`);
  }
  if (occurrences(normalized, anchor) !== 1) throw new Error(`${rel}：插入標記不唯一`);
  const i = normalized.indexOf(anchor) + anchor.length;
  const before = normalized.slice(0, i);
  const after = normalized.slice(i).replace(/^\n+/, "");
  const eol = body.includes("\r\n") ? "\r\n" : "\n";
  return {rel, original, result: bom + `${before}\n\n${expected}\n\n${after}`.replace(/\n/g, eol), changed: true};
}
function makePlan(root) {
  const packagePath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (pkg.name !== "taskflow") throw new Error("不是 TaskFlow 專案根目錄");
  for (const rel of ["public/style.css", "public/index.html", "e2e/task-consistency.e2e.js"]) {
    if (!fs.existsSync(path.join(root, rel))) throw new Error(`缺少必要基準檔案：${rel}`);
  }
  return DOCS.map(rel => {
    const p = path.join(root, rel);
    if (!fs.statSync(p).isFile() || fs.lstatSync(p).isSymbolicLink()) throw new Error(`拒絕非一般檔案／符號連結：${rel}`);
    return planDoc(rel, fs.readFileSync(p, "utf8"));
  });
}
function run(root, {dryRun=false, verify=false}={}) {
  if (dryRun && verify) throw new Error("不可同時指定 --dry-run 與 --verify");
  const plans = makePlan(root);
  const changed = plans.filter(p => p.changed);
  if (verify && changed.length) throw new Error(`仍有 ${changed.length} 份文件未更新，驗證未通過`);
  if (dryRun || verify || !changed.length) return {plans, written:0, backup:null};
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9C34-docs-"));
  for (const p of changed) {
    const dest = path.join(backup, p.rel);
    fs.mkdirSync(path.dirname(dest), {recursive:true});
    fs.writeFileSync(dest, p.original, "utf8");
  }
  const touched = [];
  try {
    for (const p of changed) {
      const target = path.join(root, p.rel);
      const temp = `${target}.m9c34-tmp-${process.pid}`;
      try {
        fs.writeFileSync(temp, p.result, {encoding:"utf8", flag:"wx"});
        fs.renameSync(temp, target);
        touched.push(p);
      } finally {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
      }
    }
  } catch(e) {
    for (const p of touched.reverse()) fs.writeFileSync(path.join(root, p.rel), p.original, "utf8");
    throw e;
  }
  return {plans, written:changed.length, backup};
}
function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(x => !["--dry-run", "--verify"].includes(x))) throw new Error("使用方式：node scripts/close-m9c34-docs.js [--dry-run | --verify]");
  const dryRun = args[0] === "--dry-run", verify = args[0] === "--verify";
  const result = run(path.resolve(__dirname,".."), {dryRun, verify});
  for (const p of result.plans) console.log(`[${verify ? "已核對" : p.changed ? dryRun ? "預覽待更新" : "已更新" : "已存在，跳過"}] ${p.rel}`);
  if (result.backup) console.log(`原始檔案備份：${result.backup}`);
  console.log(verify ? "M9-C3/C4 六份文件標記驗證通過。" : dryRun ? "預覽完成：沒有改寫檔案。" : `M9-C3/C4 文件收斂完成（本次寫入 ${result.written} 份），尚未 Commit / Push。`);
}
if (require.main === module) {try { main(); } catch(e) { console.error(`M9-C3/C4 文件工具安全中止：${e.message}`);process.exitCode=1;}}
module.exports = {MARKER, START, END, DOCS, SECTIONS, planDoc, makePlan, run};
