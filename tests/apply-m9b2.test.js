"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { patchHtml, patchBoard, run } = require("../scripts/apply-m9b2");

const html = `<html><head>
    <link rel="stylesheet" href="/task-board.css" />
    <script src="/task-board.js" defer></script>
</head><body>
              <div class="kanban-board">
</body></html>`;
const board = `"use strict";
const state = {
    dragging: null,
  };
  const dragHelp = document.createElement("p");
  function canMove() {
    return Boolean(isManager() && canWrite() && !state.busy && state.csrf);
  }
  function makeCard(task) {
        status.value = task.status;
        status.addEventListener("change", () => {});
  }
  function editButtons(task) {
        const withinColumn = columnTasks(task.status);
        const index = withinColumn.findIndex((item) => item.id === task.id);
        if (index > 0) {
          actions.append(button("上移", () => moveTask(task, task.status, index - 1)));
        }
        if (index !== -1 && index < withinColumn.length - 1) {
          actions.append(button("下移", () => moveTask(task, task.status, index + 1)));
        }
  }
  function render() {
    dragHelp.hidden = !editAllowed;
    renderAssignees();
    const tasks = sortedTasks();
    el("total-count").textContent = String(tasks.length);
    el("progress-count").textContent = String(
      tasks.filter((x) => x.status === "in_progress").length,
    );
    el("done-count").textContent = String(
      tasks.filter((x) => x.status === "done").length,
    );
  }
  async function refresh() {
    const currentId = selector.value;
  }
  function setProjects(projects, preferredId = null) {
  }
  function realtimeRevoked() {
      selector.value = "";
      resetForm();
      render();
  }
`;

test("M9-B2 HTML inserts CSS, JS and accessible controls exactly once", () => {
  const first = patchHtml(html);
  assert.equal(first.changed, true);
  assert.match(first.content, /task-filter-keyword/);
  assert.match(first.content, /task-filter-reset/);
  assert.match(first.content, /src="\/task-filters.js"/);
  assert.match(first.content, /href="\/task-filters.css"/);
  assert.equal(patchHtml(first.content).changed, false);
});

test("M9-B2 Kanban preserves full-data counts and blocks filtered moves", () => {
  const first = patchBoard(board);
  assert.equal(first.changed, true);
  assert.match(first.content, /window\.TaskFilters\.filterTasks\(allTasks, readFilters\(\)\)/);
  assert.match(first.content, /String\(allTasks\.length\)/);
  assert.match(first.content, /&& !filtersActive\(\)/);
  assert.match(first.content, /status\.disabled = filtersActive\(\)/);
  assert.match(first.content, /if \(!filtersActive\(\)\) \{/);
  assert.match(first.content, /state\.filterProjectId !== currentId/);
  assert.equal(patchBoard(first.content).changed, false);
});

test("M9-B2 rejects an unexpected repository layout before writing", () => {
  assert.throws(() => patchHtml("<html />"), /anchor/);
  assert.throws(() => patchBoard("unknown code"), /anchor/);
});

test("M9-B2 dry-run, apply and repeat are non-destructive and idempotent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m9b2-test-"));
  try {
    fs.mkdirSync(path.join(root, "public"));
    fs.writeFileSync(path.join(root, "public", "index.html"), html);
    fs.writeFileSync(path.join(root, "public", "task-board.js"), board);
    fs.writeFileSync(path.join(root, "public", "task-filters.js"), "// previously validated M9-B1\n");
    assert.equal(run({ root, dryRun: true, quiet: true }).changed, 3);
    assert.equal(fs.readFileSync(path.join(root, "public", "index.html"), "utf8"), html);
    const result = run({ root, quiet: true });
    assert.equal(result.changed, 3);
    assert.ok(fs.existsSync(path.join(root, "public", "task-filters.css")));
    assert.ok(result.backupDir);
    const repeated = run({ root, quiet: true });
    assert.equal(repeated.changed, 0);
    assert.equal(run({ root, dryRun: true, quiet: true }).changed, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
