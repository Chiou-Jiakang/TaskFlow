"use strict";

// M9-A Microsoft Edge E2E：隔離 :memory: SQLite + 隨機 Loopback Port。
// 只建立測試帳號與測試任務，不使用正式 data/taskflow.db。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

test("M9-A Edge Dashboard Analytics E2E", { timeout: 90000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let browser, context, hub;
  const pageErrors = [];
  t.after(async () => {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (hub) await new Promise((resolve) => hub.io.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  hub = attachRealtime(server, db);
  app.locals.publishProjectChanged = hub.publishProjectChanged;
  browser = await chromium.launch({ channel: "msedge", headless: true });
  context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const headers = { Origin: base };
  let projectId, otherProjectId, csrf, ownerId;

  async function apiPost(path, data) {
    const response = await context.request.post(`${base}${path}`, {
      headers: { ...headers, "X-TaskFlow-CSRF": csrf }, data,
    });
    assert.equal(response.status(), 201, `${path}: ${await response.text()}`);
    return response.json();
  }
  async function expectMetric(id, expected) {
    await page.waitForFunction(({ id, expected }) =>
      document.getElementById(id)?.textContent === expected,
    { id, expected });
  }

  await t.test("隔離帳號登入與專案資料建立", async () => {
    const registered = await context.request.post(`${base}/api/auth/register`, {
      headers, data: {
        email: "m9a-owner@example.test", displayName: "M9A Owner",
        password: "M9A!AnalyticsE2E2026",
      },
    });
    assert.equal(registered.status(), 201);
    ownerId = (await registered.json()).user.id;
    await page.goto("/auth.html");
    await page.locator("#login-email").fill("m9a-owner@example.test");
    await page.locator("#login-password").fill("M9A!AnalyticsE2E2026");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
    const me = await context.request.get(`${base}/api/auth/me`);
    assert.equal(me.status(), 200);
    csrf = (await me.json()).csrfToken;
    assert.match(csrf, /^[0-9a-f]{64}$/);

    projectId = (await apiPost("/api/projects", { name: "M9-A Analytics" })).project.id;
    otherProjectId = (await apiPost("/api/projects", { name: "M9-A Empty" })).project.id;
    await apiPost(`/api/projects/${projectId}/tasks`, {
      title: "逾期高優先", priority: "high", dueDate: "2020-01-01", status: "todo",
    });
    await apiPost(`/api/projects/${projectId}/tasks`, {
      title: "完成任務", priority: "high", dueDate: "2020-01-01", status: "done",
    });
    await apiPost(`/api/projects/${projectId}/tasks`, {
      title: "進行中工作", status: "in_progress", assigneeId: ownerId,
    });
  });

  await t.test("目前專案統計：完成率、逾期、高優先與工作量", async () => {
    await page.reload();
    await page.locator("body.auth-ready").waitFor();
    await page.locator("#task-project-select").selectOption(String(projectId));
    await expectMetric("m9-rate", "33%");
    await expectMetric("m9-overdue", "1");
    await expectMetric("m9-high", "1");
    await expectMetric("m9-unassigned", "1");
    assert.match(await page.locator("#m9-workload-list").innerText(), /M9A Owner.*1 筆未完成/s);
    assert.match(await page.locator("#m9-analytics-scope").innerText(), /M9-A Analytics/);
  });

  await t.test("切換空專案，清除前一專案統計且不洩漏任務", async () => {
    await page.locator("#task-project-select").selectOption(String(otherProjectId));
    await expectMetric("m9-rate", "0%");
    await expectMetric("m9-overdue", "0");
    await expectMetric("m9-high", "0");
    await expectMetric("m9-unassigned", "0");
    assert.doesNotMatch(await page.locator("#m9-analytics").innerText(), /逾期高優先|進行中工作/);
    assert.match(await page.locator("#m9-analytics-scope").innerText(), /M9-A Empty/);
  });

  await t.test("M6 Kanban 仍保留三欄且無頁面錯誤", async () => {
    assert.equal(await page.locator("#task-workspace .kanban-column").count(), 3);
    assert.deepEqual(pageErrors, []);
  });
});
