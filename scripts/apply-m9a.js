"use strict";

// M9-A：僅把統計前端掛接到已存在的 TaskFlow。可預覽、備份、重入。
// 禁止觸碰 SQLite / server / package / Git；遇到不認識的檔案版本即拒絕改寫。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const HTML_MARK = "<!-- TASKFLOW-M9A-BEGIN -->";
const JS_MARK = "// TASKFLOW-M9A-BEGIN";

const HTML_SECTION = `            <!-- TASKFLOW-M9A-BEGIN -->
            <section id="m9-analytics" class="tf-analytics" aria-labelledby="m9-analytics-title">
              <h2 id="m9-analytics-title">專案統計總覽</h2>
              <p id="m9-analytics-scope" class="tf-analytics-scope" role="status" aria-live="polite">請先選擇專案。</p>
              <div class="tf-analytics-grid">
                <article class="tf-analytics-metric">
                  <span>任務完成率</span><strong id="m9-rate">0%</strong>
                  <small id="m9-rate-detail">已完成 0 / 共 0 筆</small>
                </article>
                <article class="tf-analytics-metric">
                  <span>逾期未完成</span><strong id="m9-overdue">0</strong>
                  <small id="m9-due-today">今日到期 0 筆</small>
                </article>
                <article class="tf-analytics-metric">
                  <span>高優先未完成</span><strong id="m9-high">0</strong>
                  <small>僅計算待處理／進行中</small>
                </article>
                <article class="tf-analytics-metric">
                  <span>未指派未完成</span><strong id="m9-unassigned">0</strong>
                  <small>包含已離開專案的負責人</small>
                </article>
              </div>
              <h3>成員待辦工作量（未完成任務）</h3>
              <ul id="m9-workload-list" class="tf-analytics-list" aria-label="成員未完成任務分布"></ul>
              <p id="m9-workload-remaining" class="tf-analytics-remaining"></p>
            </section>
            <!-- /TASKFLOW-M9A-END -->

`;
const MOUNT_JS = `    // TASKFLOW-M9A-BEGIN：統計僅根據已驗證的目前專案 REST 清單。
    window.TaskAnalytics?.render(state.tasks, state.members, state.project);
    // TASKFLOW-M9A-END
`;

function exactlyOnce(content, token, label) {
  const count = content.split(token).length - 1;
  if (count !== 1) throw new Error(`${label} 的定位點數量應為 1，實際 ${count}。已停止，未覆寫檔案。`);
}

function insertOnce(text, token, content, label) {
  exactlyOnce(text, token, label);
  return text.replace(token, content + token);
}

function patchHtml(source) {
  if (source.includes(HTML_MARK)) {
    if (!source.includes("<!-- /TASKFLOW-M9A-END -->") ||
        !source.includes('href="/task-analytics.css"') ||
        !source.includes('src="/task-analytics.js"')) {
      throw new Error("M9-A HTML 標記不完整，請手動核對；未覆寫。");
    }
    return { content: source, changed: false };
  }
  let text = source;
  text = insertOnce(text,
    '    <script src="/task-board.js" defer></script>',
    '    <script src="/task-analytics.js" defer></script>\n', "TaskBoard script");
  text = insertOnce(text,
    '    <link rel="stylesheet" href="/task-board.css" />',
    '    <link rel="stylesheet" href="/task-analytics.css" />\n', "TaskBoard CSS");
  text = insertOnce(text,
    '            <section class="board-section" aria-label="正式 Kanban 看板">',
    HTML_SECTION, "Kanban board section");

  const oldNav = '          <div class="nav-item">\n            <span>◫</span><span>統計總覽</span><small>規劃中</small>\n          </div>';
  const newNav = '          <a class="nav-item" href="#m9-analytics-title">\n            <span>◫</span><span>統計總覽</span>\n          </a>';
  exactlyOnce(text, oldNav, "M9 統計導覽");
  text = text.replace(oldNav, newNav);
  return { content: text, changed: true };
}

function patchBoard(source) {
  if (source.includes(JS_MARK)) {
    if (!source.includes("// TASKFLOW-M9A-END") ||
        !source.includes("window.TaskAnalytics?.render(state.tasks, state.members, state.project)")) {
      throw new Error("M9-A JS 標記不完整，請手動核對；未覆寫。");
    }
    return { content: source, changed: false };
  }
  const anchor = `    el("done-count").textContent = String(
      tasks.filter((x) => x.status === "done").length,
    );
`;
  exactlyOnce(source, anchor, "正式統計更新節點");
  return { content: source.replace(anchor, anchor + MOUNT_JS), changed: true };
}

function run({ root = path.resolve(__dirname, ".."), dryRun = false, quiet = false } = {}) {
  const fileNames = ["public/index.html", "public/task-board.js"];
  for (const name of ["public/task-analytics.js", "public/task-analytics.css"]) {
    if (!fs.existsSync(path.join(root, name))) throw new Error(`缺少 ${name}，先合併 ZIP。`);
  }

  const plans = fileNames.map((name, i) => {
    const filename = path.join(root, name);
    const original = fs.readFileSync(filename, "utf8");
    const crlf = original.includes("\r\n");
    const normalized = original.replace(/\r\n/g, "\n");
    const output = i === 0 ? patchHtml(normalized) : patchBoard(normalized);
    return { name, filename, original,
      content: crlf ? output.content.replace(/\n/g, "\r\n") : output.content,
      changed: output.changed };
  });

  const changed = plans.filter((plan) => plan.changed);
  if (!quiet) {
    for (const plan of plans) {
      console.log(`[${dryRun ? "預覽" : "檢查"}] ${plan.name}: ${plan.changed ? "需要更新" : "已更新，跳過"}`);
    }
  }
  if (dryRun || changed.length === 0) {
    if (!quiet) console.log(`${dryRun ? "Dry run 完成；沒有改寫任何檔案。" : "已完成；沒有重複改寫。"}`);
    return { changed: changed.length, backupDir: null };
  }

  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9A-backup-"));
  for (const plan of changed) {
    const backup = path.join(backupDir, plan.name);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(plan.filename, backup);
  }
  try {
    for (const plan of changed) {
      fs.writeFileSync(plan.filename, plan.content, "utf8");
      if (!quiet) console.log(`[更新] ${plan.name}`);
    }
  } catch (error) {
    for (const plan of changed) {
      const backup = path.join(backupDir, plan.name);
      if (fs.existsSync(backup)) fs.copyFileSync(backup, plan.filename);
    }
    throw error;
  }
  if (!quiet) {
    console.log(`M9-A 前端整合完成。原始檔案備份：${backupDir}`);
    console.log("尚未 Commit/Push；請執行 M9-A 專項、既有回歸與 Edge E2E。");
  }
  return { changed: changed.length, backupDir };
}

module.exports = { patchHtml, patchBoard, run };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run")) {
    console.error("只允許 --dry-run 參數。");
    process.exitCode = 2;
  } else {
    try { run({ dryRun: args.includes("--dry-run") }); }
    catch (error) { console.error("M9-A 安全中止：", error.message); process.exitCode = 1; }
  }
}
