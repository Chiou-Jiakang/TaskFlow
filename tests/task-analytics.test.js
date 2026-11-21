"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { localToday, summarize, render } = require("../public/task-analytics");
const { patchHtml, patchBoard, run } = require("../scripts/apply-m9a");

const tasks = [
  { id: 1, status: "todo", priority: "high", dueDate: "2026-11-20", assigneeId: 2 },
  { id: 2, status: "in_progress", priority: "low", dueDate: "2026-11-21", assigneeId: 2 },
  { id: 3, status: "done", priority: "high", dueDate: "2026-11-01", assigneeId: null },
  { id: 4, status: "todo", priority: "medium", dueDate: null, assigneeId: null },
];
const members = [
  { userId: 1, displayName: "Owner" }, { userId: 2, displayName: "Member" },
];

test("M9-A Dashboard analytics 資料統計與安全整合", async (t) => {
  await t.test("完成率、逾期、今日到期與高優先統計不把 done 算成未完成", () => {
    const m = summarize(tasks, members, "2026-11-21");
    assert.equal(m.total, 4);
    assert.equal(m.done, 1);
    assert.equal(m.completionPercent, 25);
    assert.equal(m.overdue, 1);
    assert.equal(m.dueToday, 1);
    assert.equal(m.highOpen, 1);
    assert.equal(m.unassigned, 1);
    assert.deepEqual(m.workload.map(({ userId, count }) => [userId, count]), [[2, 2]]);
  });
  await t.test("空專案與無成員無除零、無不正確工作量", () => {
    const a = summarize([], []);
    assert.equal(a.completionPercent, 0);
    assert.deepEqual(a.workload, []);
    assert.equal(summarize([{ status: "todo", assigneeId: 99 }], []).unassigned, 1);
  });
  await t.test("逾期只計未完成，與時區本地日期對齊", () => {
    const date = new Date(2026, 0, 1, 23, 30, 0);
    assert.equal(localToday(date), "2026-01-01");
    assert.equal(summarize(tasks, members, "2026-11-20").overdue, 0);
    assert.equal(summarize(tasks, members, "2026-11-22").overdue, 2);
  });
  await t.test("不正確參數安全拒絕", () => {
    for (const bad of [null, {}, "hi"]) assert.throws(() => summarize(bad, []));
    assert.throws(() => summarize([], [], "tomorrow"));
    assert.throws(() => localToday(new Date("bad date")));
  });
  await t.test("工作量僅計未完成任務，排序穩定", () => {
    const values = summarize([
      { status: "done", assigneeId: 1 }, { status: "todo", assigneeId: 1 },
      { status: "todo", assigneeId: 2 }, { status: "todo", assigneeId: 2 },
    ], members).workload;
    assert.deepEqual(values.map((x) => [x.userId, x.count]), [[2, 2], [1, 1]]);
  });
  await t.test("DOM 只使用 textContent，不把專案或成員名稱解析為 HTML", () => {
    class NodeMock {
      constructor() { this.textContent = ""; this.children = []; }
      append(...nodes) { this.children.push(...nodes); }
      replaceChildren(...nodes) { this.children = nodes; }
    }
    const nodes = {};
    const doc = {
      getElementById(id) { return nodes[id] ?? (nodes[id] = new NodeMock()); },
      createElement() { return new NodeMock(); },
    };
    render([{ status: "todo", assigneeId: 1, priority: "high" }],
      [{ userId: 1, displayName: "<img onerror=alert(1)>" }],
      { name: "<script>alert(1)</script>" }, doc);
    assert.match(nodes["m9-analytics-scope"].textContent, /<script>/);
    assert.equal(nodes["m9-workload-list"].children[0].children[0].textContent,
      "<img onerror=alert(1)>");
    assert.equal(nodes["m9-high"].textContent, "1");
  });
  await t.test("不使用 innerHTML、儲存 Session 或寫入路由", () => {
    const js = fs.readFileSync(path.join(__dirname, "..", "public", "task-analytics.js"), "utf8");
    assert.doesNotMatch(js, /\binnerHTML\b|\blocalStorage\b|\bsessionStorage\b|\bfetch\s*\(/);
    assert.match(js, /\.textContent\s*=/);
    assert.doesNotMatch(js, /document\.cookie/);
  });
  await t.test("正確位置插入前端掛接，重複執行不增列", () => {
    const html = `    <link rel="stylesheet" href="/task-board.css" />\n    <script src="/task-board.js" defer></script>\n          <div class="nav-item">\n            <span>◫</span><span>統計總覽</span><small>規劃中</small>\n          </div>\n            <section class="board-section" aria-label="正式 Kanban 看板">`;
    const board = `    el("done-count").textContent = String(\n      tasks.filter((x) => x.status === "done").length,\n    );\n`;
    const h = patchHtml(html).content;
    const j = patchBoard(board).content;
    assert.match(h, /m9-analytics-title/);
    assert.match(j, /TaskAnalytics\?\.render/);
    assert.equal(patchHtml(h).changed, false);
    assert.equal(patchBoard(j).changed, false);
    assert.match(h, /href="#m9-analytics-title"/);
  });
  await t.test("定位點不符合時拒絕覆蓋", () => {
    assert.throws(() => patchHtml("unknown"), /定位點/);
    assert.throws(() => patchBoard("unknown"), /定位點/);
    assert.throws(() => patchHtml("<!-- TASKFLOW-M9A-BEGIN -->"), /標記不完整/);
  });
  await t.test("本機原有程式檔存在、相容 M6 拖曳及 M8 即時通知掛點", () => {
    const root = path.join(__dirname, "..");
    // 此測試會在使用者合併 ZIP 後執行；原專案檔案必須保留。
    const board = fs.readFileSync(path.join(root, "public", "task-board.js"), "utf8");
    const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
    assert.match(board, /card\.draggable = canMove\(\)/);
    assert.match(board, /window\.TaskRealtime\?\.flushPending/);
    assert.match(html, /task-realtime\.js/);
    assert.match(html, /task-activity\.js/);
  });
  await t.test("正式專案文件經預覽後重跑保持 idempotent", () => {
    const root = path.join(__dirname, "..");
    const r = run({ root, dryRun: true, quiet: true });
    assert.ok([0, 2].includes(r.changed));
  });
});
