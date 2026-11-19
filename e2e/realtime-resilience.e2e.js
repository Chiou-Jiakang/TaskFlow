"use strict";

// TaskFlow M7-D：多人即時協作、安全隔離、版本衝突、重連及撤權驗收。
// 只使用 :memory: SQLite、隨機 127.0.0.1 Port、example.test 測試帳號。
// 不讀寫 data/taskflow.db；不依賴任何線上帳戶或 GitHub。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { io: connectSocket } = require("socket.io-client");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { attachRealtime } = require("../server/realtime-hub");

const PASSWORD = "M7D!IsolatedTestOnly2026";
const USERS = {
  owner: { displayName: "M7D Owner", email: "m7d-owner@example.test" },
  admin: { displayName: "M7D Admin", email: "m7d-admin@example.test" },
  member: { displayName: "M7D Member", email: "m7d-member@example.test" },
  outsider: { displayName: "M7D Outsider", email: "m7d-outsider@example.test" },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, explanation, timeoutMs = 6000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() <= end) {
    if (await check()) return;
    await sleep(35);
  }
  assert.fail(`等待逾時：${explanation}`);
}
function taskCard(page, name) {
  return page.locator(".tf-task-card").filter({ has: page.locator("h4", { hasText: name }) });
}
async function boardReady(page) {
  await page.locator("#task-realtime-status[data-kind='success']").waitFor({ timeout: 12000 });
  await page.waitForFunction(() => document.querySelector("#task-message")?.textContent?.includes("已載入"), null, { timeout: 12000 });
}

