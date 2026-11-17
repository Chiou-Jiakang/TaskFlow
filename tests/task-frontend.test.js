"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");

test("M5-C1 Task frontend smoke tests", async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const server = createApp({ database: db }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  });
  async function text(route) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    return response.text();
  }

  await t.test("首頁保留 Session 守衛、專案及成員入口", async () => {
    const html = await text("/");
    assert.match(html, /class="auth-pending"/);
    assert.match(html, /id="project-create"/);
    assert.match(html, /src="\/dashboard-auth\.js"/);
    assert.match(html, /kanban-board/);
    const js = await text("/dashboard-auth.js");
    assert.match(js, /members\.html\?projectId=/);
    assert.match(js, /管理成員/);
  });

  await t.test("正式任務表單與專案選擇器可用", async () => {
    const html = await text("/");
    for (const id of [
      "task-project-select",
      "task-form",
      "task-title",
      "task-description",
      "task-status",
      "task-priority",
      "task-assignee",
      "task-due",
      "task-position",
      "task-message",
      "task-board-heading",
    ]) {
      assert.ok(html.includes(`id="${id}"`), `Missing: ${id}`);
    }
    assert.doesNotMatch(html, /下方為任務看板展示模式/);
  });

  await t.test("新增 JS / CSS 靜態資源可由 Express 提供", async () => {
    const html = await text("/");
    assert.match(html, /src="\/task-board\.js"/);
    assert.match(html, /href="\/task-board\.css"/);
    assert.ok((await text("/task-board.js")).length > 1000);
    assert.ok((await text("/task-board.css")).length > 500);
  });

  await t.test("正式看板呼叫現有 Task API 與成員 API", async () => {
    const js = await text("/task-board.js");
    assert.match(js, /\/api\/projects\//);
    assert.match(js, /\/tasks/);
    assert.match(js, /\/members/);
    assert.match(js, /credentials: "same-origin"/);
    assert.match(js, /X-TaskFlow-CSRF/);
  });

  await t.test("版本衝突會重整，角色限制與封存限制存在", async () => {
    const js = await text("/task-board.js");
    assert.match(js, /error\.status === 409/);
    assert.match(js, /state\.project\.myRole/);
    assert.match(js, /state\.project\?\.status === "active"/);
    assert.match(js, /task\.assigneeId === state\.user\?\.id/);
    assert.match(js, /version: task\.version/);
  });

  await t.test("前端使用安全文字節點而非 innerHTML", async () => {
    const scripts =
      (await text("/task-board.js")) + (await text("/dashboard-auth.js"));
    assert.match(scripts, /\.textContent\s*=/);
    assert.doesNotMatch(scripts, /\.innerHTML\s*=/);
    assert.doesNotMatch(scripts, /\blocalStorage\s*\.|\bsessionStorage\s*\./);
  });

  await t.test("匿名者不能讀取任務 API", async () => {
    const response = await fetch(base + "/api/projects/1/tasks");
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "UNAUTHENTICATED");
  });
});
