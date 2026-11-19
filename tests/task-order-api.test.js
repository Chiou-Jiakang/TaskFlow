"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");

const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");
const { createAuthRepository } = require("../server/auth-foundation");
const { createProjectRepository } = require("../server/project-repository");
const { createMemberRepository } = require("../server/member-repository");

test("M6-B Task Reorder HTTP API", { timeout: 30000 }, async (t) => {
  // 全部使用記憶體 SQLite 及隨機本機 Port。
  const db = openDatabase(":memory:");

  initializeSchema(db);

  const app = createApp({ database: db });

  const server = app.listen(0, "127.0.0.1");

  await once(server, "listening");

  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    db.close();
  });

  // 建立測試帳號
  const makeUser = db.prepare(`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (?, 'TEST_ONLY', ?)
  `);

  const ids = {
    owner: Number(
      makeUser.run("m6-owner@example.test", "Owner").lastInsertRowid,
    ),

    admin: Number(
      makeUser.run("m6-admin@example.test", "Admin").lastInsertRowid,
    ),

    member: Number(
      makeUser.run("m6-member@example.test", "Member").lastInsertRowid,
    ),

    outsider: Number(
      makeUser.run("m6-outsider@example.test", "Outsider").lastInsertRowid,
    ),
  };

  const projects = createProjectRepository(db);
  const members = createMemberRepository(db);

  const project = projects.create(ids.owner, {
    name: "M6-B Test",
    description: "Isolated",
  });

  const foreign = projects.create(ids.outsider, {
    name: "Other",
    description: "Private",
  });

  const projectId = project.id;

  members.add(ids.owner, projectId, 1, {
    email: "m6-admin@example.test",
    role: "admin",
  });

  members.add(ids.owner, projectId, 2, {
    email: "m6-member@example.test",
    role: "member",
  });

  // 建立測試任務
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, status, position)
    VALUES (?, ?, ?, ?)
  `);

  const a = Number(insertTask.run(projectId, "A", "todo", 0).lastInsertRowid);

  const b = Number(insertTask.run(projectId, "B", "todo", 1).lastInsertRowid);

  const c = Number(insertTask.run(projectId, "C", "todo", 2).lastInsertRowid);

  const d = Number(
    insertTask.run(projectId, "D", "in_progress", 0).lastInsertRowid,
  );

  const x = Number(insertTask.run(foreign.id, "X", "todo", 0).lastInsertRowid);

  const taskUrl = `/api/projects/${projectId}/tasks`;

  const moveUrl = (taskId, pId = projectId) =>
    `/api/projects/${pId}/tasks/${taskId}/move`;

  const rows = () =>
    db
      .prepare(
        `
    SELECT id, title, status, position, version
    FROM tasks
    WHERE project_id = ?
    ORDER BY
      CASE status
        WHEN 'todo' THEN 0
        WHEN 'in_progress' THEN 1
        ELSE 2
      END,
      position,
      id
  `,
      )
      .all(projectId);

  // 建立正式 Session Cookie 格式
  const sessions = {};

  const auth = createAuthRepository(db);

  for (const [role, userId] of Object.entries(ids)) {
    const token = auth.issueSession(userId).token;

    sessions[role] = {
      token,

      cookie: `taskflow_session=${token}`,

      csrf: crypto
        .createHash("sha256")
        .update("taskflow-csrf-v1:")
        .update(token)
        .digest("hex"),
    };
  }

  // HTTP 測試輔助函式
  async function api(role, method, route, body, options = {}) {
    const { csrf = true, origin = base, json = true } = options;

    const headers = {};
    const session = sessions[role];

    if (session) {
      headers.cookie = session.cookie;
    }

    if (origin !== null) {
      headers.origin = origin;
    }

    if (csrf && session) {
      headers["x-taskflow-csrf"] = session.csrf;
    }

    if (body !== undefined && json) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(base + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers,
    };
  }

  const payload = {
    version: 1,
    status: "todo",
    index: 0,
  };

  // Test 1
  await t.test("匿名寫入回傳 401", async () => {
    const r = await api(null, "PATCH", moveUrl(c), payload);

    assert.equal(r.status, 401);
  });

  // Test 2
  await t.test("沒有 CSRF、跨來源寫入都回傳 403", async () => {
    const noCsrf = await api("owner", "PATCH", moveUrl(c), payload, {
      csrf: false,
    });

    assert.equal(noCsrf.status, 403);

    const crossOrigin = await api("owner", "PATCH", moveUrl(c), payload, {
      origin: "https://example.invalid",
    });

    assert.equal(crossOrigin.status, 403);
  });

  // Test 3
  await t.test("要求 application/json，缺少時回傳 415", async () => {
    const r = await api("owner", "PATCH", moveUrl(c), payload, { json: false });

    assert.equal(r.status, 415);
  });

  // Test 4
  await t.test("只接受 version、status、index，且檢查型別", async () => {
    const before = rows();

    const badBodies = [
      { version: 1, status: "todo" },

      {
        version: 1,
        status: "todo",
        index: 0,
        actorId: ids.owner,
      },

      { version: "1", status: "todo", index: 0 },

      { version: 1, status: "invalid", index: 0 },

      { version: 1, status: "todo", index: -1 },

      { version: 1, status: "todo", index: 4 },

      [],

      null,
    ];

    for (const body of badBodies) {
      const r = await api("owner", "PATCH", moveUrl(c), body);

      assert.equal(r.status, 400);
    }

    assert.deepEqual(rows(), before);
  });

  // Test 5
  await t.test("Member 與非成員無權排序", async () => {
    const member = await api("member", "PATCH", moveUrl(c), payload);

    assert.equal(member.status, 403);

    const outsider = await api("outsider", "PATCH", moveUrl(c), payload);

    assert.equal(outsider.status, 404);
  });

  // Test 6
  await t.test("無效 ID 與跨專案任務拒絕", async () => {
    const invalidId = await api("owner", "PATCH", moveUrl("abc"), payload);

    assert.equal(invalidId.status, 400);

    const foreignTask = await api("owner", "PATCH", moveUrl(x), payload);

    assert.equal(foreignTask.status, 404);
  });

  // Test 7
  await t.test("沒有實際移動就不增加版本", async () => {
    const r = await api("owner", "PATCH", moveUrl(a), payload);

    assert.equal(r.status, 200);
    assert.deepEqual(r.data.changedTaskIds, []);
    assert.equal(r.data.task.version, 1);

    assert.equal(r.headers.get("cache-control"), "no-store");
  });

  // Test 8
  await t.test("Owner 同欄排序成功且更新版本", async () => {
    const r = await api("owner", "PATCH", moveUrl(c), payload);

    assert.equal(r.status, 200);

    assert.deepEqual(
      rows()
        .filter((row) => row.status === "todo")
        .map((row) => [row.title, row.position, row.version]),
      [
        ["C", 0, 2],
        ["A", 1, 2],
        ["B", 2, 2],
      ],
    );

    assert.equal(r.data.changedTaskIds.length, 3);
  });

  // Test 9
  await t.test("舊版請求回傳 409，排序不變", async () => {
    const before = rows();

    const r = await api("owner", "PATCH", moveUrl(c), {
      version: 1,
      status: "done",
      index: 0,
    });

    assert.equal(r.status, 409);
    assert.deepEqual(rows(), before);
  });

  // Test 10
  await t.test("Admin 跨欄移動成功、來源和目標均重新編號", async () => {
    const r = await api("admin", "PATCH", moveUrl(a), {
      version: 2,
      status: "in_progress",
      index: 0,
    });

    assert.equal(r.status, 200);

    assert.deepEqual(
      rows().map((row) => [row.title, row.status, row.position]),
      [
        ["C", "todo", 0],
        ["B", "todo", 1],
        ["A", "in_progress", 0],
        ["D", "in_progress", 1],
      ],
    );

    assert.equal(r.data.task.version, 3);
  });

  // Test 11
  await t.test("GET 正式 API 讀取到最新的順序", async () => {
    const r = await api("owner", "GET", taskUrl);

    assert.equal(r.status, 200);

    assert.deepEqual(
      r.data.tasks.map((row) => row.title),
      ["C", "B", "A", "D"],
    );
  });

  // Test 12
  await t.test("封存專案拒絕移動且資料維持不變", async () => {
    const before = rows();

    db.prepare(
      `
        UPDATE projects
        SET status = 'archived'
        WHERE id = ?
      `,
    ).run(projectId);

    const r = await api("owner", "PATCH", moveUrl(c), {
      version: 2,
      status: "done",
      index: 0,
    });

    assert.equal(r.status, 403);
    assert.deepEqual(rows(), before);
  });

  // Test 13
  await t.test("撤銷 Session 後不能移動任務", async () => {
    auth.revokeSession(sessions.admin.token);

    const r = await api("admin", "PATCH", moveUrl(b), {
      version: 3,
      status: "done",
      index: 0,
    });

    assert.equal(r.status, 401);
  });
});
