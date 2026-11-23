"use strict";

// TaskFlow M9-C2｜跨功能一致性驗收
// 使用隔離 :memory: SQLite、隨機 loopback port 和 example.test 帳號。
// 僅用 REST API 進行資料異動，由真正的 Socket.IO 事件驅動兩個 Edge 頁面。
// 不觸碰 data/taskflow.db，也不使用固定 port、真實帳戶或既有 Session。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

const PASSWORD = "M9C2!IsolatedExampleTest2026";
const ACCOUNTS = {
  owner: { email: "m9c2-owner@example.test", displayName: "M9C2 Owner" },
  member: { email: "m9c2-member@example.test", displayName: "M9C2 Member" },
};

function card(page, title) {
  return page.locator(".tf-task-card").filter({
    has: page.locator("h4", { hasText: title }),
  });
}

async function expectText(page, id, expected, timeout = 12000) {
  await page.waitForFunction(
    ({ id, expected }) => document.getElementById(id)?.textContent === expected,
    { id, expected },
    { timeout },
  );
}

async function waitBoard(page, projectId, total) {
  await page.locator("#task-realtime-status[data-kind='success']")
    .waitFor({ timeout: 12000 });
  await page.waitForFunction(
    ({ projectId, total }) =>
      document.getElementById("task-project-select")?.value === String(projectId) &&
      document.getElementById("task-filter-count")?.textContent ===
        `顯示 ${total} / ${total} 筆任務` &&
      document.querySelector(".board-section")?.getAttribute("aria-busy") === "false",
    { projectId, total }, { timeout: 12000 },
  );
}

