"use strict";

// M8-C2 專用 Edge E2E：:memory: SQLite + 隨機本機 Port，不碰 data/taskflow.db。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

const EMAIL = "m8c2-owner@example.test";
const PASSWORD = "M8C2!ActivityE2ELocal2026";

test("M8-C2 Microsoft Edge 專案活動時間軸 E2E", { timeout: 90000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let hub;
  let browser;
  let context;
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
  page.on("pageerror", (error) => errors.push(error.message));
  let projectId;
  let otherProjectId;

  const overlay = page.locator("#task-activity-overlay");
  const entries = page.locator("#task-activity-list .tf-activity-entry");
  const card = () => page.locator(".tf-task-card").filter({
    has: page.locator("h4", { hasText: "M8C2 activity task" }),
  });
  async function loaded() {
    await page.waitForFunction(() =>
      document.querySelector("#task-activity-message")?.textContent?.includes("已載入"));
  }
  async function openActivity() {
    await page.locator("#task-activity-open").click();
    await overlay.waitFor({ state: "visible" });
    await loaded();
  }
  async function openComments() {
    await card().getByRole("button", { name: "留言" }).click();
    await page.locator("#task-comments-overlay").waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      document.querySelector("#task-comments-message")?.textContent?.includes("已載入"));
  }

  await t.test("建立隔離的專案與任務；首次活動清單為空", async () => {
    const registration = await context.request.post(`${base}/api/auth/register`, {
      headers: { Origin: base }, data: {
        email: EMAIL, password: PASSWORD, displayName: "M8C2 Owner",
      },
    });
    assert.equal(registration.status(), 201);
    await page.goto("/auth.html");
    await page.locator("#login-email").fill(EMAIL);
    await page.locator("#login-password").fill(PASSWORD);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
    await page.locator("#project-name").fill("M8C2 isolated project");
    const [created] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/projects"),
      page.locator('#project-create button[type="submit"]').click(),
    ]);
    assert.equal(created.status(), 201);
    projectId = (await created.json()).project.id;
    await page.locator("#task-title").fill("M8C2 activity task");
    const [taskResp] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" &&
        /\/tasks$/.test(new URL(r.url()).pathname)),
      page.locator("#task-submit").click(),
    ]);
    assert.equal(taskResp.status(), 201);
    await card().waitFor();
    await openActivity();
    assert.equal(await entries.count(), 0);
    await page.locator("#task-activity-close").click();
  });

  await t.test("新增留言後顯示活動事件，但不暴露留言正文", async () => {
    await openComments();
    await page.locator("#task-comments-input").fill("M8C2 confidential comment body");
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" &&
        /\/comments$/.test(new URL(r.url()).pathname)),
      page.locator("#task-comments-submit").click(),
    ]);
    assert.equal(response.status(), 201);
    await page.getByText("M8C2 confidential comment body", { exact: true }).waitFor();
    await page.locator("#task-comments-close").click();
    await openActivity();
    assert.equal(await entries.count(), 1);
    assert.match(await entries.first().innerText(), /M8C2 Owner.*新增了任務留言/);
    assert.equal(await overlay.getByText("M8C2 confidential comment body").count(), 0);
    await page.locator("#task-activity-close").click();
  });

  await t.test("編輯留言產生更新活動並維持新到舊排序", async () => {
    await openComments();
    await page.locator("#task-comments-list .tf-comments-item").first()
      .getByRole("button", { name: "編輯" }).click();
    await page.locator("#task-comments-input").fill("M8C2 updated comment");
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "PATCH" &&
        /\/comments\/\d+$/.test(new URL(r.url()).pathname)),
      page.locator("#task-comments-submit").click(),
    ]);
    assert.equal(response.status(), 200);
    await page.getByText("M8C2 updated comment", { exact: true }).waitFor();
    await page.locator("#task-comments-close").click();
    await openActivity();
    assert.equal(await entries.count(), 2);
    assert.match(await entries.nth(0).innerText(), /編輯了任務留言/);
    assert.match(await entries.nth(1).innerText(), /新增了任務留言/);
    await page.keyboard.press("Escape");
    await overlay.waitFor({ state: "hidden" });
  });

  await t.test("刪除留言產生紀錄，且分頁與刷新可用", async () => {
    await openComments();
    page.once("dialog", (dialog) => dialog.accept());
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "DELETE" &&
        /\/comments\/\d+$/.test(new URL(r.url()).pathname)),
      page.locator("#task-comments-list .tf-comments-item").first()
        .getByRole("button", { name: "刪除" }).click(),
    ]);
    assert.equal(response.status(), 204);
    await page.waitForFunction(() =>
      document.querySelectorAll("#task-comments-list .tf-comments-item").length === 0);
    await page.locator("#task-comments-close").click();
    await openActivity();
    assert.equal(await entries.count(), 3);
    assert.match(await entries.first().innerText(), /刪除了任務留言/);
    await page.locator("#task-activity-refresh").click();
    await loaded();
    assert.equal(await entries.count(), 3);
    assert.deepEqual(errors, []);
    await page.locator("#task-activity-close").click();
  });

  await t.test("切換專案立即清除舊時間軸，不讀取其他專案", async () => {
    await page.locator("#project-name").fill("M8C2 second isolated project");
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/projects"),
      page.locator('#project-create button[type="submit"]').click(),
    ]);
    assert.equal(response.status(), 201);
    otherProjectId = (await response.json()).project.id;
    await page.evaluate((id) => window.TaskBoard.selectProject(id), projectId);
    await page.locator("#task-project-select").waitFor();
    await page.waitForFunction((id) =>
      document.querySelector("#task-project-select")?.value === String(id), projectId);
    await openActivity();
    await page.evaluate((id) => window.TaskBoard.selectProject(id), otherProjectId);
    await overlay.waitFor({ state: "hidden" });
    await page.waitForFunction((id) =>
      document.querySelector("#task-project-select")?.value === String(id), otherProjectId);
    await openActivity();
    assert.equal(await entries.count(), 0);
    assert.deepEqual(errors, []);
  });
});
