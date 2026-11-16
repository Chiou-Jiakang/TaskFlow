"use strict";

// M3-C2：使用 Microsoft Edge 進行真實瀏覽器端對端測試。
// 使用 :memory: SQLite，不會修改正式的 data/taskflow.db。

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");

const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");

test("M3-C2 Microsoft Edge browser E2E", { timeout: 120000 }, async (t) => {
  // 一、建立隔離的測試資料庫與伺服器
  const db = openDatabase(":memory:");
  initializeSchema(db);

  const server = createApp({ database: db }).listen(0, "127.0.0.1");

  let browser = null;
  let context = null;
  let guestContext = null;

  // 測試結束後釋放所有資源
  t.after(async () => {
    if (guestContext) await guestContext.close();
    if (context) await context.close();
    if (browser) await browser.close();

    await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  await once(server, "listening");

  // 自動取得系統分配的 Port，避免占用 3000
  const base = `http://127.0.0.1:${server.address().port}`;

  // 二、啟動已安裝的 Microsoft Edge
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
  });

  context = await browser.newContext({ baseURL: base });
  const page = await context.newPage();

  // 蒐集未處理的前端 JavaScript 錯誤
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  // 測試資料僅存放在記憶體資料庫中
  const name = "M3C2 Tester";
  const email = "m3c2@example.test";
  const password = "M3C2!IndependentPassword2026";
  const projectName = "M3C2 端對端測試專案";

  // Test 1：未登入保護
  await t.test("匿名進入首頁會導向登入頁", async () => {
    await page.goto("/");
    await page.waitForURL(`${base}/auth.html`);

    assert.equal(await page.locator("#login-form").isVisible(), true);
  });

  // Test 2：帳號註冊
  await t.test("註冊表單正常送出並返回登入畫面", async () => {
    await page.locator("#show-register").click();

    assert.equal(await page.locator("#register-form").isVisible(), true);

    await page.locator("#register-name").fill(name);
    await page.locator("#register-email").fill(email);
    await page.locator("#register-password").fill(password);
    await page.locator("#register-confirm").fill(password);

    await page.locator('#register-form button[type="submit"]').click();

    await page.locator("#login-form").waitFor({
      state: "visible",
    });

    await page.getByText("帳號已建立，請使用剛才的密碼登入。").waitFor();
  });

  // Test 3：錯誤密碼、正確登入與 Cookie
  await t.test("錯誤密碼被拒絕；正確登入建立 HttpOnly Cookie", async () => {
    await page.locator("#login-email").fill(email);

    await page.locator("#login-password").fill("ThisIsNotThePassword2026!");

    await page.locator('#login-form button[type="submit"]').click();

    await page.waitForFunction(() =>
      document
        .querySelector("#auth-message")
        ?.textContent?.includes("Email 或密碼不正確"),
    );

    // 改用正確密碼登入
    await page.locator("#login-password").fill(password);

    await Promise.all([
      page.waitForURL(`${base}/`),
      page.locator('#login-form button[type="submit"]').click(),
    ]);

    await page.locator("body.auth-ready").waitFor();

    assert.equal(await page.locator("#user-display").textContent(), name);

    // Cookie 由瀏覽器管理，不輸出 Token
    const session = (await context.cookies(base)).find(
      (cookie) => cookie.name === "taskflow_session",
    );

    assert.ok(session, "登入後應有 Session Cookie");
    assert.equal(session.httpOnly, true);
    assert.equal(session.sameSite, "Strict");
  });

  // Test 4：不同瀏覽器 Session 的資料隔離
  await t.test("另一個獨立瀏覽器 Session 不能讀取專案", async () => {
    guestContext = await browser.newContext({
      baseURL: base,
    });

    const guest = await guestContext.newPage();

    await guest.goto("/");
    await guest.waitForURL(`${base}/auth.html`);

    const response = await guestContext.request.get(`${base}/api/projects`);

    assert.equal(response.status(), 401);
  });

  // Test 5：專案建立及重新整理後的持久化
  await t.test("專案成功建立且重新整理後仍然存在", async () => {
    await page.locator("#project-name").fill(projectName);

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url() === `${base}/api/projects` && r.request().method() === "POST",
      ),

      page.locator('#project-create button[type="submit"]').click(),
    ]);

    assert.equal(response.status(), 201);

    await page
      .locator("#project-list")
      .getByText(projectName, { exact: true })
      .waitFor();

    // 重新整理，檢查 Session 與專案
    await page.reload();

    await page.locator("body.auth-ready").waitFor();

    await page
      .locator("#project-list")
      .getByText(projectName, { exact: true })
      .waitFor();

    assert.equal(await page.locator("#user-display").textContent(), name);
  });

  // Test 6：登出及 Session 撤銷
  await t.test("登出撤銷 Session，無法再讀取私人專案", async () => {
    await page.locator("#logout-button").click();

    await page.waitForURL(`${base}/auth.html`);

    const response = await context.request.get(`${base}/api/projects`);

    assert.equal(response.status(), 401);

    // 登出後直接進入首頁應再次跳轉登入頁
    await page.goto("/");
    await page.waitForURL(`${base}/auth.html`);
  });

  // Test 7：前端 JavaScript 錯誤檢查
  await t.test("整體操作沒有未處理的 JavaScript 頁面錯誤", () => {
    assert.deepEqual(pageErrors, []);
  });
});
