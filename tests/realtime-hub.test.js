"use strict";

// M7-A：只使用 :memory: SQLite 與隨機本機 Port。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { io: connectClient } = require("socket.io-client");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { createAuthRepository } = require("../server/auth-foundation");
const { createProjectRepository } = require("../server/project-repository");
const { createMemberRepository } = require("../server/member-repository");
const {
  attachRealtime,
  readSessionCookie,
  positiveId,
  originAllowed,
} = require("../server/realtime-hub");

test("M7-A realtime helpers", async (t) => {
  await t.test("拒絕重複 Cookie", () => {
    assert.equal(readSessionCookie("taskflow_session=a; taskflow_session=b"), null);
    assert.equal(readSessionCookie("other=x; taskflow_session=abc"), "abc");
    assert.equal(readSessionCookie("taskflow_session="), null);
  });
  await t.test("專案 ID 必須為安全正整數", () => {
    assert.equal(positiveId(2), 2);
    for (const value of [0, -1, "2", 2.2, Infinity]) {
      assert.equal(positiveId(value), null);
    }
  });
  await t.test("Origin 必須精確同源", () => {
    assert.equal(originAllowed({ headers: { origin: "http://localhost:3000", host: "localhost:3000" } }), true);
    assert.equal(originAllowed({ headers: { origin: "http://evil.test", host: "localhost:3000" } }), false);
    assert.equal(originAllowed({ headers: { host: "localhost:3000" } }), false);
  });
});

test("M7-A Socket.IO session & project rooms", { timeout: 20000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const server = createApp({ database: db }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const hub = attachRealtime(server, db);
  const base = `http://127.0.0.1:${server.address().port}`;
  const clients = [];

  t.after(async () => {
    for (const client of clients) client.disconnect();
    await new Promise((resolve) => hub.io.close(resolve));
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    db.close();
  });

  const createUser = db.prepare(
    "INSERT INTO users(email, password_hash, display_name) VALUES(?, 'TEST_ONLY', ?)"
  );
  const ids = {
    owner: Number(createUser.run("m7-owner@example.test", "M7 Owner").lastInsertRowid),
    member: Number(createUser.run("m7-member@example.test", "M7 Member").lastInsertRowid),
    outsider: Number(createUser.run("m7-outsider@example.test", "M7 Outsider").lastInsertRowid),
  };
  const projects = createProjectRepository(db);
  const memberRepo = createMemberRepository(db);
  const projectId = projects.create(ids.owner, { name: "M7 live", description: "Test" }).id;
  const otherProjectId = projects.create(ids.outsider, { name: "Private", description: "Test" }).id;
  memberRepo.add(ids.owner, projectId, 1, { email: "m7-member@example.test", role: "member" });
  const auth = createAuthRepository(db);
  const tokens = Object.fromEntries(Object.entries(ids).map(([role, id]) =>
    [role, auth.issueSession(id).token]
  ));

  // Browser handshake: Origin + HttpOnly Cookie，沒有 client-controlled actorId。
  function createClient(token, origin = base) {
    const client = connectClient(base, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 2500,
      forceNew: true,
      extraHeaders: {
        Origin: origin,
        ...(token ? { Cookie: `taskflow_session=${token}` } : {}),
      },
    });
    clients.push(client);
    return client;
  }
  async function connected(token, origin = base) {
    const client = createClient(token, origin);
    await Promise.race([
      once(client, "connect"),
      once(client, "connect_error").then(([error]) => Promise.reject(error)),
    ]);
    return client;
  }
  function expectDenied(token, origin = base) {
    return new Promise((resolve, reject) => {
      const client = createClient(token, origin);
      client.once("connect", () => reject(new Error("不應允許連線")));
      client.once("connect_error", () => resolve());
    });
  }
  function ack(client, event, body) {
    return client.timeout(2000).emitWithAck(event, body);
  }

  await t.test("HTTP API 仍可使用", async () => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
  });
  await t.test("匿名 Socket 握手被拒絕", async () => {
    await expectDenied(null);
  });
  await t.test("跨來源握手被拒絕", async () => {
    await expectDenied(tokens.owner, "http://evil.test");
  });

  const owner = await connected(tokens.owner);
  const member = await connected(tokens.member);
  const outsider = await connected(tokens.outsider);

  await t.test("Owner、Member 可加入所屬專案", async () => {
    assert.deepEqual(await ack(owner, "project:join", { projectId }), {
      ok: true, projectId, role: "owner",
    });
    assert.deepEqual(await ack(member, "project:join", { projectId }), {
      ok: true, projectId, role: "member",
    });
  });
  await t.test("非成員不得加入或讀取其他專案 Room", async () => {
    assert.deepEqual(await ack(outsider, "project:join", { projectId }), {
      ok: false, code: "NOT_FOUND",
    });
    assert.deepEqual(await ack(owner, "project:join", { projectId: otherProjectId }), {
      ok: false, code: "NOT_FOUND",
    });
  });
  await t.test("拒絕偽造 userId 與不合法的 ID", async () => {
    assert.deepEqual(await ack(outsider, "project:join", { projectId, userId: ids.owner }), {
      ok: false, code: "INVALID_INPUT",
    });
    assert.deepEqual(await ack(owner, "project:join", { projectId: "1" }), {
      ok: false, code: "INVALID_INPUT",
    });
  });
  await t.test("只有伺服器可推播；且只送達所屬專案成員", async () => {
    const ownerEvent = once(owner, "project:changed");
    const memberEvent = once(member, "project:changed");
    const count = hub.publishProjectChanged(projectId, {
      resource: "task", action: "moved", resourceId: 7, version: 2,
    });
    assert.equal(count, 2);
    const [a] = await ownerEvent;
    const [b] = await memberEvent;
    assert.deepEqual(a, b);
    assert.equal(a.projectId, projectId);
    assert.equal(a.resource, "task");
    assert.equal(outsider.connected, true);
  });
  await t.test("離開 Room 後不再收到該專案通知", async () => {
    assert.deepEqual(await ack(member, "project:leave", { projectId }), { ok: true, projectId });
    assert.equal(hub.publishProjectChanged(projectId, { resource: "task", action: "updated" }), 1);
  });
  await t.test("移除成員後，舊連線不能重新加入", async () => {
    db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?")
      .run(projectId, ids.member);
    assert.deepEqual(await ack(member, "project:join", { projectId }), {
      ok: false, code: "NOT_FOUND",
    });
  });
  await t.test("Session 撤銷後，推播不再送達舊連線", async () => {
    auth.revokeSession(tokens.owner);
    assert.equal(hub.publishProjectChanged(projectId, { resource: "task", action: "updated" }), 0);
  });
});
