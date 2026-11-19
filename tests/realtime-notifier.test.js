"use strict";

// M7-B：資料異動推播測試。所有資料庫與 HTTP Port 都是隔離的測試環境。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once, EventEmitter } = require("node:events");
const { io: connectClient } = require("socket.io-client");
const { createRealtimeNotifier, validateChange } = require("../server/realtime-notifier");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { createAuthRepository, initializeAuthSchema } = require("../server/auth-foundation");
const { createProjectRepository } = require("../server/project-repository");
const { attachRealtime } = require("../server/realtime-hub");

function response(status = 200, mutation = null) {
  const res = new EventEmitter();
  res.statusCode = status;
  res.locals = { taskflowRealtimeChange: mutation };
  return res;
}

test("M7-B 通知器基礎防護", async (t) => {
  await t.test("驗證事件欄位，拒絕額外資料、非法 ID 與未知事件", () => {
    assert.deepEqual(validateChange({ projectId: 2, resource: "task", action: "moved", resourceId: 3 }), {
      projectId: 2, change: { resource: "task", action: "moved", resourceId: 3 },
    });
    assert.equal(validateChange({ projectId: "2", resource: "task", action: "created" }), null);
    assert.equal(validateChange({ projectId: 2, resource: "secret", action: "created" }), null);
    assert.equal(validateChange({ projectId: 2, resource: "task", action: "created", email: "x" }), null);
    assert.equal(validateChange({ projectId: 2, resource: "task", action: "created", version: 0 }), null);
  });
  await t.test("非 2xx、沒有成功註記或 409 不會推播", () => {
    const emitted = [];
    const mw = createRealtimeNotifier(() => (id, event) => emitted.push([id, event]));
    for (const [status, mutation] of [
      [400, { projectId: 1, resource: "task", action: "created" }],
      [409, { projectId: 1, resource: "task", action: "updated" }],
      [500, { projectId: 1, resource: "task", action: "deleted" }],
      [200, null],
    ]) {
      const res = response(status, mutation);
      mw({}, res, () => {});
      res.emit("finish");
    }
    assert.equal(emitted.length, 0);
  });
  await t.test("200、201、204 成功後才推播，重複 finish 不重送", () => {
    const emitted = [];
    const mw = createRealtimeNotifier(() => (id, event) => emitted.push({ id, event }));
    for (const status of [200, 201, 204]) {
      const res = response(status, { projectId: 7, resource: "task", action: "updated", version: 2 });
      mw({}, res, () => {});
      assert.equal(emitted.length, [200,201,204].indexOf(status));
      res.emit("finish");
      res.emit("finish");
    }
    assert.equal(emitted.length, 3);
    assert.deepEqual(emitted[0], { id: 7, event: { resource: "task", action: "updated", version: 2 } });
  });
  await t.test("推播失敗不改寫已完成的 HTTP 狀態", () => {
    const errors = [];
    const mw = createRealtimeNotifier(() => () => { throw new Error("Socket down"); }, {
      reportError: (...args) => errors.push(args),
    });
    const res = response(204, { projectId: 4, resource: "member", action: "deleted" });
    mw({}, res, () => {});
    assert.doesNotThrow(() => res.emit("finish"));
    assert.equal(res.statusCode, 204);
    assert.equal(errors.length, 1);
  });
});

