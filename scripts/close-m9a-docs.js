/**
 * TaskFlow M9-A documentation closeout
 * Incrementally inserts six dated, idempotent, reviewable Markdown sections.
 * No database, Git, npm, server, or network actions.
 * Usage: node scripts/close-m9a-docs.js [--dry-run|--verify]
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const MARKER = "TASKFLOW-M9A-DOCS-2026-11-21";
const START = `<!-- ${MARKER} -->`;
const END = `<!-- /${MARKER} -->`;
const PREVIOUS = "TASKFLOW-M8-CLOSEOUT-2026-11-21";
const DOCS = [
  "README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md"
];

const SECTIONS = {
  "README.md": `## 最新開發狀態｜M9-A 專案統計儀表板（2026-11-21）

> 本節是目前最新進度快照；下方 M0～M8 文字保留為**歷史階段紀錄**。TaskFlow v1.0.0 尚未正式發布。

- **M0～M8：** 已完成 GitHub 階段結案；M8 Git 提交 \`b91c355\` 並與 \`origin/main\` 同步（依本機終端截圖，2026-11-21）。
- **M9-A：** 新增專案統計卡片與成員工作量摘要，透過現有 REST 所取得的任務／成員資料在前端運算，不新增 SQLite 表或更動既有 Kanban 排序 API。
- **統計內容：** 任務完成率、逾期未完成、高優先未完成、未指派未完成與負責人成員工作量；切換專案時依當前專案資料重新計算。
- **新增檔案：** \`public/task-analytics.js\`、\`public/task-analytics.css\`、\`scripts/apply-m9a.js\`、\`tests/task-analytics.test.js\`、\`e2e/task-analytics.e2e.js\`。
- **前端接線：** \`public/index.html\`、\`public/task-board.js\`；M6 拖放與 M8 Socket.IO／留言／活動整合維持原有設計。
- **本機已驗收（使用者提供的終端截圖）：** M9-A 專項 Node \`12/12 PASS\`、專項 Edge \`5/5 PASS\`、完整 Node \`282/282 PASS\`、既有 Edge \`52/52 PASS\`，各組均 0 失敗。專項和完整套件可能重複計數，不能當成彼此獨立的 351 項功能需求。
- **界線：** 此階段沒有新增統計後端 API、查詢索引或權限規則；統計的可見範圍跟隨現有已授權 REST 結果。未完成 M9-B 搜尋與多條件篩選、M9-C 整合驗收及 M10 部署／Release。
- **Git 狀態：** M9-A 文件更新與階段性 Commit／Push 尚未由本段自動宣告完成；仍須以最終 \`HEAD\`、\`origin/main\` 與暫存清單核對。

### M9-A 驗證指令

\`\`\`powershell
node --test .\\tests\\task-analytics.test.js
node --test .\\e2e\\task-analytics.e2e.js
npm test -- --test-concurrency=1
npm run test:e2e:all
\`\`\`

---`,
  "CHANGELOG.md": `### M9-A — 2026-11-21｜Dashboard Analytics

#### Added

- 新增 \`public/task-analytics.js\`：在既有專案／任務資料載入後計算完成率、逾期未完成、高優先未完成、未指派未完成與成員待辦工作量。
- 新增 \`public/task-analytics.css\`；透過 \`public/index.html\`、\`public/task-board.js\` 接線，顯示當前專案的統計摘要。
- 新增 \`scripts/apply-m9a.js\` 安全整合工具；提供 dry-run、原始檔備份及重複執行跳過。
- 新增 \`tests/task-analytics.test.js\` 與 \`e2e/task-analytics.e2e.js\`，驗證統計計算、切換專案及既有看板相容性。

#### Verified（依 2026-11-21 本機截圖）

- M9-A 專項 Node \`12/12 PASS\`；M9-A Edge 專項 \`5/5 PASS\`。
- 全套 Node \`282/282 PASS\`；原有 Edge \`52/52 PASS\`；以上各批均 \`fail 0\`。
- 專項可能包含在全套 Node 計數內，勿將結果加總成獨立測試需求數量。
- 整合工具首次將 \`public/index.html\`、\`public/task-board.js\` 更新，第二次 \`--dry-run\` 均顯示已更新、跳過；原始檔有備份。

#### Scope / Remaining

- Dashboard 使用既有已授權 REST 資料，未新增 SQLite migration、獨立後端統計 API 或正式部署環境。
- M9-B 搜尋／篩選、M9-C 整體 UX 與回歸、M10 部署／安全／Release 尚待完成。
- 本段不預先宣告 M9-A Git Commit／Push 成功；須另行核對 Git 證據。

---`,
  "docs/ARCHITECTURE.md": `## 最新架構快照｜M9-A Dashboard Analytics（2026-11-21）

> 本節描述 M9-A 已實作及依終端結果驗證的前端唯讀統計。下方 M0～M8 說明保留歷史時點，不應將舊「未實作」視為目前狀態。

### 資料流

\`\`\`text
已授權 Session → 現有 Project / Task / Member REST API → Task Board state
    → public/task-analytics.js（前端唯讀彙總）
    → public/index.html 的統計區塊 + public/task-analytics.css
\`\`\`

- 數據基於**目前選定專案**及既有 REST 返回的可見任務／成員資料；專案切換後重新計算、避免殘留上一專案統計。
- 統計項目包含完成率、逾期未完成、高優先未完成、未指派未完成與各成員工作量；不直接更新 \`tasks\`、\`task_comments\` 或 \`project_activity\`。
- \`public/index.html\` 與 \`public/task-board.js\` 採增量掛接，保留 M6 原生 HTML Drag & Drop、M7 即時同步、M8 留言／活動模組。
- 讀取權限仍由原有 Session／CSRF／RBAC 設計及既有 REST 決定；不應將前端統計視為新的伺服器授權機制。
- 本階段**未**增設資料庫 schema、migration、後端彙總端點或 Socket.IO 新事件。
- \`scripts/apply-m9a.js\` 為開發期掛接工具，不應作為正式伺服器執行流程。

### 仍待後續

- M9-B 搜尋、狀態／負責人／優先度等多條件篩選；M9-C UX 與整體整合驗收。
- M10 HTTPS、正式 Session／Cookie 設定、跨瀏覽器、壓測、安全稽核、部署與 GitHub Release。

---`,
  "docs/DEVELOPMENT_LOG.md": `## 2026-11-21｜M9-A 專案統計儀表板開發紀錄

### 交付內容

- 基於 M8 已結案版本 \`b91c355\` 開始 M9-A；沒有重新初始化正式 \`data/taskflow.db\`。
- 加入 \`public/task-analytics.js\`、\`public/task-analytics.css\`，以既有 REST 任務及成員資料產生目前專案的 KPI 與工作量摘要。
- 利用 \`scripts/apply-m9a.js\` 增量掛接到 \`public/index.html\`、\`public/task-board.js\`，先預覽再正式套用。執行完成後有原始檔備份，再次 dry-run 顯示已更新、跳過（idempotent）。
- 新增 \`tests/task-analytics.test.js\` 與 \`e2e/task-analytics.e2e.js\`。

### 驗證紀錄（本機終端截圖）

1. 五個新增檔案 \`Test-Path\` 均 \`True\`，新增 JavaScript 的語法檢查沒有錯誤。
2. M9-A 統計模組測試 **12/12 PASS**。
3. M9-A Microsoft Edge 專項 **5/5 PASS**，包括跨專案統計隔離與原 Kanban 相容性。
4. Node 全套 **282/282 PASS**，原有 Edge 全套 **52/52 PASS**，0 failed／skipped。
5. \`git diff --stat\` 首次顯示 \`public/index.html\` 和 \`public/task-board.js\` 兩個已追蹤修改檔案；五份新增檔案為未追蹤，故不包含於該統計。LF/CRLF 訊息是換行提醒。

### 開發決策與後續

- 不因統計儀表板改動 SQLite、權限判斷或既有 Move API；先以最小侵入範圍交付。
- 保留三份 M8 測試／診斷 TXT 在 Git 暫存範圍之外。
- 文件、Git staged 審查與本次 M9-A Commit／Push 尚待透過實際終端驗證，不在記錄中預填結果。
- 下一階段 M9-B 搜尋與篩選；M9-C UX／整合驗收；M10 正式部署及 Release。

---`,
  "docs/PROJECT_PLAN.md": `## 最新里程碑狀態｜M9-A（2026-11-21）

> **當前狀態快照：** M0～M8 已完成並同步 GitHub；M9-A 的既定功能與自動化測試通過，文件與 Git 結案尚待驗證。下方舊里程碑段落為歷史時點。v1.0.0 未正式發布。

| 階段 | 當前狀態 | 證據／剩餘工作 |
| --- | --- | --- |
| M0～M8 | 已完成階段結案 | M8 \`b91c355\` 對齊 \`origin/main\`（本機截圖） |
| M9-A｜Dashboard Analytics | 功能／專項／回歸已通過 | 12 Node、5 Edge；全套 282 Node、52 既有 Edge，均 0 失敗 |
| M9-A｜六份文件與 Git | 執行中 | 文件更新、暫存檢查、排除 TXT、Commit／Push、HEAD 比對 |
| M9-B｜搜尋與多條件篩選 | 尚未開始 | 搜尋文字、狀態、負責人、優先度；實作後專項／Edge 驗收 |
| M9-C｜UX 與整合 | 尚未開始 | 篩選／統計／看板／即時同步整體回歸 |
| M10｜部署／發布 | 尚未開始 | HTTPS、安全、跨瀏覽器、壓測、資料備份及 Release |

### M9-A 結案查核

- [x] 檔案存在、語法通過、掛接 dry-run／正式更新／重複 dry-run 正常。
- [x] 專項 12/12 Node、5/5 Edge；完整 282/282 Node、既有 52/52 Edge。
- [ ] 六份文件完成更新，並以 dry-run 檢查重複執行不改寫。
- [ ] 核對所有新增檔案與六份文件的 staged 清單，排除三份 TXT 與敏感資料。
- [ ] \`git diff --cached --check\` 為 0，確保沒有非預期修改。
- [ ] M9-A Git Commit／Push，並比對 \`HEAD\`、\`origin/main\` 與工作樹。

**進度統計：** 此處不把通過的測試次數視為程式碼覆蓋率或安全保證。

---`,
  "docs/TESTING.md": `## 最新測試快照｜M9-A Dashboard Analytics（2026-11-21）

> 來源：使用者提供的本機 PowerShell 截圖。這些是 M9-A 當次驗收紀錄，與下方 M0～M8 歷史結果區分；未執行 M10 的部署／安全專項。

| 測試程序 | 終端機確認 | 結果 |
| --- | --- | --- |
| \`node --test .\\tests\\task-analytics.test.js\` | 12 tests／12 pass | 0 fail、0 skipped |
| \`node --test .\\e2e\\task-analytics.e2e.js\` | 5 tests／5 pass | 0 fail、0 skipped |
| \`npm test -- --test-concurrency=1\` | 282 tests／282 pass | 0 fail、0 skipped |
| \`npm run test:e2e:all\` | 52 tests／52 pass | 0 fail、0 skipped |

- 專項測試與完整套件可重疊，不把數量簡單相加當成獨立測試案例數。
- 檔案存在、語法檢查通過；整合腳本更新兩個已追蹤檔案，再執行 dry-run 均判定已更新、跳過。
- Edge 專項涵蓋統計計算、切換／清除專案的資料隔離，並確認 M6 Kanban 相容性。
- \`git diff --stat\` 只統計已追蹤檔案，不包含新建的 M9-A CSS／JS／測試檔。git 格式驗收應於 staged 後再檢查。
- 本階段通過不等於正式 HTTPS、完整安全稽核、跨瀏覽器、效能及正式 Release 均通過。

### M9-A 回歸指令

\`\`\`powershell
node --test .\\tests\\task-analytics.test.js
node --test .\\e2e\\task-analytics.e2e.js
npm test -- --test-concurrency=1
npm run test:e2e:all
\`\`\`

---`
};
// Unescape code fences and markdown backticks from literal representations.
for (const key of Object.keys(SECTIONS)) SECTIONS[key] = SECTIONS[key].replace(/\\`/g, "`");

function getEol(text) { return text.includes("\r\n") ? "\r\n" : "\n"; }
function restoreEol(text, eol) { return text.replace(/\r\n|\r|\n/g, eol); }
function planDoc(relative, original) {
  if (!DOCS.includes(relative)) throw new Error(`非允許文件：${relative}`);
  const bom = original.charCodeAt(0) === 0xFEFF ? "\ufeff" : "";
  const content = bom ? original.slice(1) : original;
  if (!content.includes(PREVIOUS)) throw new Error(`${relative}：缺少 M8 結案錨點，為避免錯誤修改已中止`);
  const a = content.indexOf(START), b = content.indexOf(END);
  if ((a >= 0) !== (b >= 0)) throw new Error(`${relative}：M9-A 起訖標記不成對，需人工檢查`);
  if (a >= 0) {
    if (b <= a || content.indexOf(START, a + 1) >= 0 || content.indexOf(END, b + 1) >= 0) {
      throw new Error(`${relative}：M9-A 標記順序錯誤或重複`);
    }
    return { changed: false, result: original };
  }
  const eol = getEol(content);
  const block = restoreEol(`${START}\n\n${SECTIONS[relative].trim()}\n\n${END}`, eol);
  let pos;
  if (relative === "CHANGELOG.md") {
    const match = /^## \[Unreleased\][^\r\n]*$/m.exec(content);
    if (!match) throw new Error(`${relative}：找不到 Unreleased 區段`);
    pos = match.index + match[0].length;
  } else {
    const match = /^# TaskFlow[^\r\n]*$/m.exec(content);
    if (!match || match.index !== 0) throw new Error(`${relative}：首行應為 TaskFlow H1 標題`);
    pos = match[0].length;
  }
  const result = bom + content.slice(0, pos) + eol + eol + block + eol + eol + content.slice(pos).replace(/^(?:\r?\n)+/, "");
  return { changed: true, result };
}
function makePlan(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.name !== "taskflow") throw new Error("不是 TaskFlow 專案根目錄");
  return DOCS.map(rel => {
    const abs = path.join(root, ...rel.split("/"));
    const old = fs.readFileSync(abs, "utf8");
    return { rel, abs, old, ...planDoc(rel, old) };
  });
}
function apply(root, options = {}) {
  const dryRun = options.dryRun === true;
  const verify = options.verify === true;
  const plans = makePlan(root);
  if (verify) {
    const incomplete = plans.filter(p => p.changed);
    if (incomplete.length) throw new Error(`仍有 ${incomplete.length} 份文件未套用 M9-A 文件區塊`);
    return { plans, written: 0, backup: null };
  }
  const changed = plans.filter(p => p.changed);
  if (dryRun || changed.length === 0) return { plans, written: 0, backup: null };
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9A-docs-"));
  for (const p of changed) {
    const dst = path.join(backup, ...p.rel.split("/"));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(p.abs, dst);
  }
  const touched = [];
  try {
    for (const p of changed) {
      const temp = `${p.abs}.m9a-tmp-${process.pid}`;
      try {
        fs.writeFileSync(temp, p.result, { encoding: "utf8", flag: "wx" });
        fs.renameSync(temp, p.abs);
        touched.push(p);
      } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    }
  } catch (error) {
    for (const p of touched.reverse()) {
      const original = path.join(backup, ...p.rel.split("/"));
      try { fs.copyFileSync(original, p.abs); } catch (rollbackError) { console.error(`無法還原 ${p.rel}: ${rollbackError.message}`); }
    }
    throw error;
  }
  return { plans, written: changed.length, backup };
}
function cli() {
  const args = process.argv.slice(2);
  const options = new Set(args);
  if (args.some(a => a !== "--dry-run" && a !== "--verify") || args.length !== options.size || options.size > 1) {
    console.error("使用方式：node scripts/close-m9a-docs.js [--dry-run | --verify]");
    process.exitCode = 2; return;
  }
  const dryRun = options.has("--dry-run");
  const verify = options.has("--verify");
  const { plans, backup } = apply(path.resolve(__dirname, ".."), { dryRun, verify });
  for (const p of plans) {
    const action = verify ? "已核對" : !p.changed ? "已更新，跳過" : dryRun ? "預覽待更新" : "已更新";
    console.log(`[${action}] ${p.rel}`);
  }
  if (backup) console.log(`六份文件原始備份位置：${backup}`);
  console.log(verify ? "M9-A 六份文件標記驗證通過。" : dryRun ? "預覽完成；未寫入任何文件。" : "M9-A 文件更新步驟完成；尚未進行 Git Commit／Push。");
}
if (require.main === module) {
  try { cli(); } catch (error) { console.error(`M9-A 文件工具中止：${error.message}`); process.exitCode = 1; }
}
module.exports = { DOCS, MARKER, START, END, planDoc, makePlan, apply };
