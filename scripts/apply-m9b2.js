"use strict";

// TaskFlow M9-B2: safe, idempotent Kanban filter integration.
// Does not touch SQLite, server routes, git, or the user's original task-filters.js.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HTML_MARK = "<!-- TASKFLOW-M9B2-BEGIN -->";
const JS_MARK = "// TASKFLOW-M9B2-BEGIN";
const CSS = `/* TaskFlow M9-B2: filter controls, isolated from Kanban and analytics layout. */
.tf-filter-panel {
  margin: 18px 0 14px;
  padding: 18px;
  border: 1px solid #374967;
  background: #17223b;
  border-radius: 12px;
  color: #edf3ff;
}
.tf-filter-panel[hidden], .tf-filter-panel [hidden] { display: none !important; }
.tf-filter-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.tf-filter-field { display: flex; flex-direction: column; min-width: 0; gap: 7px; }
.tf-filter-field label { font-size: 12px; color: #c7d6f0; }
.tf-filter-field input, .tf-filter-field select {
  width: 100%; min-width: 0; box-sizing: border-box;
  padding: 10px 12px; background: #0c1527; color: #f1f4ff;
  border: 1px solid #455674; border-radius: 8px; font: inherit;
}
.tf-filter-footer { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
.tf-filter-footer button {
  cursor: pointer; border: 1px solid #66759e; background: #2b3854;
  color: #f1f4ff; border-radius: 8px; padding: 9px 13px; font: inherit;
}
.tf-filter-count { margin: 0; font-size: 13px; color: #d1ddf3; }
.tf-filter-hint { margin: 10px 0 0; color: #f5ce96; font-size: 12px; line-height: 1.6; }
.tf-filter-empty { color: #becde7; padding: 8px 0 14px; }
@media (max-width: 900px) { .tf-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .tf-filter-grid { grid-template-columns: 1fr; } }
`;

const HTML_SECTION = `              <!-- TASKFLOW-M9B2-BEGIN -->
              <section id="task-filter-panel" class="tf-filter-panel" aria-label="任務搜尋與篩選" hidden>
                <div class="tf-filter-grid">
                  <div class="tf-filter-field">
                    <label for="task-filter-keyword">搜尋任務標題／描述</label>
                    <input type="search" id="task-filter-keyword" placeholder="輸入關鍵字" maxlength="120" autocomplete="off" />
                  </div>
                  <div class="tf-filter-field">
                    <label for="task-filter-status">任務狀態</label>
                    <select id="task-filter-status">
                      <option value="">全部狀態</option>
                      <option value="todo">待處理</option>
                      <option value="in_progress">進行中</option>
                      <option value="done">已完成</option>
                    </select>
                  </div>
                  <div class="tf-filter-field">
                    <label for="task-filter-priority">優先度</label>
                    <select id="task-filter-priority">
                      <option value="">全部優先度</option>
                      <option value="high">高優先</option>
                      <option value="medium">中優先</option>
                      <option value="low">低優先</option>
                    </select>
                  </div>
                  <div class="tf-filter-field">
                    <label for="task-filter-assignee">負責人</label>
                    <select id="task-filter-assignee">
                      <option value="">所有負責人</option>
                      <option value="unassigned">未指派</option>
                    </select>
                  </div>
                </div>
                <div class="tf-filter-footer">
                  <button type="button" id="task-filter-reset">清除篩選</button>
                  <p id="task-filter-count" class="tf-filter-count" role="status" aria-live="polite">顯示 0 / 0 筆任務</p>
                </div>
                <p id="task-filter-hint" class="tf-filter-hint" hidden>篩選期間暫停卡片拖曳、上下移動與快速狀態切換；清除篩選即可恢復。</p>
              </section>
              <p id="task-filter-empty" class="tf-filter-empty" role="status" hidden>沒有符合條件的任務，請調整或清除篩選。</p>
              <!-- /TASKFLOW-M9B2-END -->
`;

const BOARD_HELPERS = `  // TASKFLOW-M9B2-BEGIN: filters live only in the view; canonical state.tasks remains untouched.
  const filterControlIds = [
    "task-filter-keyword", "task-filter-status", "task-filter-priority", "task-filter-assignee",
  ];

  function readFilters() {
    return {
      keyword: el("task-filter-keyword")?.value ?? "",
      status: el("task-filter-status")?.value ?? "",
      priority: el("task-filter-priority")?.value ?? "",
      assignee: el("task-filter-assignee")?.value ?? "",
    };
  }

  function filtersActive() {
    return Object.values(readFilters()).some((value) => value.trim() !== "");
  }

  function clearFilterControls() {
    for (const id of filterControlIds) {
      const control = el(id);
      if (control) control.value = "";
    }
  }

  function renderFilterAssignees() {
    const select = el("task-filter-assignee");
    // During refresh, the old project is temporarily cleared. Preserve the selected member.
    if (!select || !state.project) return;
    const previous = select.value;
    const seen = new Set();
    const choices = [["", "所有負責人"], ["unassigned", "未指派"]];
    for (const member of state.members) {
      if (!Number.isSafeInteger(member.userId) || member.userId <= 0 || seen.has(member.userId)) continue;
      seen.add(member.userId);
      choices.push([String(member.userId), member.displayName || member.email || \`使用者 \${member.userId}\`]);
    }
    const options = choices.map(([value, label]) => {
      const item = document.createElement("option");
      item.value = value;
      item.textContent = label;
      return item;
    });
    select.replaceChildren(...options);
    select.value = choices.some(([value]) => value === previous) ? previous : "";
  }
  // TASKFLOW-M9B2-END

`;

