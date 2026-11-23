"use strict";

// TaskFlow M9-C1: Kanban UX (loading, retry, empty states).
// Incremental, idempotent and recoverable. No SQLite, APIs, Git or network actions.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HTML_BEGIN = "<!-- TASKFLOW-M9C1-BEGIN -->";
const HTML_END = "<!-- /TASKFLOW-M9C1-END -->";
const JS_BEGIN = "// TASKFLOW-M9C1-BEGIN";
const JS_END = "// TASKFLOW-M9C1-END";

function exactlyOnce(input, needle, context) {
  const count = input.split(needle).length - 1;
  if (count !== 1) throw new Error(`${context}: expected exactly one anchor, got ${count}; no files changed`);
}
function replaceOne(input, needle, replacement, context) {
  exactlyOnce(input, needle, context);
  return input.replace(needle, replacement);
}

const UX_CSS = `/* TaskFlow M9-C1: non-destructive board loading, retry and empty states. */
#task-ux-loading[hidden], #task-ux-retry[hidden],
#task-board-empty[hidden] { display: none !important; }
.tf-ux-loading {
  display: grid;
  gap: 9px;
  margin: 8px 0 18px;
  padding: 13px 15px;
  border: 1px solid #354460;
  border-radius: 11px;
  background: #17223b;
}
.tf-ux-loading .tf-ux-bar {
  display: block;
  height: 9px;
  border-radius: 6px;
  background: linear-gradient(100deg, #283957 20%, #425779 45%, #283957 70%);
  background-size: 200% 100%;
  animation: tf-ux-shimmer 1.6s ease-in-out infinite;
}
.tf-ux-loading .tf-ux-bar:nth-child(1) { width: 74%; }
.tf-ux-loading .tf-ux-bar:nth-child(2) { width: 52%; }
.tf-ux-loading .tf-ux-bar:nth-child(3) { width: 65%; }
.tf-ux-retry { margin: 0 0 18px; }
.tf-ux-retry button {
  cursor: pointer;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #ba7892;
  color: #fff;
  background: #58324a;
  font: inherit;
}
.tf-ux-retry button:hover { background: #704159; }
.tf-board-empty, .tf-column-empty {
  padding: 17px;
  border: 1px dashed #526584;
  border-radius: 10px;
  background: #192740;
  color: #c8d5ed;
  font-size: 13px;
  line-height: 1.7;
}
.tf-board-empty { margin: 12px 0 16px; }
.tf-column-empty { margin: 6px 0; }
@keyframes tf-ux-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .tf-ux-loading .tf-ux-bar { animation: none; }
}
`;

const UX_HTML = `            ${HTML_BEGIN}
            <div id="task-ux-loading" class="tf-ux-loading" aria-hidden="true" hidden>
              <span class="tf-ux-bar"></span>
              <span class="tf-ux-bar"></span>
              <span class="tf-ux-bar"></span>
            </div>
            <div id="task-ux-retry" class="tf-ux-retry" hidden>
              <button id="task-ux-retry-button" type="button">重新嘗試載入任務</button>
            </div>
            ${HTML_END}
`;

const JS_HELPERS = `  ${JS_BEGIN}
  // Loading indicator is decorative; task-message remains the live status region.
  function setUxLoading(value) {
    state.loading = Boolean(value);
    el("task-ux-loading").hidden = !state.loading;
    document.querySelector(".board-section")?.setAttribute(
      "aria-busy", String(state.loading),
    );
  }

  function setUxRetry(value) {
    state.loadError = Boolean(value);
    el("task-ux-retry").hidden = !state.loadError;
  }
  ${JS_END}
`;

