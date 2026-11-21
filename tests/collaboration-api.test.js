"use strict";

// M8-B REST API acceptance; real Express + Session + CSRF, isolated SQLite :memory:.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { openDatabase, initializeSchema } = require("../server/db");
const { createApp } = require("../server/server");
const { createAuthRepository } = require("../server/auth-foundation");

// The route module also exports pure validators so these can be checked independently.
const { positivePathId, parsePagination } = require("../server/collaboration-routes");

test("M8-B route validators", async (t) => {
  await t.test("只允許安全的正整數 URL ID", () => {
    assert.equal(positivePathId("123", "taskId"), 123);
    for (const bad of ["0", "-1", "1.2", "a", "999999999999999999999999", ["1", "2"], 1]) {
      assert.throws(() => positivePathId(bad, "taskId"), (err) => err.status === 400);
    }
  });
  await t.test("分頁上限、未知欄位與重複值受到限制", () => {
    assert.deepEqual(parsePagination({}), {});
    assert.deepEqual(parsePagination({ limit: "100", beforeId: "2" }), { limit: 100, beforeId: 2 });
    for (const query of [{ limit: "101" }, { beforeId: "0" }, { foo: "bar" }, { limit: ["1", "2"] }]) {
      assert.throws(() => parsePagination(query), (err) => err.status === 400);
    }
  });
});