test("M9-C2 Edge：搜尋、Dashboard、多人即時同步與跨專案隔離", { timeout: 105000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  let hub = null;
  let browser = null;
  const contexts = {};
  const pages = {};
  const errors = [];
  let base = "";
  let ownerCsrf = "";
  let ownerId = null;
  let memberId = null;
  let projectA = null;
  let projectB = null;

  t.after(async () => {
    await Promise.allSettled(Object.values(contexts).map((ctx) => ctx.close()));
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

  for (const role of Object.keys(ACCOUNTS)) {
    contexts[role] = await browser.newContext({ baseURL: base });
    pages[role] = await contexts[role].newPage();
    pages[role].on("pageerror", (error) => errors.push(`${role}: ${error.message}`));
  }

  const owner = pages.owner;
  const member = pages.member;
  const ownerRequest = contexts.owner.request;
  const headers = { Origin: base };

  async function checked(response, status, label) {
    const actual = response.status();
    if (actual !== status) {
      const body = (await response.text()).slice(0, 450);
      assert.equal(actual, status, `${label}: ${body}`);
    }
    return response.json();
  }

  async function ownerGet(pathname) {
    return checked(await ownerRequest.get(`${base}${pathname}`), 200, pathname);
  }

  async function ownerPost(pathname, data) {
    const response = await ownerRequest.post(`${base}${pathname}`, {
      headers: { ...headers, "X-TaskFlow-CSRF": ownerCsrf }, data,
    });
    return checked(response, 201, pathname);
  }

  async function login(role) {
    const page = pages[role];
    await page.goto("/auth.html");
    await page.locator("#login-email").fill(ACCOUNTS[role].email);
    await page.locator("#login-password").fill(PASSWORD);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/"),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator("body.auth-ready").waitFor();
  }

  await t.test("建立隔離帳號、專案與兩筆基準任務", async () => {
    for (const [role, account] of Object.entries(ACCOUNTS)) {
      const result = await ownerRequest.post(`${base}/api/auth/register`, {
        headers, data: { ...account, password: PASSWORD },
      });
      const response = await checked(result, 201, `註冊 ${role}`);
      if (role === "owner") ownerId = response.user.id;
      else memberId = response.user.id;
    }
    await login("owner");
    ownerCsrf = (await ownerGet("/api/auth/me")).csrfToken;
    assert.match(ownerCsrf, /^[0-9a-f]{64}$/);
    projectA = (await ownerPost("/api/projects", { name: "M9C2 Shared Project" })).project.id;
    projectB = (await ownerPost("/api/projects", { name: "M9C2 Private Project" })).project.id;

    const list = await ownerGet(`/api/projects/${projectA}/members`);
    await ownerPost(`/api/projects/${projectA}/members`, {
      version: list.version, email: ACCOUNTS.member.email, role: "member",
    });
    await ownerPost(`/api/projects/${projectA}/tasks`, {
      title: "Alpha high priority", description: "target search", status: "todo", priority: "high",
    });
    await ownerPost(`/api/projects/${projectA}/tasks`, {
      title: "Beta assigned", status: "todo", priority: "medium", assigneeId: memberId,
    });

    await login("member");
    await owner.reload();
    await owner.locator("body.auth-ready").waitFor();
    await owner.locator("#task-project-select").selectOption(String(projectA));
    await member.locator("#task-project-select").selectOption(String(projectA));
    await Promise.all([waitBoard(owner, projectA, 2), waitBoard(member, projectA, 2)]);
    await expectText(owner, "m9-rate", "0%");
    await expectText(member, "m9-rate", "0%");
    assert.equal(await owner.locator(".tf-task-card").count(), 2);
    assert.equal(await member.locator(".tf-task-card").count(), 2);
    assert.ok(Number.isSafeInteger(ownerId) && ownerId > 0);
  });

  await t.test("Owner 使用組合篩選，Member 異動後統計與篩選仍一致", async () => {
    await owner.locator("#task-filter-keyword").fill("Alpha");
    await owner.locator("#task-filter-priority").selectOption("high");
    await owner.locator("#task-filter-status").selectOption("todo");
    await expectText(owner, "task-filter-count", "顯示 1 / 2 筆任務");
    assert.equal(await owner.locator(".tf-task-card").count(), 1);

    // 使用真實 Member 權限修改自己被指派的任務，避免用手動 Socket 訊息假裝同步。
    await card(member, "Beta assigned").locator("select").selectOption("done");
    await member.locator('.kanban-column[data-status="done"] .tf-task-card')
      .filter({ hasText: "Beta assigned" }).waitFor({ timeout: 12000 });
    await Promise.all([
      expectText(owner, "m9-rate", "50%"),
      expectText(member, "m9-rate", "50%"),
    ]);
    await expectText(owner, "task-filter-count", "顯示 1 / 2 筆任務");
    assert.equal(await owner.locator("#task-filter-keyword").inputValue(), "Alpha");
    assert.equal(await owner.locator("#task-filter-priority").inputValue(), "high");
    assert.equal(await owner.locator("#total-count").innerText(), "2");
    assert.equal(await owner.locator("#done-count").innerText(), "1");
  });

  await t.test("Owner REST 新增任務，另一頁的搜尋結果與兩邊 Dashboard 即時更新", async () => {
    await ownerPost(`/api/projects/${projectA}/tasks`, {
      title: "Alpha followup", status: "todo", priority: "high",
    });
    await Promise.all([
      expectText(owner, "task-filter-count", "顯示 2 / 3 筆任務"),
      expectText(member, "task-filter-count", "顯示 3 / 3 筆任務"),
      expectText(owner, "m9-rate", "33%"),
      expectText(member, "m9-rate", "33%"),
    ]);
    await card(owner, "Alpha followup").waitFor();
    await card(member, "Alpha followup").waitFor();
    assert.equal(await owner.locator("#total-count").innerText(), "3");
    assert.equal(await owner.locator(".tf-task-card").count(), 2);
    assert.equal(await member.locator(".tf-task-card").count(), 3);
    assert.equal(await owner.locator('.tf-task-card[draggable="true"]').count(), 0);
  });

  await t.test("Member 再次改變任務狀態，Owner 的全量統計正確重算", async () => {
    await card(member, "Beta assigned").locator("select").selectOption("in_progress");
    await member.locator('.kanban-column[data-status="progress"] .tf-task-card')
      .filter({ hasText: "Beta assigned" }).waitFor({ timeout: 12000 });
    await Promise.all([
      expectText(owner, "m9-rate", "0%"),
      expectText(member, "m9-rate", "0%"),
    ]);
    await expectText(owner, "task-filter-count", "顯示 2 / 3 筆任務");
    assert.equal(await owner.locator("#m9-high").innerText(), "2");
  });

  await t.test("切換私人專案時清除篩選，其他專案事件不污染當前畫面", async () => {
    await owner.locator("#task-project-select").selectOption(String(projectB));
    await expectText(owner, "task-filter-count", "顯示 0 / 0 筆任務");
    await expectText(owner, "m9-rate", "0%");
    assert.equal(await owner.locator("#task-filter-keyword").inputValue(), "");
    assert.equal(await owner.locator("#task-filter-priority").inputValue(), "");
    await owner.waitForFunction((id) =>
      document.getElementById("m9-analytics-scope")?.textContent?.includes(id),
    "M9C2 Private Project", { timeout: 12000 });

    await ownerPost(`/api/projects/${projectA}/tasks`, {
      title: "Alpha only in Project A", status: "todo", priority: "high",
    });
    await expectText(member, "task-filter-count", "顯示 4 / 4 筆任務");
    await card(member, "Alpha only in Project A").waitFor();
    assert.equal(await owner.locator("#task-filter-count").innerText(), "顯示 0 / 0 筆任務");
    assert.equal(await owner.locator("#m9-rate").innerText(), "0%");
    assert.equal(await owner.locator(".tf-task-card").count(), 0);
    assert.equal(await owner.locator("#task-board-empty").isVisible(), true);
    assert.equal((await contexts.member.request.get(`${base}/api/projects/${projectB}/tasks`)).status(), 404);

    await owner.locator("#task-project-select").selectOption(String(projectA));
    await expectText(owner, "task-filter-count", "顯示 4 / 4 筆任務");
    assert.equal(await owner.locator("#task-filter-keyword").inputValue(), "");
    assert.equal(await owner.locator("#total-count").innerText(), "4");
  });

  await t.test("兩個 Edge 分頁均無未處理 JavaScript 錯誤", async () => {
    assert.deepEqual(errors, []);
  });
});