// 測試真實 REST -> Socket.IO -> 專案 Room。請勿連接正式 data/taskflow.db。
test("M7-B REST 成功寫入才推播（含 Task/Member/Project/Move）", { timeout: 25000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  // M7-B tests inject trusted actor IDs, so createApp skips auth context setup.
  // Create the session table explicitly before issuing socket-login sessions.
  initializeAuthSchema(db);
  const createUser = db.prepare("INSERT INTO users(email, password_hash, display_name) VALUES(?, 'TEST_ONLY', ?)");
  const ids = {
    owner: Number(createUser.run("m7b-owner@example.test", "M7B Owner").lastInsertRowid),
    member: Number(createUser.run("m7b-member@example.test", "M7B Member").lastInsertRowid),
    outsider: Number(createUser.run("m7b-outsider@example.test", "M7B Outsider").lastInsertRowid),
  };
  const projects = createProjectRepository(db);
  const projectId = projects.create(ids.owner, { name: "M7B Test", description: "Test" }).id;
  const app = createApp({
    database: db,
    // 只在測試中使用既有受信任身分注入；正式環境依然使用 Session + CSRF。
    getAuthenticatedUserId: (req) => Number(req.headers["x-test-actor"]) || null,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const hub = attachRealtime(server, db);
  const clients = [];
  // Register cleanup BEFORE creating sessions or sockets, so an early test
  // assertion/error cannot leave an HTTP server running indefinitely.
  t.after(async () => {
    for (const client of clients) client.disconnect();
    await new Promise((resolve) => hub.io.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const auth = createAuthRepository(db);
  const issued = auth.issueSession(ids.owner);
  const memberToken = auth.issueSession(ids.member);
  const messages = [];
  const published = [];
  app.locals.publishProjectChanged = (id, change) => {
    published.push({ projectId: id, ...change });
    return hub.publishProjectChanged(id, change);
  };
  const socket = connectClient(base, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 3000,
    extraHeaders: { Origin: base, Cookie: `taskflow_session=${issued.token}` },
  });
  clients.push(socket);
  socket.on("project:changed", (event) => messages.push(event));
  await once(socket, "connect");
  assert.deepEqual(await socket.timeout(2500).emitWithAck("project:join", { projectId }), {
    ok: true, projectId, role: "owner",
  });

  async function api(method, path, body, actor = ids.owner) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        "X-Test-Actor": String(actor),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: res.status === 204 ? null : await res.json() };
  }
  async function changed(method, path, body, action, resource) {
    const before = published.length;
    const result = await api(method, path, body);
    assert.ok(result.status >= 200 && result.status < 300, JSON.stringify(result));
    const deadline = Date.now() + 2000;
    while (published.length < before + 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(published.length, before + 1, "寫入成功應發布一次異動");
    assert.equal(published.at(-1).action, action);
    assert.equal(published.at(-1).resource, resource);
    return result;
  }

  const tasksUrl = `/api/projects/${projectId}/tasks`;
  await t.test("Task 建立、修改、移動、刪除都能通知 Room", async () => {
    const created = await changed("POST", tasksUrl, { title: "M7B task" }, "created", "task");
    const id = created.json.task.id;
    assert.equal(created.status, 201);
    const edited = await changed("PATCH", `${tasksUrl}/${id}`, { version: 1, priority: "high" }, "updated", "task");
    assert.equal(edited.json.task.version, 2);
    const before = published.length;
    const stale = await api("PATCH", `${tasksUrl}/${id}`, { version: 1, priority: "low" });
    assert.equal(stale.status, 409);
    assert.equal(published.length, before, "409 不得廣播");
    await changed("PATCH", `${tasksUrl}/${id}/move`, { version: 2, status: "in_progress", index: 0 }, "moved", "task");
    await changed("DELETE", `${tasksUrl}/${id}?version=3`, undefined, "deleted", "task");
    // Socket.IO 在成功 HTTP 回應後非同步處理事件，等待送達。
    await new Promise((resolve, reject) => {
      if (messages.length >= 4) return resolve();
      const timer = setTimeout(() => { socket.off("project:changed", onChange); reject(new Error("事件未送達")); }, 3000);
      function onChange() { if (messages.length >= 4) { clearTimeout(timer); socket.off("project:changed", onChange); resolve(); } }
      socket.on("project:changed", onChange);
    });
    assert.deepEqual(messages.slice(0, 4).map((e) => e.action), ["created", "updated", "moved", "deleted"]);
    assert.ok(messages.every((e) => e.projectId === projectId));
  });

  await t.test("成員變動成功後通知；失敗操作不通知", async () => {
    const url = `/api/projects/${projectId}/members`;
    const memberVersion = projects.get(ids.owner, projectId).version;
    const added = await changed("POST", url, { version: memberVersion, email: "m7b-member@example.test" }, "created", "member");
    const memberSocket = connectClient(base, {
      transports: ["websocket"], forceNew: true, reconnection: false,
      timeout: 3000,
      extraHeaders: { Origin: base, Cookie: `taskflow_session=${memberToken.token}` },
    });
    clients.push(memberSocket);
    await once(memberSocket, "connect");
    assert.deepEqual(await memberSocket.timeout(2500).emitWithAck("project:join", { projectId }), {
      ok: true, projectId, role: "member",
    });
    const changedRole = await changed("PATCH", `${url}/${ids.member}`, { version: added.json.version, role: "admin" }, "updated", "member");
    const revoked = once(memberSocket, "project:access-revoked");
    await changed("DELETE", `${url}/${ids.member}?version=${changedRole.json.version}`, undefined, "deleted", "member");
    assert.deepEqual((await revoked)[0], { projectId });
    const count = published.length;
    const denied = await api("POST", url, { version: 1, email: "m7b-outsider@example.test" }, ids.outsider);
    assert.ok([403, 404].includes(denied.status));
    assert.equal(published.length, count);
  });

  await t.test("Project 修改、建立、刪除不破壞原有 REST 語意", async () => {
    const version = projects.get(ids.owner, projectId).version;
    const updated = await changed("PATCH", `/api/projects/${projectId}`, { version, name: "M7B updated" }, "updated", "project");
    assert.equal(updated.json.project.name, "M7B updated");
    const created = await changed("POST", "/api/projects", { name: "new project" }, "created", "project");
    const newId = created.json.project.id;
    // 新建專案尚無人加入 Room，因此此時僅驗證成功異動有發出通知；M7-C 補上列表同步。
    await changed("DELETE", `/api/projects/${newId}?version=1`, undefined, "deleted", "project");
  });
});