function patchHtml(source) {
  const text = source.replace(/\r\n/g, "\n");
  const beginCount = text.split(HTML_BEGIN).length - 1;
  const endCount = text.split(HTML_END).length - 1;
  if (beginCount || endCount) {
    if (beginCount !== 1 || endCount !== 1 ||
        !text.includes('href="/task-ux.css"') ||
        !text.includes('id="task-board-empty"') ||
        !text.includes('id="task-ux-retry-button"')) {
      throw new Error("M9-C1 HTML markers are incomplete; no files changed");
    }
    return { content: source, changed: false };
  }
  let out = text;
  out = replaceOne(out,
    '    <link rel="stylesheet" href="/task-board.css" />',
    '    <link rel="stylesheet" href="/task-ux.css" />\n    <link rel="stylesheet" href="/task-board.css" />',
    "board stylesheet");
  const messageAnchor = `            <p
              id="task-message"
              class="tf-message"
              role="status"
              aria-live="polite"
            >
              正在確認任務資料…
            </p>
`;
  out = replaceOne(out, messageAnchor, messageAnchor + UX_HTML, "task status message");
  out = replaceOne(out,
    '              <div class="kanban-board">',
    `              <p id="task-board-empty" class="tf-board-empty" hidden>此專案還沒有任務。可在上方建立第一筆任務，或切換至其他專案。</p>\n              <div class="kanban-board">`,
    "Kanban board");
  return { content: source.includes("\r\n") ? out.replace(/\n/g, "\r\n") : out, changed: true };
}

function patchBoard(source) {
  const text = source.replace(/\r\n/g, "\n");
  const beginCount = text.split(JS_BEGIN).length - 1;
  const endCount = text.split(JS_END).length - 1;
  if (beginCount || endCount) {
    if (beginCount !== 1 || endCount !== 1 ||
        !text.includes("setUxLoading(Boolean(currentId))") ||
        !text.includes('el("task-board-empty").hidden') ||
        !text.includes('el("task-ux-retry-button").addEventListener')) {
      throw new Error("M9-C1 board markers are incomplete; no files changed");
    }
    return { content: source, changed: false };
  }
  let out = text;
  out = replaceOne(out, '    requestId: 0,\n    dragging: null,',
    '    requestId: 0,\n    loading: false,\n    loadError: false,\n    dragging: null,', "state fields");
  const noticeAnchor = `  function notice(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }
`;
  out = replaceOne(out, noticeAnchor, noticeAnchor + "\n" + JS_HELPERS, "notice helper");
  out = replaceOne(out,
    '    for (const [column, backendStatus] of Object.entries(columnStatus)) {',
    `    el("task-board-empty").hidden =
      !state.project || state.loading || allTasks.length !== 0;

    for (const [column, backendStatus] of Object.entries(columnStatus)) {`,
    "render columns");
  const cardAnchor = `      section
        .querySelector(".task-list")
        .replaceChildren(...filtered.map(makeCard));`;
  const cardReplacement = `      const cards = filtered.map(makeCard);
      // Empty-column hints are for views with at least one visible task.
      if (state.project && tasks.length > 0 && filtered.length === 0) {
        const hint = document.createElement("p");
        hint.className = "tf-column-empty";
        hint.textContent = filtering
          ? "此欄沒有符合目前篩選條件的任務。"
          : "此欄目前沒有任務。";
        cards.push(hint);
      }
      section.querySelector(".task-list").replaceChildren(...cards);`;
  out = replaceOne(out, cardAnchor, cardReplacement, "render cards");
  out = replaceOne(out, '    const requestId = ++state.requestId;\n    // M9-B3',
    '    const requestId = ++state.requestId;\n    setUxRetry(false);\n    setUxLoading(Boolean(currentId));\n    // M9-B3', "refresh start");
  const afterLoaded = `      state.project = projectData.project;
      state.members = memberData.members;
      state.tasks = taskData.tasks;
      render();`;
  out = replaceOne(out, afterLoaded,
    `      state.project = projectData.project;
      state.members = memberData.members;
      state.tasks = taskData.tasks;
      setUxLoading(false);
      render();`, "refresh success");
  const afterFailed = `      state.project = null;
      state.members = [];
      state.tasks = [];
      render();
      if (error.status !== 401) notice(error.message, true);`;
  out = replaceOne(out, afterFailed,
    `      state.project = null;
      state.members = [];
      state.tasks = [];
      setUxLoading(false);
      setUxRetry(error.status !== 401);
      render();
      if (error.status !== 401) notice(error.message, true);`, "refresh failure");
  const refreshButton = `  el("task-refresh").addEventListener("click", () => {`;
  out = replaceOne(out, refreshButton,
    `  el("task-ux-retry-button").addEventListener("click", () => {
    if (!state.busy) void refresh();
  });

` + refreshButton, "retry control");
  const revocation = `      state.tasks = [];
      selector.value = "";
      state.filterProjectId = "";`;
  out = replaceOne(out, revocation,
    `      state.tasks = [];
      setUxLoading(false);
      setUxRetry(false);
      selector.value = "";
      state.filterProjectId = "";`, "revocation UI reset");
  return { content: source.includes("\r\n") ? out.replace(/\n/g, "\r\n") : out, changed: true };
}