const LISTENERS = `  // TASKFLOW-M9B2-BEGIN: re-render only; never fetch or alter SQLite on input.
  for (const id of filterControlIds) {
    el(id).addEventListener(id === "task-filter-keyword" ? "input" : "change", () => {
      if (!state.busy && state.project) render();
    });
  }
  el("task-filter-reset").addEventListener("click", () => {
    if (state.busy) return;
    clearFilterControls();
    render();
  });
  // TASKFLOW-M9B2-END

`;

function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}. No files changed.`);
  return text.replace(from, to);
}

function patchHtml(input) {
  if (input.includes(HTML_MARK)) {
    if (!input.includes("<!-- /TASKFLOW-M9B2-END -->") ||
        !input.includes('src="/task-filters.js"') ||
        !input.includes('href="/task-filters.css"')) {
      throw new Error("Incomplete M9-B2 HTML markers; refused to modify.");
    }
    return { content: input, changed: false };
  }
  let output = input;
  const jsAnchor = '    <script src="/task-board.js" defer></script>';
  output = replaceOnce(output, jsAnchor,
    '    <script src="/task-filters.js" defer></script>\n' + jsAnchor, "filter JS mount");
  const cssAnchor = '    <link rel="stylesheet" href="/task-board.css" />';
  output = replaceOnce(output, cssAnchor,
    '    <link rel="stylesheet" href="/task-filters.css" />\n' + cssAnchor, "filter CSS mount");
  const boardAnchor = '              <div class="kanban-board">';
  output = replaceOnce(output, boardAnchor, HTML_SECTION + boardAnchor, "filter toolbar");
  return { content: output, changed: true };
}

function patchBoard(input) {
  if (input.includes(JS_MARK)) {
    if (!input.includes("// TASKFLOW-M9B2-END") ||
        !input.includes('window.TaskFilters.filterTasks(') ||
        !input.includes('filterProjectId')) {
      throw new Error("Incomplete M9-B2 board markers; refused to modify.");
    }
    return { content: input, changed: false };
  }
  let output = input;
  output = replaceOnce(output,
    '    dragging: null,\n  };',
    '    dragging: null,\n    filterProjectId: null,\n  };', "filter project ID");
  output = replaceOnce(output, '  const dragHelp = document.createElement("p");',
    BOARD_HELPERS + '  const dragHelp = document.createElement("p");', "filter helpers");
  output = replaceOnce(output,
    '    return Boolean(isManager() && canWrite() && !state.busy && state.csrf);',
    '    return Boolean(isManager() && canWrite() && !state.busy && state.csrf && !filtersActive());',
    "disable filtered drag");
  output = replaceOnce(output,
    `        const withinColumn = columnTasks(task.status);
        const index = withinColumn.findIndex((item) => item.id === task.id);
        if (index > 0) {
          actions.append(button("上移", () => moveTask(task, task.status, index - 1)));
        }
        if (index !== -1 && index < withinColumn.length - 1) {
          actions.append(button("下移", () => moveTask(task, task.status, index + 1)));
        }`,
    `        // When the list is filtered, indices refer to the full task list; hide reorder UI.
        if (!filtersActive()) {
          const withinColumn = columnTasks(task.status);
          const index = withinColumn.findIndex((item) => item.id === task.id);
          if (index > 0) {
            actions.append(button("上移", () => moveTask(task, task.status, index - 1)));
          }
          if (index !== -1 && index < withinColumn.length - 1) {
            actions.append(button("下移", () => moveTask(task, task.status, index + 1)));
          }
        }`, "hide filtered reordering buttons");
  output = replaceOnce(output,
    '        status.value = task.status;\n        status.addEventListener("change", () => {',
    '        status.value = task.status;\n        status.disabled = filtersActive();\n        if (status.disabled) status.title = "請先清除篩選，再調整任務狀態。";\n        status.addEventListener("change", () => {',
    "quick status guard");
  output = replaceOnce(output,
    '    dragHelp.hidden = !editAllowed;',
    '    dragHelp.hidden = !editAllowed || filtersActive();', "drag help guard");
  output = replaceOnce(output,
    '    renderAssignees();\n    const tasks = sortedTasks();',
    `    renderAssignees();
    renderFilterAssignees();
    const allTasks = sortedTasks();
    const tasks = state.project && typeof window.TaskFilters?.filterTasks === "function"
      ? window.TaskFilters.filterTasks(allTasks, readFilters()) : allTasks;
    const filterPanel = el("task-filter-panel");
    filterPanel.hidden = !state.project;
    const filtering = filtersActive();
    el("task-filter-hint").hidden = !filtering;
    el("task-filter-empty").hidden = !state.project || !filtering || tasks.length !== 0;
    el("task-filter-count").textContent = state.project
      ? \`顯示 \${tasks.length} / \${allTasks.length} 筆任務\` : "請先選擇專案";
`, "filtered rendering");
  output = replaceOnce(output,
    '    el("total-count").textContent = String(tasks.length);',
    '    el("total-count").textContent = String(allTasks.length);', "global total statistic");
  output = replaceOnce(output,
    '      tasks.filter((x) => x.status === "in_progress").length,',
    '      allTasks.filter((x) => x.status === "in_progress").length,', "global in-progress statistic");
  output = replaceOnce(output,
    '      tasks.filter((x) => x.status === "done").length,',
    '      allTasks.filter((x) => x.status === "done").length,', "global done statistic");
  output = replaceOnce(output,
    '  async function refresh() {\n    const currentId = selector.value;',
    `  async function refresh() {
    const currentId = selector.value;
    if (state.filterProjectId !== currentId) {
      state.filterProjectId = currentId;
      clearFilterControls();
    }`, "cross-project filter reset");
  output = replaceOnce(output,
    '  function setProjects(projects, preferredId = null) {',
    LISTENERS + '  function setProjects(projects, preferredId = null) {', "filter listeners");
  output = replaceOnce(output,
    '      selector.value = "";\n      resetForm();\n      render();',
    '      selector.value = "";\n      state.filterProjectId = "";\n      clearFilterControls();\n      resetForm();\n      render();', "realtime access revocation");
  return { content: output, changed: true };
}

