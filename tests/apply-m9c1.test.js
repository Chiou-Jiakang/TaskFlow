"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { patchHtml, patchBoard, run } = require("../scripts/apply-m9c1");

const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/task-board.css" />
</head><body>
            <p
              id="task-message"
              class="tf-message"
              role="status"
              aria-live="polite"
            >
              正在確認任務資料…
            </p>
              <section id="task-filter-panel"></section>
              <div class="kanban-board">
              </div>
</body></html>`;

const board = `"use strict";
// TASKFLOW-M9B2-BEGIN
const state = {
    requestId: 0,
    dragging: null,
};
  function notice(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }
  function render() {
    el("task-filter-count").textContent = state.project
      ? \`顯示 \${tasks.length} / \${allTasks.length} 筆任務\` : "請先選擇專案";
    for (const [column, backendStatus] of Object.entries(columnStatus)) {
      const section = document.querySelector(\`.kanban-column[data-status="\${column}"]\`);
      const filtered = tasks.filter((task) => task.status === backendStatus);
      section
        .querySelector(".task-list")
        .replaceChildren(...filtered.map(makeCard));
    }
  }
  async function refresh() {
    const currentId = selector.value;
    const requestId = ++state.requestId;
    // M9-B3 safe background refresh
    try {
      const projectData = {}, memberData = {}, taskData = {};
      state.project = projectData.project;
      state.members = memberData.members;
      state.tasks = taskData.tasks;
      render();
    } catch (error) {
      state.project = null;
      state.members = [];
      state.tasks = [];
      render();
      if (error.status !== 401) notice(error.message, true);
    }
  }
  el("task-refresh").addEventListener("click", () => {
  });
  const obj = {
    realtimeRevoked(projectId) {
      state.tasks = [];
      selector.value = "";
      state.filterProjectId = "";
    },
  };
`;

test("M9-C1 inserts required UX elements exactly once", () => {
  const updated = patchHtml(html);
  assert.equal(updated.changed, true);
  for (const id of ["task-ux-loading", "task-ux-retry", "task-ux-retry-button", "task-board-empty"]) {
    assert.match(updated.content, new RegExp(`id="${id}"`));
  }
  assert.match(updated.content, /href="\/task-ux.css"/);
  assert.equal(patchHtml(updated.content).changed, false);
});

test("M9-C1 board adds loading/retry, no changes to task REST payloads", () => {
  const result = patchBoard(board);
  assert.equal(result.changed, true);
  assert.match(result.content, /setUxLoading\(Boolean\(currentId\)\)/);
  assert.match(result.content, /setUxRetry\(error\.status !== 401\)/);
  assert.match(result.content, /task-board-empty/);
  assert.match(result.content, /tf-column-empty/);
  assert.match(result.content, /if \(!state\.busy\) void refresh\(\)/);
  assert.equal(patchBoard(result.content).changed, false);
});

test("M9-C1 refuses unexpected repository anchors", () => {
  assert.throws(() => patchHtml("<html></html>"), /anchor/);
  assert.throws(() => patchBoard("other code"), /anchor/);
  const half = patchHtml(html).content.replace("<!-- /TASKFLOW-M9C1-END -->", "");
  assert.throws(() => patchHtml(half), /incomplete/);
});

test("M9-C1 dry-run, apply, verify, and repeat preserve files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m9c1-fixture-"));
  try {
    fs.mkdirSync(path.join(dir, "public"));
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "taskflow" }));
    fs.writeFileSync(path.join(dir, "public/index.html"), html);
    fs.writeFileSync(path.join(dir, "public/task-board.js"), board);
    assert.equal(run({ root: dir, dryRun: true, quiet: true }).changed, 3);
    assert.equal(fs.readFileSync(path.join(dir, "public/index.html"), "utf8"), html);
    assert.throws(() => run({ root: dir, verify: true, quiet: true }), /not fully installed/);
    assert.equal(run({ root: dir, quiet: true }).written, 3);
    assert.ok(fs.existsSync(path.join(dir, "public/task-ux.css")));
    assert.equal(run({ root: dir, verify: true, quiet: true }).changed, 0);
    assert.equal(run({ root: dir, dryRun: true, quiet: true }).changed, 0);
    assert.equal(run({ root: dir, quiet: true }).written, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
