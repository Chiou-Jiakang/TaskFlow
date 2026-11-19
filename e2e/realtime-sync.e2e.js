"use strict";

// M7-C：Edge 雙帳號前端即時同步驗證；:memory: 資料庫 + 隨機本機 Port。
// 依賴專案已安裝的 playwright-core、socket.io。絕不修改 data/taskflow.db。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

const PASSWORD = "M7C!IsolatedLocalTest2026";
const USERS = {
  owner: { displayName: "M7C Owner", email: "m7c-owner@example.test" },
  member: { displayName: "M7C Member", email: "m7c-member@example.test" },
};

async function waitRealtime(page) {
  await page.locator("#task-realtime-status[data-kind='success']").waitFor({ timeout: 12000 });
  await page.waitForFunction(() => document.querySelector("#task-message")?.textContent?.includes("已載入"));
}

function findCard(page, title) {
  return page.locator(".tf-task-card").filter({ has: page.locator("h4", { hasText: title }) });
}

test("M7-C Edge Owner / Member 即時同步、移動與重連補抓", { timeout: 90000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let hub = null;
  let browser = null;
  const contexts = {};
  const pages = {};
  const errors = [];
  let base;
  let projectId;
  let memberId;

  // 註冊清理必須在初始化之初，避免任一步驟失敗造成 Node.js 無法退出。
  t.after(async () => {
    for (const context of Object.values(contexts)) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (hub) await new Promise((resolve) => hub.io.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    db.close();
  });

  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
  hub = attachRealtime(server, db);
  app.locals.publishProjectChanged = hub.publishProjectChanged;
  browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const role of Object.keys(USERS)) {
    contexts[role] = await browser.newContext({ baseURL: base });
    pages[role] = await contexts[role].newPage();
    pages[role].on("pageerror", (error) => errors.push(`${role}: ${error.message}`));
  }

  async function login(role) {
    const page = pages[role];
    await page.goto("/auth.html");
    await page.locator("#login-email").fill(USERS[role].email);
    await page.locator("#login-password").fill(PASSWORD);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
  }

  await t.test("建立 Owner 與 Member 的獨立登入與專案權限", async () => {
    for (const [role, data] of Object.entries(USERS)) {
      const response = await contexts.owner.request.post(`${base}/api/auth/register`, {
        headers: { Origin: base }, data: { ...data, password: PASSWORD },
      });
      assert.equal(response.status(), 201, `註冊 ${role}`);
      if (role === "member") memberId = (await response.json()).user.id;
    }
    await login("owner");
    const owner = pages.owner;
    await owner.locator("#project-name").fill("M7-C Live Sync");
    const [created] = await Promise.all([
      owner.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/projects"),
      owner.locator('#project-create button[type="submit"]').click(),
    ]);
    assert.equal(created.status(), 201);
    projectId = (await created.json()).project.id;
    await owner.goto(`/members.html?projectId=${projectId}`);
    await owner.locator("body.auth-ready").waitFor();
    await owner.locator("#member-email").fill(USERS.member.email);
    await owner.locator("#member-role").selectOption("member");
    const [added] = await Promise.all([
      owner.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/projects/${projectId}/members`),
      owner.locator('#member-add-form button[type="submit"]').click(),
    ]);
    assert.equal(added.status(), 201);
    await owner.goto("/");
    await owner.locator("body.auth-ready").waitFor();
    await login("member");
    for (const page of Object.values(pages)) {
      await page.locator("#task-project-select").selectOption(String(projectId));
      await waitRealtime(page);
    }
    assert.equal(await pages.member.locator("#task-my-role").textContent(), "member");
  });

  await t.test("Owner 新增任務後 Member 不重新整理即可看到", async () => {
    const owner = pages.owner;
    const member = pages.member;
    await owner.locator("#task-title").fill("M7C instant task");
    await owner.locator("#task-assignee").selectOption(String(memberId));
    const [created] = await Promise.all([
      owner.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/projects/${projectId}/tasks`),
      owner.locator("#task-submit").click(),
    ]);
    assert.equal(created.status(), 201);
    await findCard(member, "M7C instant task").waitFor({ timeout: 10000 });
    assert.equal(await member.locator("#total-count").textContent(), "1");
  });

  await t.test("Member 修改自己任務的狀態，Owner 自動同步到進行中", async () => {
    const member = pages.member;
    const card = findCard(member, "M7C instant task");
    await card.locator("select").selectOption("in_progress");
    const moved = pages.owner.locator('.kanban-column[data-status="progress"] .tf-task-card')
      .filter({ hasText: "M7C instant task" });
    await moved.waitFor({ timeout: 12000 });
    assert.equal(await pages.owner.locator("#progress-count").textContent(), "1");
  });

  await t.test("重新建立 Socket 訂閱後 REST 補抓離線期間新增資料", async () => {
    const member = pages.member;
    await member.evaluate(() => window.TaskRealtime.stop());
    await pages.owner.locator("#task-title").fill("M7C missed while offline");
    await pages.owner.locator("#task-submit").click();
    await findCard(pages.owner, "M7C missed while offline").waitFor();
    await member.evaluate((id) => {
      window.TaskRealtime.setProject(id);
      window.TaskRealtime.start();
    }, projectId);
    await waitRealtime(member);
    await findCard(member, "M7C missed while offline").waitFor({ timeout: 12000 });
  });

  await t.test("無未處理頁面錯誤，Member 不可拖曳排序", async () => {
    const member = pages.member;
    assert.equal(await findCard(member, "M7C instant task").getAttribute("draggable"), "false");
    assert.deepEqual(errors, []);
  });
});