// 目的在驗證真實瀏覽器 + REST + Socket 行為，並非以人工推送假事件騙過測試。
test("M7-D Microsoft Edge 多人協作／隔離／衝突／撤權整合驗收", { timeout: 125000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const httpServer = app.listen(0, "127.0.0.1");
  let hub = null;
  let browser = null;
  let base = "";
  const contexts = {};
  const pages = {};
  const probes = [];
  const pageErrors = [];
  const ids = {};
  let projectA = null;
  let projectB = null;
  let taskId = null;
  let memberProbe = null;
  let adminProbe = null;

  // 在任何可能失敗的登入／註冊／API 前註冊，避免出錯後 Node.js 長時間卡住。
  t.after(async () => {
    for (const socket of probes) socket.disconnect();
    await Promise.allSettled(Object.values(contexts).map((context) => context.close()));
    if (browser) await browser.close().catch(() => {});
    if (hub) await new Promise((resolve) => hub.io.close(resolve));
    if (httpServer.listening) await new Promise((resolve) => httpServer.close(resolve));
    db.close();
  });

  await once(httpServer, "listening");
  base = `http://127.0.0.1:${httpServer.address().port}`;
  hub = attachRealtime(httpServer, db);
  app.locals.publishProjectChanged = hub.publishProjectChanged;
  browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const role of Object.keys(USERS)) {
    contexts[role] = await browser.newContext({ baseURL: base });
    pages[role] = await contexts[role].newPage();
    pages[role].on("pageerror", (error) => pageErrors.push(`${role}: ${error.message}`));
  }

  async function api(role, method, pathname, data) {
    const headers = { Origin: base };
    if (!["GET", "HEAD"].includes(method)) {
      const res = await contexts[role].request.get(`${base}/api/auth/me`);
      if (res.status() === 200) {
        const session = await res.json();
        headers["X-TaskFlow-CSRF"] = session.csrfToken;
      }
    }
    const options = { headers, ...(data === undefined ? {} : { data }) };
    return contexts[role].request[method.toLowerCase()](`${base}${pathname}`, options);
  }
  async function expectResponse(response, expected, label) {
    const actual = response.status();
    let body = "";
    if (actual !== expected) body = (await response.text()).slice(0, 350);
    assert.equal(actual, expected, `${label}：${body}`);
    return expected === 204 ? null : response.json();
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
  async function connectProbe(role) {
    const cookies = await contexts[role].cookies(base);
    const cookie = cookies.find((item) => item.name === "taskflow_session");
    assert.ok(cookie?.httpOnly, `${role} 必須有 HttpOnly Session`);
    const socket = connectSocket(base, {
      transports: ["websocket"], forceNew: true, reconnection: false,
      autoConnect: false, timeout: 5000,
      extraHeaders: { Origin: base, Cookie: `taskflow_session=${cookie.value}` },
    });
    socket.changes = [];
    socket.revocations = [];
    socket.on("project:changed", (event) => socket.changes.push(event));
    socket.on("project:access-revoked", (event) => socket.revocations.push(event));
    probes.push(socket);
    const connected = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${role} Socket 連線逾時`)), 6000);
      socket.once("connect", () => { clearTimeout(timer); resolve(); });
      socket.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
    });
    socket.connect();
    await connected;
    return socket;
  }
  async function join(socket, id) {
    return socket.timeout(3000).emitWithAck("project:join", { projectId: id });
  }
  async function currentTask(role = "owner") {
    const response = await api(role, "GET", `/api/projects/${projectA}/tasks/${taskId}`);
    return (await expectResponse(response, 200, "讀取任務" )).task;
  }
  async function createTask(role, projectId, title, extras = {}) {
    const response = await api(role, "POST", `/api/projects/${projectId}/tasks`, { title, ...extras });
    const data = await expectResponse(response, 201, "建立任務");
    return data.task;
  }

  await t.test("四組 Session、兩個專案與 Socket Room 權限", async () => {
    for (const [role, user] of Object.entries(USERS)) {
      const response = await contexts.owner.request.post(`${base}/api/auth/register`, {
        headers: { Origin: base }, data: { ...user, password: PASSWORD },
      });
      const body = await expectResponse(response, 201, `註冊 ${role}`);
      ids[role] = body.user.id;
    }
    await login("owner");
    projectA = (await expectResponse(await api("owner", "POST", "/api/projects", {
      name: "M7D Project A",
    }), 201, "建立 Project A")).project.id;
    projectB = (await expectResponse(await api("owner", "POST", "/api/projects", {
      name: "M7D Project B",
    }), 201, "建立 Project B")).project.id;
    for (const role of ["admin", "member"]) {
      const list = await expectResponse(await api("owner", "GET", `/api/projects/${projectA}/members`), 200, "讀成員版本");
      await expectResponse(await api("owner", "POST", `/api/projects/${projectA}/members`, {
        version: list.version, email: USERS[role].email, role,
      }), 201, `邀請 ${role}`);
    }
    for (const role of ["admin", "member", "outsider"]) await login(role);
    await pages.owner.reload();
    await pages.owner.locator("body.auth-ready").waitFor();
    for (const role of ["owner", "admin", "member"]) {
      await pages[role].locator("#task-project-select").selectOption(String(projectA));
      await boardReady(pages[role]);
    }
    memberProbe = await connectProbe("member");
    adminProbe = await connectProbe("admin");
    assert.deepEqual(await join(memberProbe, projectA), { ok: true, projectId: projectA, role: "member" });
    assert.deepEqual(await join(adminProbe, projectA), { ok: true, projectId: projectA, role: "admin" });
    assert.deepEqual(await join(memberProbe, projectB), { ok: false, code: "NOT_FOUND" });
    const outsiderProbe = await connectProbe("outsider");
    assert.deepEqual(await join(outsiderProbe, projectA), { ok: false, code: "NOT_FOUND" });
    assert.equal(await (await api("outsider", "GET", `/api/projects/${projectA}/tasks`)).status(), 404);
  });

  await t.test("Owner 新增：Admin、Member 不重新整理立即同步", async () => {
    const page = pages.owner;
    await page.locator("#task-title").fill("M7D shared work");
    await page.locator("#task-assignee").selectOption(String(ids.member));
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/projects/${projectA}/tasks`),
      page.locator("#task-submit").click(),
    ]);
    assert.equal(response.status(), 201);
    taskId = (await response.json()).task.id;
    for (const role of ["admin", "member"]) {
      await taskCard(pages[role], "M7D shared work").waitFor({ timeout: 10000 });
    }
    await until(() => memberProbe.changes.some((e) => e.resource === "task" && e.action === "created" && e.resourceId === taskId), "Member Socket 建立通知");
  });

  await t.test("Member 更改自己任務狀態：Owner、Admin 即時更新", async () => {
    await taskCard(pages.member, "M7D shared work").locator("select").selectOption("in_progress");
    for (const role of ["owner", "admin"]) {
      await pages[role].locator('.kanban-column[data-status="progress"] .tf-task-card')
        .filter({ hasText: "M7D shared work" }).waitFor({ timeout: 10000 });
    }
    assert.equal((await currentTask()).status, "in_progress");
  });

  await t.test("同版本平行 PATCH 必須 1 個 200、1 個 409；只送一次成功通知", async () => {
    const beforeTask = await currentTask();
    const baseline = memberProbe.changes.filter((e) => e.resource === "task" && e.action === "updated" && e.resourceId === taskId).length;
    const requests = await Promise.all([
      api("owner", "PATCH", `/api/projects/${projectA}/tasks/${taskId}`, { version: beforeTask.version, priority: "high" }),
      api("admin", "PATCH", `/api/projects/${projectA}/tasks/${taskId}`, { version: beforeTask.version, description: "parallel writer" }),
    ]);
    assert.deepEqual(requests.map((r) => r.status()).sort(), [200, 409]);
    const afterTask = await currentTask();
    assert.equal(afterTask.version, beforeTask.version + 1, "只有成功的交易能增加版本");
    await until(() => memberProbe.changes.filter((e) => e.resource === "task" && e.action === "updated" && e.resourceId === taskId).length >= baseline + 1, "200 異動通知");
    await sleep(180);
    assert.equal(memberProbe.changes.filter((e) => e.resource === "task" && e.action === "updated" && e.resourceId === taskId).length, baseline + 1);
  });

  await t.test("跨專案事件隔離、Member 跨專案 REST 被拒", async () => {
    await sleep(150);
    const baseline = memberProbe.changes.length;
    await createTask("owner", projectB, "M7D project B confidential");
    await sleep(200);
    assert.equal(memberProbe.changes.length, baseline, "Project B 事件不可送往 Project A Room");
    assert.equal((await api("member", "GET", `/api/projects/${projectB}/tasks`)).status(), 404);
    assert.equal((await api("outsider", "GET", `/api/projects/${projectB}/tasks`)).status(), 404);
  });

  await t.test("Admin 原子跨欄移動；Member 無權排序；重新整理後資料仍存在", async () => {
    const other = await createTask("owner", projectA, "M7D sortable second");
    await taskCard(pages.admin, "M7D sortable second").waitFor({ timeout: 10000 });
    const deny = await api("member", "PATCH", `/api/projects/${projectA}/tasks/${other.id}/move`, {
      version: other.version, status: "in_progress", index: 0,
    });
    assert.equal(deny.status(), 403, "Member 不可使用排序 API");
    const moved = await api("admin", "PATCH", `/api/projects/${projectA}/tasks/${other.id}/move`, {
      version: other.version, status: "in_progress", index: 0,
    });
    await expectResponse(moved, 200, "Admin 排序");
    for (const role of ["owner", "member"]) {
      await pages[role].locator('.kanban-column[data-status="progress"] .tf-task-card')
        .filter({ hasText: "M7D sortable second" }).waitFor({ timeout: 10000 });
    }
    await pages.owner.reload();
    await pages.owner.locator("body.auth-ready").waitFor();
    await pages.owner.locator("#task-project-select").selectOption(String(projectA));
    await boardReady(pages.owner);
    const titles = await pages.owner.locator('.kanban-column[data-status="progress"] .tf-task-card h4').allTextContents();
    assert.deepEqual(titles, ["M7D sortable second", "M7D shared work"]);
    const tasks = (await expectResponse(await api("owner", "GET", `/api/projects/${projectA}/tasks`), 200, "重讀任務資料")).tasks;
    const ordered = tasks.filter((item) => item.status === "in_progress").sort((a, b) => a.position - b.position);
    assert.deepEqual(ordered.map((item) => item.title), titles);
  });

  await t.test("撤銷 Member：Socket 立即撤權、舊 Room 不再送通知", async () => {
    const memberList = await expectResponse(await api("owner", "GET", `/api/projects/${projectA}/members`), 200, "查詢最新成員版本");
    await expectResponse(await api("owner", "DELETE", `/api/projects/${projectA}/members/${ids.member}?version=${memberList.version}`), 204, "Owner 移除 Member");
    await until(() => memberProbe.revocations.some((e) => e.projectId === projectA), "Member 收到撤銷訊息");
    await pages.member.waitForFunction(() => window.TaskRealtime?.snapshot().desiredProject === null, null, { timeout: 10000 });
    assert.equal((await api("member", "GET", `/api/projects/${projectA}/tasks`)).status(), 404);
    assert.deepEqual(await join(memberProbe, projectA), { ok: false, code: "NOT_FOUND" });
    await sleep(130);
    const previous = memberProbe.changes.length;
    await createTask("owner", projectA, "M7D restricted after remove");
    await sleep(230);
    assert.equal(memberProbe.changes.length, previous, "已撤銷成員不可再收到專案事件");
  });

  await t.test("Admin 登出後 HTTP Session 失效，後續推播無法再交付", async () => {
    await expectResponse(await api("admin", "POST", "/api/auth/logout"), 204, "Admin 登出");
    assert.equal((await api("admin", "GET", `/api/projects/${projectA}/tasks`)).status(), 401);
    const prior = adminProbe.changes.length;
    await createTask("owner", projectA, "M7D after admin logout");
    await until(() => !adminProbe.connected, "已登出 Socket 被強制斷開", 5000);
    assert.equal(adminProbe.changes.length, prior, "已登出帳號不可取得異動推播");
  });

  await t.test("所有瀏覽器沒有未處理的 JavaScript 錯誤", () => {
    assert.deepEqual(pageErrors, []);
  });
});