test("M8-B Collaboration REST API / Session / CSRF / RBAC", { timeout: 30000 }, async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  // createApp must run M5 and M8 additive initialization automatically.
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    db.close();
  });

  const addUserStmt = db.prepare(`
    INSERT INTO users(email, password_hash, display_name) VALUES (?, 'TEST_ONLY', ?)
  `);
  const user = (email, name) => Number(addUserStmt.run(email, name).lastInsertRowid);
  const ids = {
    owner: user("m8b-owner@example.test", "M8 Owner"),
    admin: user("m8b-admin@example.test", "M8 Admin"),
    member: user("m8b-member@example.test", "M8 Member"),
    outsider: user("m8b-outsider@example.test", "M8 Outsider"),
  };
  const addProject = db.prepare("INSERT INTO projects (name, owner_id) VALUES (?, ?)");
  const pid = Number(addProject.run("M8B Project", ids.owner).lastInsertRowid);
  const foreignPid = Number(addProject.run("Foreign Project", ids.outsider).lastInsertRowid);
  const addMember = db.prepare("INSERT INTO project_members(project_id,user_id,role) VALUES (?,?,?)");
  addMember.run(pid, ids.owner, "owner");
  addMember.run(pid, ids.admin, "admin");
  addMember.run(pid, ids.member, "member");
  addMember.run(foreignPid, ids.outsider, "owner");
  const addTask = db.prepare("INSERT INTO tasks(project_id,title) VALUES (?,?)");
  const taskId = Number(addTask.run(pid, "M8 Task").lastInsertRowid);
  const foreignTaskId = Number(addTask.run(foreignPid, "Foreign Task").lastInsertRowid);
  const commentsUrl = `/api/projects/${pid}/tasks/${taskId}/comments`;
  const activitiesUrl = `/api/projects/${pid}/activity`;

  const sessions = {};
  const auth = createAuthRepository(db);
  for (const [role, id] of Object.entries(ids)) {
    const token = auth.issueSession(id).token;
    sessions[role] = {
      cookie: `taskflow_session=${token}`,
      csrf: crypto.createHash("sha256").update("taskflow-csrf-v1:").update(token).digest("hex"),
    };
  }
  async function api(role, method, route, body, opts = {}) {
    const headers = {};
    const s = sessions[role];
    if (s) headers.cookie = s.cookie;
    if (opts.origin !== null) headers.origin = opts.origin ?? base;
    if (s && opts.csrf !== false) headers["x-taskflow-csrf"] = s.csrf;
    if (body !== undefined && opts.json !== false) headers["content-type"] = "application/json";
    const response = await fetch(base + route, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
      response,
    };
  }

  let ownerComment;
  let memberComment;
  let adminComment;
  await t.test("Schema 由 createApp 增量建好，不動原專案", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x => x.name);
    assert.ok(tables.includes("task_comments"));
    assert.ok(tables.includes("project_activity"));
    assert.ok(db.prepare("SELECT id FROM projects WHERE id=?").get(pid));
  });

  await t.test("匿名讀取、寫入回傳 401", async () => {
    assert.equal((await api(null, "GET", commentsUrl)).status, 401);
    assert.equal((await api(null, "GET", activitiesUrl)).status, 401);
    assert.equal((await api(null, "POST", commentsUrl, { body: "hello" })).status, 401);
  });
  await t.test("非成員讀取留言與活動一律 404", async () => {
    assert.equal((await api("outsider", "GET", commentsUrl)).status, 404);
    assert.equal((await api("outsider", "GET", activitiesUrl)).status, 404);
  });
  await t.test("不合法 projectId/taskId 和跨專案 taskId 不可存取", async () => {
    for (const route of [
      "/api/projects/0/activity", "/api/projects/x/activity",
      `/api/projects/${pid}/tasks/xyz/comments`,
    ]) assert.equal((await api("owner", "GET", route)).status, 400);
    assert.equal((await api("owner", "GET", `/api/projects/${pid}/tasks/${foreignTaskId}/comments`)).status, 404);
  });
  await t.test("CSRF 缺失與跨站 Origin 都拒絕寫入", async () => {
    const req = { body: "denied" };
    const noCsrf = await api("owner", "POST", commentsUrl, req, { csrf: false });
    assert.equal(noCsrf.status, 403);
    assert.equal(noCsrf.body.error, "CSRF_INVALID");
    const cross = await api("owner", "POST", commentsUrl, req, { origin: "https://evil.example" });
    assert.equal(cross.status, 403);
    assert.equal(cross.body.error, "CROSS_ORIGIN_DENIED");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM task_comments").get().n, 0);
  });
  await t.test("寫入需 JSON，拒絕偽造 actorId 和多餘欄位", async () => {
    const wrong = await api("owner", "POST", commentsUrl, { body: "no" }, { json: false });
    assert.equal(wrong.status, 415);
    for (const invalid of [
      { body: "hi", actorId: ids.outsider }, { body: "hi", authorId: ids.outsider },
      { body: "hi", userId: ids.outsider }, {}, { body: "", version: 1 },
    ]) assert.equal((await api("owner", "POST", commentsUrl, invalid)).status, 400);
  });
  await t.test("Owner/Admin/Member 均能新增留言，201 與 Location 正確", async () => {
    for (const role of ["owner", "admin", "member"]) {
      const result = await api(role, "POST", commentsUrl, { body: `  ${role} message  ` });
      assert.equal(result.status, 201);
      assert.equal(result.body.comment.body, `${role} message`);
      assert.equal(result.body.comment.authorId, ids[role]);
      assert.equal(result.body.comment.version, 1);
      assert.equal(result.response.headers.get("location"), `${commentsUrl}/${result.body.comment.id}`);
      if (role === "owner") ownerComment = result.body.comment;
      if (role === "admin") adminComment = result.body.comment;
      if (role === "member") memberComment = result.body.comment;
    }
  });
  await t.test("列表與單筆 GET 權限、回應 Cache-Control 和資料完整性", async () => {
    const list = await api("member", "GET", commentsUrl);
    assert.equal(list.status, 200);
    assert.equal(list.body.comments.length, 3);
    assert.equal(list.body.comments[0].id, memberComment.id);
    assert.equal(list.response.headers.get("cache-control"), "no-store");
    const item = await api("owner", "GET", `${commentsUrl}/${memberComment.id}`);
    assert.equal(item.status, 200);
    assert.equal(item.body.comment.authorName, "M8 Member");
    assert.equal(item.response.headers.get("cache-control"), "no-store");
  });
  await t.test("GET 分頁與參數校驗", async () => {
    const list = await api("owner", "GET", `${commentsUrl}?limit=1&beforeId=${memberComment.id}`);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.comments.map(x => x.id), [adminComment.id]);
    for (const route of [
      `${commentsUrl}?limit=101`, `${commentsUrl}?limit=-1`, `${commentsUrl}?limit=1&limit=2`,
      `${commentsUrl}?beforeId=0`, `${commentsUrl}?unknown=true`,
    ]) assert.equal((await api("owner", "GET", route)).status, 400);
  });
  await t.test("活動紀錄只回傳中繼資料，不洩漏留言內文", async () => {
    const result = await api("member", "GET", activitiesUrl);
    assert.equal(result.status, 200);
    assert.equal(result.body.activities.length, 3);
    assert.equal(result.body.activities[0].action, "comment_created");
    assert.ok(!Object.hasOwn(result.body.activities[0], "body"));
    assert.equal(result.response.headers.get("cache-control"), "no-store");
    assert.equal((await api("owner", "GET", `${activitiesUrl}?limit=1`)).body.activities.length, 1);
  });
  await t.test("只有作者能修改留言；Member 不能改其他人的", async () => {
    const denied = await api("member", "PATCH", `${commentsUrl}/${ownerComment.id}`,
      { version: 1, body: "steal" });
    assert.equal(denied.status, 403);
    const changed = await api("owner", "PATCH", `${commentsUrl}/${ownerComment.id}`,
      { version: 1, body: "Owner updated" });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.comment.version, 2);
    assert.equal(changed.body.comment.body, "Owner updated");
    ownerComment = changed.body.comment;
  });
  await t.test("PATCH 舊版衝突 409，資料未變且活動不新增", async () => {
    const before = db.prepare("SELECT COUNT(*) AS n FROM project_activity").get().n;
    const result = await api("owner", "PATCH", `${commentsUrl}/${ownerComment.id}`,
      { version: 1, body: "bad" });
    assert.equal(result.status, 409);
    assert.equal(result.body.error, "VERSION_CONFLICT");
    assert.equal((await api("owner", "GET", `${commentsUrl}/${ownerComment.id}`)).body.comment.body,
      "Owner updated");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM project_activity").get().n, before);
  });
  await t.test("DELETE 缺 version 或版本錯誤 400 / 409", async () => {
    assert.equal((await api("owner", "DELETE", `${commentsUrl}/${ownerComment.id}`)).status, 400);
    assert.equal((await api("owner", "DELETE", `${commentsUrl}/${ownerComment.id}?version=0`)).status, 400);
    const stale = await api("owner", "DELETE", `${commentsUrl}/${ownerComment.id}?version=1`);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error, "VERSION_CONFLICT");
  });
  await t.test("Member 不可刪其他人的留言；Admin 可管理刪除", async () => {
    assert.equal((await api("member", "DELETE", `${commentsUrl}/${ownerComment.id}?version=2`)).status, 403);
    const deleted = await api("admin", "DELETE", `${commentsUrl}/${ownerComment.id}?version=2`);
    assert.equal(deleted.status, 204);
    assert.equal((await api("member", "GET", `${commentsUrl}/${ownerComment.id}`)).status, 404);
    assert.equal((await api("owner", "GET", commentsUrl)).body.comments.length, 2);
  });
  await t.test("刪除後活動保留 metadata，不保留留言內文", async () => {
    const result = await api("owner", "GET", activitiesUrl);
    assert.equal(result.status, 200);
    assert.equal(result.body.activities[0].action, "comment_deleted");
    assert.equal(db.prepare("SELECT body FROM task_comments WHERE id=?").get(ownerComment.id).body, "");
  });
  await t.test("已封存專案可讀取但不能新增、修改或刪除", async () => {
    db.prepare("UPDATE projects SET status='archived' WHERE id=?").run(pid);
    assert.equal((await api("owner", "GET", commentsUrl)).status, 200);
    assert.equal((await api("owner", "GET", activitiesUrl)).status, 200);
    assert.equal((await api("owner", "POST", commentsUrl, { body: "denied" })).status, 403);
    assert.equal((await api("member", "PATCH", `${commentsUrl}/${memberComment.id}`,
      { version: 1, body: "denied" })).status, 403);
    assert.equal((await api("admin", "DELETE", `${commentsUrl}/${adminComment.id}?version=1`)).status, 403);
    db.prepare("UPDATE projects SET status='active' WHERE id=?").run(pid);
  });
  await t.test("撤銷成員資格後無法再讀取／寫入", async () => {
    db.prepare("DELETE FROM project_members WHERE project_id=? AND user_id=?").run(pid, ids.member);
    assert.equal((await api("member", "GET", commentsUrl)).status, 404);
    assert.equal((await api("member", "GET", activitiesUrl)).status, 404);
    assert.equal((await api("member", "POST", commentsUrl, { body: "denied" })).status, 404);
  });
});
