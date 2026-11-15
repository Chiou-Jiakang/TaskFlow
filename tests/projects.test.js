"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const { createApp } = require("../server/server");

const { openDatabase, initializeSchema } = require("../server/db");

test("M2-B Project CRUD API", async (t) => {
  // 使用記憶體資料庫，保護正式資料
  const db = openDatabase(":memory:");
  initializeSchema(db);

  // 建立測試使用者，非正式帳號
  const addUser = db.prepare(`
    INSERT INTO users (
      email, password_hash, display_name
    )
    VALUES (?, ?, ?)
  `);

  const ownerId = Number(
    addUser.run("owner@example.invalid", "TEST_ONLY", "Owner").lastInsertRowid,
  );

  const adminId = Number(
    addUser.run("admin@example.invalid", "TEST_ONLY", "Admin").lastInsertRowid,
  );

  const memberId = Number(
    addUser.run("member@example.invalid", "TEST_ONLY", "Member")
      .lastInsertRowid,
  );

  const outsiderId = Number(
    addUser.run("outsider@example.invalid", "TEST_ONLY", "Outsider")
      .lastInsertRowid,
  );

  const servers = [];

  // 在測試環境注入可信任的使用者身分
  async function start(actorId) {
    const app = createApp({
      database: db,
      getAuthenticatedUserId: () => actorId,
    });

    const server = app.listen(0, "127.0.0.1");
    servers.push(server);

    await once(server, "listening");

    return `http://127.0.0.1:${server.address().port}`;
  }

  const ownerBase = await start(ownerId);
  const adminBase = await start(adminId);
  const memberBase = await start(memberId);
  const outsiderBase = await start(outsiderId);
  const anonBase = await start(null);

  // 測試結束後關閉伺服器與資料庫
  t.after(async () => {
    for (const server of servers) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    db.close();
  });

  // HTTP 測試輔助函式
  async function api(base, method, url, body) {
    const response = await fetch(base + url, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = response.status === 204 ? null : await response.json();

    return { response, data };
  }

  let projectId;

  await t.test("未登入時不可操作專案", async () => {
    const r = await api(anonBase, "GET", "/api/projects");

    assert.equal(r.response.status, 401);
    assert.equal(r.data.error, "UNAUTHENTICATED");
  });

  await t.test("專案列表初始為空", async () => {
    const r = await api(ownerBase, "GET", "/api/projects");

    assert.equal(r.response.status, 200);
    assert.deepEqual(r.data.projects, []);
  });

  await t.test("建立專案並自動建立 Owner 成員", async () => {
    const r = await api(ownerBase, "POST", "/api/projects", {
      name: "  網站專案  ",
      description: "第一個專案",
    });

    assert.equal(r.response.status, 201);

    projectId = r.data.project.id;

    assert.equal(r.data.project.name, "網站專案");

    assert.equal(r.data.project.myRole, "owner");

    assert.equal(r.data.project.version, 1);

    assert.equal(
      r.response.headers.get("location"),
      `/api/projects/${projectId}`,
    );

    const row = db
      .prepare(
        `
        SELECT role
        FROM project_members
        WHERE project_id = ? AND user_id = ?
      `,
      )
      .get(projectId, ownerId);

    assert.equal(row.role, "owner");
  });

  await t.test("可讀取自己的列表與單一專案", async () => {
    const list = await api(ownerBase, "GET", "/api/projects");

    assert.equal(list.data.projects.length, 1);

    const single = await api(ownerBase, "GET", `/api/projects/${projectId}`);

    assert.equal(single.response.status, 200);

    assert.equal(single.data.project.name, "網站專案");
  });

  await t.test("輸入驗證與拒絕客戶端指定 Owner", async () => {
    const badBodies = [
      { name: "   " },
      { name: "ok", owner_id: outsiderId },
      { name: "a".repeat(101) },
    ];

    for (const body of badBodies) {
      const r = await api(ownerBase, "POST", "/api/projects", body);

      assert.equal(r.response.status, 400);

      assert.equal(r.data.error, "INVALID_INPUT");
    }

    const badId = await api(ownerBase, "GET", "/api/projects/nope");

    assert.equal(badId.response.status, 400);
  });

  await t.test("只有成員可以讀取專案", async () => {
    const r = await api(outsiderBase, "GET", `/api/projects/${projectId}`);

    assert.equal(r.response.status, 404);

    const list = await api(outsiderBase, "GET", "/api/projects");

    assert.deepEqual(list.data.projects, []);
  });

  await t.test("Member 不能修改；Admin 可以修改", async () => {
    const add = db.prepare(`
        INSERT INTO project_members (
          project_id, user_id, role
        )
        VALUES (?, ?, ?)
      `);

    add.run(projectId, memberId, "member");
    add.run(projectId, adminId, "admin");

    const forbidden = await api(
      memberBase,
      "PATCH",
      `/api/projects/${projectId}`,
      {
        version: 1,
        name: "非法修改",
      },
    );

    assert.equal(forbidden.response.status, 403);

    const patched = await api(
      adminBase,
      "PATCH",
      `/api/projects/${projectId}`,
      {
        version: 1,
        name: "新版名稱",
        status: "archived",
      },
    );

    assert.equal(patched.response.status, 200);
    assert.equal(patched.data.project.version, 2);
    assert.equal(patched.data.project.status, "archived");
  });

  await t.test("舊版本更新會收到 409 衝突", async () => {
    const r = await api(ownerBase, "PATCH", `/api/projects/${projectId}`, {
      version: 1,
      name: "過期修改",
    });

    assert.equal(r.response.status, 409);

    assert.equal(r.data.error, "VERSION_CONFLICT");
  });

  await t.test("刪除僅限 Owner，且檢查 version", async () => {
    const admin = await api(
      adminBase,
      "DELETE",
      `/api/projects/${projectId}?version=2`,
    );

    assert.equal(admin.response.status, 403);

    const stale = await api(
      ownerBase,
      "DELETE",
      `/api/projects/${projectId}?version=1`,
    );

    assert.equal(stale.response.status, 409);

    const deleted = await api(
      ownerBase,
      "DELETE",
      `/api/projects/${projectId}?version=2`,
    );

    assert.equal(deleted.response.status, 204);

    const count = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM project_members
        WHERE project_id = ?
      `,
      )
      .get(projectId).count;

    assert.equal(count, 0);
  });

  await t.test("刪除後為 404，畸形 JSON 為 400", async () => {
    const gone = await api(ownerBase, "GET", `/api/projects/${projectId}`);

    assert.equal(gone.response.status, 404);

    const bad = await fetch(ownerBase + "/api/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad json",
    });

    assert.equal(bad.status, 400);

    assert.equal((await bad.json()).error, "INVALID_JSON");
  });
});