function makePlans(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.name !== "taskflow") throw new Error("Not a TaskFlow root: package.json name mismatch");
  const plans = [
    { rel: "public/index.html", fn: patchHtml },
    { rel: "public/task-board.js", fn: patchBoard },
    { rel: "public/task-ux.css", css: true },
  ];
  const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
  const board = fs.readFileSync(path.join(root, "public/task-board.js"), "utf8");
  if (!html.includes('id="task-filter-panel"') || !board.includes("TASKFLOW-M9B2-BEGIN")) {
    throw new Error("Expected M9-B branch is missing; no files changed");
  }
  return plans.map(p => {
    const abs = path.join(root, ...p.rel.split("/"));
    const exists = fs.existsSync(abs);
    if (p.css && exists) {
      const old = fs.readFileSync(abs, "utf8");
      if (old !== UX_CSS) throw new Error(`${p.rel} already exists with different content; no files changed`);
      return { ...p, abs, exists, old, content: old, changed: false };
    }
    const old = exists ? fs.readFileSync(abs, "utf8") : null;
    const output = p.css ? { content: UX_CSS, changed: true } : p.fn(old);
    return { ...p, abs, exists, old, ...output };
  });
}

function run({ root = path.resolve(__dirname, ".."), dryRun = false, verify = false, quiet = false } = {}) {
  const plans = makePlans(root);
  if (verify && plans.some(p => p.changed)) throw new Error("M9-C1 integration is not fully installed");
  if (!quiet) for (const p of plans) console.log(`[${verify ? "驗證" : dryRun ? "預覽" : "檢查"}] ${p.rel}: ${p.changed ? "需要更新" : "已是最新"}`);
  const changed = plans.filter(p => p.changed);
  if (verify || dryRun || changed.length === 0) {
    if (!quiet) console.log(verify ? "M9-C1 檔案標記驗證通過。" : "沒有改寫檔案。");
    return { changed: changed.length, written: 0, backup: null };
  }
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9C1-backup-"));
  for (const p of changed.filter(p => p.exists)) {
    const dst = path.join(backup, ...p.rel.split("/"));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(p.abs, dst);
  }
  const written = [];
  try {
    for (const p of changed) {
      fs.writeFileSync(p.abs, p.content, "utf8");
      written.push(p);
      if (!quiet) console.log(`[已更新] ${p.rel}`);
    }
  } catch (error) {
    for (const p of written.reverse()) {
      if (p.exists) fs.writeFileSync(p.abs, p.old, "utf8");
      else fs.rmSync(p.abs, { force: true });
    }
    throw error;
  }
  if (!quiet) console.log(`M9-C1 整合完成。原始檔備份：${backup}\n尚未 Commit/Push。請執行專項與 Edge E2E。`);
  return { changed: changed.length, written: changed.length, backup };
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--dry-run", "--verify"].includes(arg)) || args.length > 1) {
    throw new Error("Usage: node scripts/apply-m9c1.js [--dry-run|--verify]");
  }
  run({ dryRun: args.includes("--dry-run"), verify: args.includes("--verify") });
}
if (require.main === module) {
  try { main(); } catch (error) { console.error("M9-C1 安全中止：", error.message); process.exitCode = 1; }
}
module.exports = { UX_CSS, patchHtml, patchBoard, makePlans, run };