function run({ root = path.resolve(__dirname, ".."), dryRun = false, quiet = false } = {}) {
  const filterFile = path.join(root, "public/task-filters.js");
  if (!fs.existsSync(filterFile)) throw new Error("Missing public/task-filters.js (finish M9-B1 first).");
  const plans = [];
  for (const [name, patch] of [
    ["public/index.html", patchHtml], ["public/task-board.js", patchBoard],
  ]) {
    const filename = path.join(root, name);
    const original = fs.readFileSync(filename, "utf8");
    const crlf = original.includes("\r\n");
    const normalized = original.replace(/\r\n/g, "\n");
    const result = patch(normalized);
    plans.push({ name, filename, original, content: crlf ? result.content.replace(/\n/g, "\r\n") : result.content,
      changed: result.content !== normalized });
  }
  const cssName = "public/task-filters.css";
  const cssFile = path.join(root, cssName);
  const cssExists = fs.existsSync(cssFile);
  const cssOld = cssExists ? fs.readFileSync(cssFile, "utf8") : null;
  if (cssExists && cssOld.replace(/\r\n/g, "\n") !== CSS)
    throw new Error(`Existing ${cssName} differs from expected. Refusing to overwrite.`);
  plans.push({ name: cssName, filename: cssFile, original: cssOld, content: CSS, changed: !cssExists });
  const changed = plans.filter((p) => p.changed);
  if (!quiet) for (const p of plans) console.log(`[${dryRun ? "預覽" : "檢查"}] ${p.name}: ${p.changed ? "需要更新" : "已是最新"}`);
  if (dryRun || changed.length === 0) {
    if (!quiet) console.log(dryRun ? "Dry run：沒有改寫任何檔案。" : "沒有重複改寫。");
    return { changed: changed.length, backupDir: null };
  }
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9B2-backup-"));
  for (const p of changed) if (p.original !== null) {
    const backup = path.join(backupDir, p.name);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(p.filename, backup);
  }
  const attempted = [];
  try {
    for (const p of changed) {
      attempted.push(p);
      fs.writeFileSync(p.filename, p.content, "utf8");
      if (!quiet) console.log(`[已更新] ${p.name}`);
    }
  } catch (error) {
    for (const p of attempted.reverse()) {
      if (p.original === null) { if (fs.existsSync(p.filename)) fs.unlinkSync(p.filename); }
      else fs.copyFileSync(path.join(backupDir, p.name), p.filename);
    }
    throw error;
  }
  if (!quiet) {
    console.log(`M9-B2 整合完成。原始檔案備份：${backupDir}`);
    console.log("尚未 Git Commit/Push；請先驗收功能與測試。");
  }
  return { changed: changed.length, backupDir };
}

module.exports = { patchHtml, patchBoard, run };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run")) {
    console.error("僅支援 --dry-run。");
    process.exitCode = 2;
  } else {
    try { run({ dryRun: args.includes("--dry-run") }); }
    catch (error) { console.error("M9-B2 安全中止：", error.message); process.exitCode = 1; }
  }
}
