"use strict";

// M4-B：以真實 Session Cookie + CSRF 測試成員管理 HTTP API。
// 所有資料只建立在 :memory: SQLite，不修改正式資料庫。
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");

const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");
const { createAuthRepository } = require("../server/auth-foundation");
const { createProjectRepository } = require("../server/project-repository");

test("M4-B Member Management HTTP API", { timeout: 30000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);

  // createApp 會初始化 auth_sessions；測試使用正式 Session Middleware。
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  });

  const insertUser = db.prepare(`
    INSERT INTO users(email, password_hash, display_name)
    VALUES (?, 'TEST_ONLY', ?)
  `);
  const createUser = (email, name) =>
    Number(insertUser.run(email, name).lastInsertRowid);

  const ids = {
    owner: createUser("owner-m4b@example.test", "Owner"),
    admin: createUser("admin-m4b@example.test", "Admin"),
    member: createUser("member-m4b@example.test", "Member"),
    outsider: createUser("outsider-m4b@example.test", "Outsider"),
  };

  const project = createProjectRepository(db).create(ids.owner, {
    name: "M4-B API 驗收專案",
    description: "測試資料不寫入正式資料庫",
  });
  const projectId = project.id;
  const membersUrl = `/api/projects/${projectId}/members`;

  const authRepo = createAuthRepository(db);
  const credentials = {};

  for (const [key, id] of Object.entries(ids)) {
    const token = authRepo.issueSession(id).token;
    credentials[key] = {
      token,
      cookie: `taskflow_session=${token}`,
      csrf: crypto
        .createHash("sha256")
        .update("taskflow-csrf-v1:")
        .update(token)
        .digest("hex"),
    };
  }

  async function api(actor, method, url, body, options = {}) {
    const { csrf = true, origin = base, contentType = true } = options;
    const cred = credentials[actor];
    const headers = {};

    if (cred) headers.cookie = cred.cookie;
    if (origin !== null) headers.origin = origin;
    if (csrf && cred) headers["x-taskflow-csrf"] = cred.csrf;
    if (body !== undefined && contentType) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(base + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data, response };
  }

  const version = () =>
    db.prepare("SELECT version FROM projects WHERE id = ?").get(projectId)
      .version;

  await t.test("未登入者不能查詢或新增成員", async () => {
    const read = await api(null, "GET", membersUrl);
    const write = await api(null, "POST", membersUrl, {
      version: 1,
      email: "member-m4b@example.test",
    });
    assert.equal(read.status, 401);
    assert.equal(write.status, 401);
  });

  await t.test("成員能讀取安全清單；非成員一律 404", async () => {
    const owner = await api("owner", "GET", membersUrl);
    assert.equal(owner.status, 200);
    assert.equal(owner.data.version, 1);
    assert.equal(owner.data.members.length, 1);
    assert.equal(owner.data.members[0].role, "owner");
    assert.equal("password_hash" in owner.data.members[0], false);
    assert.equal(owner.response.headers.get("cache-control"), "no-store");

    const outsider = await api("outsider", "GET", membersUrl);
    assert.equal(outsider.status, 404);
    assert.equal(outsider.data.error, "PROJECT_NOT_FOUND");
  });

  await t.test("不合法專案 ID 被拒絕", async () => {
    assert.equal(
      (await api("owner", "GET", "/api/projects/nope/members")).status,
      400,
    );
    assert.equal(
      (await api("owner", "GET", "/api/projects/0/members")).status,
      400,
    );
  });

  await t.test("無 CSRF、跨來源及客戶端冒名欄位均遭拒", async () => {
    const payload = { version: 1, email: "admin-m4b@example.test" };
    const noCsrf = await api("owner", "POST", membersUrl, payload, {
      csrf: false,
    });
    assert.equal(noCsrf.status, 403);
    assert.equal(noCsrf.data.error, "CSRF_INVALID");

    const cross = await api("owner", "POST", membersUrl, payload, {
      origin: "https://attacker.example",
    });
    assert.equal(cross.status, 403);
    assert.equal(cross.data.error, "CROSS_ORIGIN_DENIED");

    const spoof = await api("owner", "POST", membersUrl, {
      ...payload,
      actorId: ids.outsider,
    });
    assert.equal(spoof.status, 400);
    assert.equal(version(), 1);
  });

  await t.test("必須使用 JSON，並拒絕不合法資料", async () => {
    const missingType = await api(
      "owner",
      "POST",
      membersUrl,
      { version: 1, email: "admin-m4b@example.test" },
      { contentType: false },
    );
    assert.equal(missingType.status, 415);
    assert.equal(missingType.data.error, "JSON_REQUIRED");

    const extra = await api("owner", "POST", membersUrl, {
      version: 1,
      email: "admin-m4b@example.test",
      userId: ids.admin,
    });
    assert.equal(extra.status, 400);
    assert.equal(version(), 1);
  });

  await t.test("Owner 新增 Admin 並提升 version", async () => {
    const result = await api("owner", "POST", membersUrl, {
      version: 1,
      email: " ADMIN-M4B@EXAMPLE.TEST ",
      role: "admin",
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.member.userId, ids.admin);
    assert.equal(result.data.member.role, "admin");
    assert.equal(result.data.version, 2);
    assert.equal(version(), 2);
    assert.equal((await api("admin", "GET", membersUrl)).status, 200);
  });

  await t.test("Admin 無法建立 Admin；任何人不能新增 Owner", async () => {
    const forbidden = await api("admin", "POST", membersUrl, {
      version: 2,
      email: "member-m4b@example.test",
      role: "admin",
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.data.error, "FORBIDDEN");

    const ownerRole = await api("owner", "POST", membersUrl, {
      version: 2,
      email: "member-m4b@example.test",
      role: "owner",
    });
    assert.equal(ownerRole.status, 400);
    assert.equal(version(), 2);
  });

  await t.test("Admin 可以新增 Member", async () => {
    const result = await api("admin", "POST", membersUrl, {
      version: 2,
      email: "member-m4b@example.test",
    });
    assert.equal(result.status, 201);
    assert.equal(result.data.version, 3);
    assert.equal(result.data.member.role, "member");
  });

  await t.test("Member 可讀但不能新增成員", async () => {
    assert.equal((await api("member", "GET", membersUrl)).status, 200);
    const denied = await api("member", "POST", membersUrl, {
      version: 3,
      email: "outsider-m4b@example.test",
    });
    assert.equal(denied.status, 403);
    assert.equal(version(), 3);
  });

  await t.test("重複加入、未知 Email、舊版本操作不寫入資料", async () => {
    const duplicate = await api("owner", "POST", membersUrl, {
      version: 3,
      email: "member-m4b@example.test",
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.data.error, "ALREADY_MEMBER");

    const missing = await api("owner", "POST", membersUrl, {
      version: 3,
      email: "missing@example.test",
    });
    assert.equal(missing.status, 404);

    const stale = await api("owner", "POST", membersUrl, {
      version: 2,
      email: "outsider-m4b@example.test",
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.error, "VERSION_CONFLICT");
    assert.equal(version(), 3);
  });

  await t.test("非 Owner 不可修改角色，Owner 角色被保護", async () => {
    const denied = await api("admin", "PATCH", `${membersUrl}/${ids.member}`, {
      version: 3,
      role: "admin",
    });
    assert.equal(denied.status, 403);

    const protectedOwner = await api(
      "owner",
      "PATCH",
      `${membersUrl}/${ids.owner}`,
      { version: 3, role: "member" },
    );
    assert.equal(protectedOwner.status, 403);
    assert.equal(protectedOwner.data.error, "OWNER_PROTECTED");
  });

  await t.test("Owner 可以升級與降級角色", async () => {
    const promoted = await api(
      "owner",
      "PATCH",
      `${membersUrl}/${ids.member}`,
      { version: 3, role: "admin" },
    );
    assert.equal(promoted.status, 200);
    assert.equal(promoted.data.member.role, "admin");
    assert.equal(promoted.data.version, 4);

    const demoted = await api("owner", "PATCH", `${membersUrl}/${ids.member}`, {
      version: 4,
      role: "member",
    });
    assert.equal(demoted.status, 200);
    assert.equal(demoted.data.version, 5);
    assert.equal(demoted.data.member.role, "member");
  });

  await t.test("PATCH 禁止非法欄位與 ID", async () => {
    const extra = await api("owner", "PATCH", `${membersUrl}/${ids.member}`, {
      version: 5,
      role: "admin",
      ownerId: ids.owner,
    });
    assert.equal(extra.status, 400);

    const badId = await api("owner", "PATCH", `${membersUrl}/invalid`, {
      version: 5,
      role: "admin",
    });
    assert.equal(badId.status, 400);
    assert.equal(version(), 5);
  });

  await t.test("Admin 移除 Member 後，該成員失去權限", async () => {
    const removed = await api(
      "admin",
      "DELETE",
      `${membersUrl}/${ids.member}?version=5`,
    );
    assert.equal(removed.status, 204);
    assert.equal(version(), 6);
    assert.equal((await api("member", "GET", membersUrl)).status, 404);
  });

  await t.test("Member 可退出；版本衝突會被拒絕", async () => {
    const readd = await api("owner", "POST", membersUrl, {
      version: 6,
      email: "member-m4b@example.test",
    });
    assert.equal(readd.status, 201);
    assert.equal(readd.data.version, 7);

    const stale = await api(
      "member",
      "DELETE",
      `${membersUrl}/${ids.member}?version=6`,
    );
    assert.equal(stale.status, 409);

    const left = await api(
      "member",
      "DELETE",
      `${membersUrl}/${ids.member}?version=7`,
    );
    assert.equal(left.status, 204);
    assert.equal(version(), 8);
    assert.equal((await api("member", "GET", membersUrl)).status, 404);
  });

  await t.test("Owner 不能退出；Admin 不能移除 Owner", async () => {
    const ownerLeave = await api(
      "owner",
      "DELETE",
      `${membersUrl}/${ids.owner}?version=8`,
    );
    assert.equal(ownerLeave.status, 403);
    assert.equal(ownerLeave.data.error, "OWNER_PROTECTED");

    const adminRemoveOwner = await api(
      "admin",
      "DELETE",
      `${membersUrl}/${ids.owner}?version=8`,
    );
    assert.equal(adminRemoveOwner.status, 403);
    assert.equal(version(), 8);
  });

  await t.test("Project CRUD 共用版本；撤銷 Session 後拒絕存取", async () => {
    const projectUpdate = await api(
      "owner",
      "PATCH",
      `/api/projects/${projectId}`,
      { version: 8, name: "M4-B 驗收完成" },
    );
    assert.equal(projectUpdate.status, 200);
    assert.equal(projectUpdate.data.project.version, 9);
    assert.equal((await api("owner", "GET", membersUrl)).data.version, 9);

    authRepo.revokeSession(credentials.owner.token);
    const revoked = await api("owner", "GET", membersUrl);
    assert.equal(revoked.status, 401);
  });
});
