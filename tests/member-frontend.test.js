"use strict";

// M4-C1：前端資源、成員入口與受保護 API 的整合測試。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");

test("M4-C1 Member frontend smoke tests", async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);

  const server = createApp({ database: db }).listen(0, "127.0.0.1");
  await once(server, "listening");

  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    db.close();
  });

  async function getText(route) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    return response.text();
  }

  await t.test("專案清單會產生管理成員入口", async () => {
    const js = await getText("/dashboard-auth.js");

    assert.match(js, /members\.html\?projectId=/);
    assert.match(js, /管理成員/);
  });

  await t.test("成員管理頁面具有必要控制項", async () => {
    const html = await getText("/members.html");

    for (const id of [
      "auth-boot",
      "project-title",
      "member-list",
      "member-add-form",
      "member-message",
      "logout-button",
    ]) {
      assert.ok(html.includes(`id="${id}"`), `${id} missing`);
    }

    assert.match(html, /src="\/members\.js"/);
    assert.match(html, /href="\/members\.css"/);
  });

  await t.test("前端新增資源可由 Express 存取", async () => {
    assert.ok((await getText("/members.js")).length > 500);
    assert.ok((await getText("/members.css")).length > 100);
  });

  await t.test("前端呼叫正式 Session、成員 API 和 CSRF", async () => {
    const js = await getText("/members.js");

    assert.match(js, /\/api\/auth\/me/);
    assert.match(js, /\/api\/auth\/logout/);
    assert.match(js, /\/members/);
    assert.match(js, /X-TaskFlow-CSRF/);

    assert.doesNotMatch(js, /\blocalStorage\s*\.|\bsessionStorage\s*\./);
  });

  await t.test("匿名者無法存取成員資料", async () => {
    const response = await fetch(base + "/api/projects/1/members");

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "UNAUTHENTICATED");
  });
});
