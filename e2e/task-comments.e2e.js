"use strict";

// M8-C1 專屬 Microsoft Edge E2E。:memory: SQLite + 隨機 Port，不操作正式資料庫。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

const email = "m8c1-owner@example.test";
const password = "M8C1!LocalBrowserTest2026";

test("M8-C1 Edge 任務留言 CRUD / 版本 / 安全呈現", { timeout: 90000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let hub;
  let browser;
  let context;
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
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const card = () => page.locator(".tf-task-card").filter({ has: page.locator("h4", { hasText: "M8C1 Task" }) });
  const overlay = page.locator("#task-comments-overlay");
  const commentItems = page.locator("#task-comments-list .tf-comments-item");

  await t.test("建立專案與任務，載入留言面板", async () => {
    const register = await context.request.post(`${base}/api/auth/register`, {
      headers: { Origin: base }, data: { email, password, displayName: "M8C1 Owner" },
    });
    assert.equal(register.status(), 201);
    await page.goto("/auth.html");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
    await page.locator("#project-name").fill("M8C1 isolated project");
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/projects"),
      page.locator('#project-create button[type="submit"]').click(),
    ]);
    await page.locator("#task-title").fill("M8C1 Task");
    const [created] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && /\/tasks$/.test(new URL(r.url()).pathname)),
      page.locator("#task-submit").click(),
    ]);
    assert.equal(created.status(), 201);
    await card().waitFor();
    await card().getByRole("button", { name: "留言" }).click();
    await overlay.waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#task-comments-message")?.textContent?.includes("已載入"));
    assert.equal(await commentItems.count(), 0);
  });

  await t.test("建立留言，經後端持久化後才顯示", async () => {
    await page.locator("#task-comments-input").fill("M8-C1 第一則留言");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && /\/comments$/.test(new URL(r.url()).pathname)),
      page.locator("#task-comments-submit").click(),
    ]);
    assert.equal(resp.status(), 201);
    await page.getByText("M8-C1 第一則留言", { exact: true }).waitFor();
    assert.equal(await commentItems.count(), 1);
  });

  await t.test("編輯留言、保留版本規則", async () => {
    await commentItems.first().getByRole("button", { name: "編輯" }).click();
    await page.locator("#task-comments-input").fill("M8-C1 第二版留言");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "PATCH" && /\/comments\/\d+$/.test(new URL(r.url()).pathname)),
      page.locator("#task-comments-submit").click(),
    ]);
    assert.equal(resp.status(), 200);
    await page.getByText("M8-C1 第二版留言", { exact: true }).waitFor();
  });

  await t.test("XSS 文字不被當成 HTML", async () => {
    const injection = '<img src=x onerror="window.__M8C1_XSS=1">';
    await page.locator("#task-comments-input").fill(injection);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && /\/comments$/.test(new URL(r.url()).pathname)),
      page.locator("#task-comments-submit").click(),
    ]);
    assert.equal(resp.status(), 201);
    await page.getByText(injection, { exact: true }).waitFor();
    assert.equal(await overlay.locator("img").count(), 0);
    assert.equal(await page.evaluate(() => window.__M8C1_XSS === 1), false);
  });

  await t.test("刪除最新留言後列表更新，無頁面錯誤", async () => {
    page.once("dialog", (dialog) => dialog.accept());
    const injected = commentItems.filter({ hasText: '<img src=x onerror=' });
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "DELETE" && /\/comments\/\d+$/.test(new URL(r.url()).pathname)),
      injected.getByRole("button", { name: "刪除" }).click(),
    ]);
    assert.equal(resp.status(), 204);
    await page.waitForFunction(() => document.querySelectorAll("#task-comments-list .tf-comments-item").length === 1);
    assert.deepEqual(pageErrors, []);
  });
});
