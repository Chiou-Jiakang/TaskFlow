"use strict";

// M9-C1 Microsoft Edge: isolated in-memory SQLite; never touches production taskflow.db.
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

test("M9-C1 Edge board UX states", { timeout: 90000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let hub, browser, context;
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
  const headers = { Origin: base };
  let csrf, projectId;

  await t.test("isolated login and empty project show useful empty state", async () => {
    const signup = await context.request.post(`${base}/api/auth/register`, {
      headers, data: {
        email: "m9c1-owner@example.test",
        displayName: "M9C1 Owner",
        password: "M9C1!IsolatedTest2026",
      },
    });
    assert.equal(signup.status(), 201);
    await page.goto("/auth.html");
    await page.locator("#login-email").fill("m9c1-owner@example.test");
    await page.locator("#login-password").fill("M9C1!IsolatedTest2026");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
    const me = await context.request.get(`${base}/api/auth/me`);
    assert.equal(me.status(), 200);
    csrf = (await me.json()).csrfToken;
    const created = await context.request.post(`${base}/api/projects`, {
      headers: { ...headers, "X-TaskFlow-CSRF": csrf }, data: { name: "M9C1 Empty project" },
    });
    assert.equal(created.status(), 201);
    projectId = (await created.json()).project.id;
    await page.reload();
    await page.locator("body.auth-ready").waitFor();
    await page.locator("#task-project-select").selectOption(String(projectId));
    await page.waitForFunction(() => document.querySelector("#task-filter-count")?.textContent === "顯示 0 / 0 筆任務");
    await page.locator("#task-board-empty").waitFor({ state: "visible" });
    assert.equal(await page.locator("#task-ux-retry").isVisible(), false);
  });

  await t.test("creating one task hides global empty, shows empty columns", async () => {
    await page.locator("#task-title").fill("M9C1 第一筆任務");
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/projects/${projectId}/tasks`),
      page.locator("#task-submit").click(),
    ]);
    assert.equal(response.status(), 201);
    await page.locator(".tf-task-card").filter({ hasText: "M9C1 第一筆任務" }).waitFor();
    assert.equal(await page.locator("#task-board-empty").isVisible(), false);
    assert.equal(await page.locator(".tf-column-empty").count(), 2);
    // The task card can render before mutate() finally enables workspace controls.
    // Do not begin a new read-failure scenario until the previous mutation is settled.
    await page.waitForFunction(() => {
      const refresh = document.getElementById("task-refresh");
      const board = document.querySelector(".board-section");
      return refresh && !refresh.disabled && board?.getAttribute("aria-busy") === "false";
    });
  });

  await t.test("failed task read exposes retry without stale data, retry recovers", async () => {
    // A deterministic HTTP 503 is a genuine failed REST read. It avoids the
    // unpredictable timing of aborting a transport connection mid-refresh.
    let rejectReads = true;
    let injectedFailures = 0;
    await page.route(`**/api/projects/${projectId}/tasks`, async (route) => {
      if (rejectReads && route.request().method() === "GET") {
        injectedFailures++;
        await route.fulfill({
          status: 503,
          contentType: "application/json; charset=utf-8",
          body: JSON.stringify({
            error: "TEMPORARY_UNAVAILABLE",
            message: "M9-C1 模擬：任務讀取暫時失敗",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.locator("#task-refresh").click();
    await page.locator("#task-ux-retry").waitFor({ state: "visible" });
    assert.ok(injectedFailures >= 1, "預期至少攔截一筆 GET 並回傳 HTTP 503");
    assert.equal(await page.locator(".tf-task-card").count(), 0);
    assert.equal(await page.locator("#task-ux-loading").isVisible(), false);

    const retry = page.locator("#task-ux-retry-button");
    const diagnostics = async () => page.evaluate(() => {
      const button = document.getElementById("task-ux-retry-button");
      const panel = document.getElementById("task-ux-retry");
      const board = document.querySelector(".board-section");
      const rect = button?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : 0;
      const y = rect ? rect.top + rect.height / 2 : 0;
      const top = document.elementFromPoint(x, y);
      return {
        buttonExists: Boolean(button),
        buttonDisabled: button?.disabled,
        panelHidden: panel?.hidden,
        panelDisplay: panel ? getComputedStyle(panel).display : null,
        boardBusy: board?.getAttribute("aria-busy"),
        activeElement: document.activeElement?.id,
        topElement: top ? `${top.tagName.toLowerCase()}#${top.id || ""}.${top.className || ""}` : null,
        message: document.getElementById("task-message")?.textContent,
      };
    });

    // The UI is defective if the visible retry control is disabled. Report the
    // exact state rather than waiting a silent 30 seconds for Playwright.click().
    if (!(await retry.isEnabled())) {
      assert.fail(`重試按鈕已顯示但不可操作：${JSON.stringify(await diagnostics())}`);
    }
    rejectReads = false;
    try {
      await retry.click({ timeout: 7000 });
    } catch (error) {
      const detail = await diagnostics();
      throw new Error(`重試按鈕點擊失敗：${JSON.stringify(detail)}\n${error.message}`);
    }

    await page.locator(".tf-task-card").filter({ hasText: "M9C1 第一筆任務" }).waitFor();
    await page.waitForFunction(() => document.querySelector(".board-section")?.getAttribute("aria-busy") === "false");
    assert.equal(await page.locator("#task-ux-retry").isVisible(), false);
    await page.unrouteAll({ behavior: "wait" });
  });

  await t.test("filter-empty does not masquerade as project-empty", async () => {
    await page.locator("#task-filter-keyword").fill("___NO_MATCH___");
    await page.locator("#task-filter-empty").waitFor({ state: "visible" });
    assert.equal(await page.locator("#task-board-empty").isVisible(), false);
    await page.locator("#task-filter-reset").click();
    await page.locator(".tf-task-card").first().waitFor();
    assert.deepEqual(errors, []);
  });
});
