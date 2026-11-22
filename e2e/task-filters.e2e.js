"use strict";

// M9-B2: isolated Edge test database. No production SQLite or real user data.
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

test("M9-B2 Edge search and multi-filter integration", { timeout: 120000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let browser, context, hub;
  const errors = [];
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
  page.on("pageerror", (err) => errors.push(err.message));
  const headers = { Origin: base };
  let csrf, ownerId, projectId, emptyProjectId;

  const apiPost = async (endpoint, data) => {
    const response = await context.request.post(`${base}${endpoint}`, {
      headers: { ...headers, "X-TaskFlow-CSRF": csrf }, data,
    });
    assert.equal(response.status(), 201, `${endpoint}: ${await response.text()}`);
    return response.json();
  };
  const counter = async (expected) => page.waitForFunction((value) =>
    document.getElementById("task-filter-count")?.textContent === value, expected);

  await t.test("isolated owner and 3 tasks are loaded", async () => {
    const registered = await context.request.post(`${base}/api/auth/register`, {
      headers, data: {
        email: "m9b2-owner@example.test",
        displayName: "M9B2 Owner",
        password: "M9B2!Filters2026Test",
      },
    });
    assert.equal(registered.status(), 201);
    ownerId = (await registered.json()).user.id;
    await page.goto("/auth.html");
    await page.locator("#login-email").fill("m9b2-owner@example.test");
    await page.locator("#login-password").fill("M9B2!Filters2026Test");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
    const me = await context.request.get(`${base}/api/auth/me`);
    assert.equal(me.status(), 200);
    csrf = (await me.json()).csrfToken;
    projectId = (await apiPost("/api/projects", { name: "M9-B2 Filters" })).project.id;
    emptyProjectId = (await apiPost("/api/projects", { name: "M9-B2 Empty" })).project.id;
    await apiPost(`/api/projects/${projectId}/tasks`, {
      title: "修正 API", description: "登入錯誤", status: "todo", priority: "high",
    });
    await apiPost(`/api/projects/${projectId}/tasks`, {
      title: "新增文件", status: "in_progress", priority: "medium", assigneeId: ownerId,
    });
    await apiPost(`/api/projects/${projectId}/tasks`, {
      title: "完成發布", status: "done", priority: "low", assigneeId: ownerId,
    });
    await page.reload();
    await page.locator("body.auth-ready").waitFor();
    await page.locator("#task-project-select").selectOption(String(projectId));
    await counter("顯示 3 / 3 筆任務");
    assert.equal(await page.locator("#task-workspace .tf-task-card").count(), 3);
    assert.equal(await page.locator("#total-count").innerText(), "3");
    assert.equal(await page.locator("#m9-rate").innerText(), "33%");
  });

  await t.test("keyword narrows cards without changing global analytics", async () => {
    await page.locator("#task-filter-keyword").fill("API");
    await counter("顯示 1 / 3 筆任務");
    assert.match(await page.locator(".tf-task-card").innerText(), /修正 API/);
    assert.equal(await page.locator("#total-count").innerText(), "3");
    assert.equal(await page.locator("#m9-rate").innerText(), "33%");
    assert.equal(await page.locator('.tf-task-card[draggable="true"]').count(), 0);
    assert.equal(await page.locator('.tf-task-card .tf-task-actions select:disabled').count(), 1);
  });

  await t.test("status, priority and assignee combine and reset", async () => {
    await page.locator("#task-filter-status").selectOption("todo");
    await page.locator("#task-filter-priority").selectOption("high");
    await page.locator("#task-filter-assignee").selectOption("unassigned");
    await counter("顯示 1 / 3 筆任務");
    await page.locator("#task-filter-assignee").selectOption(String(ownerId));
    await counter("顯示 0 / 3 筆任務");
    assert.equal(await page.locator("#task-filter-empty").isVisible(), true);
    await page.locator("#task-filter-reset").click();
    await counter("顯示 3 / 3 筆任務");
    assert.equal(await page.locator("#task-filter-keyword").inputValue(), "");
    assert.equal(await page.locator('.tf-task-card[draggable="true"]').count(), 3);
  });

  await t.test("refresh keeps same-project filters but switching project clears them", async () => {
    await page.locator("#task-filter-keyword").fill("文件");
    await counter("顯示 1 / 3 筆任務");
    await page.locator("#task-refresh").click();
    await counter("顯示 1 / 3 筆任務");
    assert.equal(await page.locator("#task-filter-keyword").inputValue(), "文件");
    await page.locator("#task-project-select").selectOption(String(emptyProjectId));
    await counter("顯示 0 / 0 筆任務");
    assert.equal(await page.locator("#task-filter-keyword").inputValue(), "");
    assert.equal(await page.locator("#task-workspace .tf-task-card").count(), 0);
  });

  await t.test("no uncaught page errors", () => {
    assert.deepEqual(errors, []);
  });
});
