"use strict";

// M3-C1：前端靜態資源與整合接線 smoke tests（非真實瀏覽器 E2E）
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");

test("M3-C1 Authentication frontend smoke tests", async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const server = createApp({ database: db }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    db.close();
  });
  async function getText(route) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    return response.text();
  }
  await t.test("身分驗證頁面包含兩個表單", async () => {
    const html = await getText("/auth.html");
    assert.match(html, /id="login-form"/);
    assert.match(html, /id="register-form"/);
    assert.match(html, /src="\/auth\.js"/);
  });
  await t.test("首頁保留 Kanban 並掛載登入守衛", async () => {
    const html = await getText("/");
    assert.match(html, /class="auth-pending"/);
    assert.match(html, /src="\/dashboard-auth\.js"/);
    assert.match(html, /kanban-board/);
    assert.match(html, /id="project-create"/);
  });
  await t.test("新增前端檔案皆由 Express 正常提供", async () => {
    for (const route of ["/auth.js", "/auth.css", "/dashboard-auth.js"]) {
      assert.ok((await getText(route)).length > 100);
    }
  });
  await t.test(
    "前端使用既有 API 且不存 Session Token 到 localStorage",
    async () => {
      const auth = await getText("/auth.js");
      const dashboard = await getText("/dashboard-auth.js");
      assert.match(auth, /\/api\/auth\/login/);
      assert.match(auth, /\/api\/auth\/register/);
      assert.match(dashboard, /\/api\/auth\/me/);
      assert.match(dashboard, /\/api\/auth\/logout/);
      assert.match(dashboard, /X-TaskFlow-CSRF/);
      assert.doesNotMatch(
        auth + dashboard,
        /\blocalStorage\s*\.|\bsessionStorage\s*\./,
      );
    },
  );
  await t.test("未登入仍不能取得受保護的專案資料", async () => {
    const response = await fetch(base + "/api/projects");
    assert.equal(response.status, 401);
  });
});
