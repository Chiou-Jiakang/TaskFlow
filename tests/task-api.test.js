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

test("M5-B Task HTTP API", { timeout: 30000 }, async (t) => {
  // 所有測試資料存於記憶體，不修改正式 SQLite。
  const db = openDatabase(":memory:");
  initializeSchema(db);

  // 自動初始化 Authentication 與 Task Schema。
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

  // ========================================
  // 建立隔離測試帳號
  // ========================================
  const userStmt = db.prepare(`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (?, 'TEST_ONLY', ?)
  `);

  const makeUser = (email, name) =>
    Number(userStmt.run(email, name).lastInsertRowid);

  const ids = {
    owner: makeUser("task-owner@example.test", "Task Owner"),
    admin: makeUser("task-admin@example.test", "Task Admin"),
    member: makeUser("task-member@example.test", "Task Member"),
    outsider: makeUser("task-outsider@example.test", "Task Outsider"),
  };

  const projects = createProjectRepository(db);
  const members = createMemberRepository(db);

  const project = projects.create(ids.owner, {
    name: "M5-B 任務 API 驗收",
    description: "隔離測試",
  });

  const projectId = project.id;
  const tasksUrl = `/api/projects/${projectId}/tasks`;

  const foreignProject = projects.create(ids.outsider, {
    name: "另一個專案",
    description: "不能跨專案讀取任務",
  });

  members.add(ids.owner, projectId, 1, {
    email: "task-admin@example.test",
    role: "admin",
  });

  members.add(ids.owner, projectId, 2, {
    email: "task-member@example.test",
    role: "member",
  });

  // ========================================
  // 建立真實 Session Cookie 與 CSRF Token
  // ========================================
  const authRepo = createAuthRepository(db);
  const sessions = {};

  for (const [role, id] of Object.entries(ids)) {
    const token = authRepo.issueSession(id).token;

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

  // ========================================
  // HTTP 測試輔助函式
  // ========================================
  async function api(role, method, route, body, options = {}) {
    const { csrf = true, origin = base, json = true } = options;

    const session = sessions[role];
    const headers = {};

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

    const data = response.status === 204 ? null : await response.json();

    return {
      status: response.status,
      data,
      response,
    };
  }

  let taskId;
  let adminTaskId;

  // ========================================
  // Test 1：匿名者禁止讀寫
  // ========================================
  await t.test("匿名者不能讀取或建立任務", async () => {
    const read = await api(null, "GET", tasksUrl);

    const create = await api(null, "POST", tasksUrl, { title: "匿名寫入" });

    assert.equal(read.status, 401);
    assert.equal(create.status, 401);
  });

  // ========================================
  // Test 2：空任務列表
  // ========================================
  await t.test("Owner 的任務列表起初為空，且禁止快取", async () => {
    const result = await api("owner", "GET", tasksUrl);

    assert.equal(result.status, 200);
    assert.deepEqual(result.data.tasks, []);
    assert.equal(result.response.headers.get("cache-control"), "no-store");
  });

  // ========================================
  // Test 3：不合法 ID
  // ========================================
  await t.test("非法 projectId 和 taskId 回傳 400", async () => {
    for (const route of [
      "/api/projects/0/tasks",
      "/api/projects/nope/tasks",
      `${tasksUrl}/abc`,
    ]) {
      const result = await api("owner", "GET", route);
      assert.equal(result.status, 400);
    }
  });

  // ========================================
  // Test 4：跨專案權限
  // ========================================
  await t.test("非成員不可讀取任務清單", async () => {
    const result = await api("outsider", "GET", tasksUrl);

    assert.equal(result.status, 404);
    assert.equal(result.data.error, "PROJECT_NOT_FOUND");
  });

  // ========================================
  // Test 5：CSRF 與跨來源檢查
  // ========================================
  await t.test("未帶 CSRF 與跨來源建立任務遭拒", async () => {
    const body = { title: "不應建立" };

    const noCsrf = await api("owner", "POST", tasksUrl, body, { csrf: false });

    const crossOrigin = await api("owner", "POST", tasksUrl, body, {
      origin: "https://attacker.example",
    });

    assert.equal(noCsrf.status, 403);
    assert.equal(noCsrf.data.error, "CSRF_INVALID");

    assert.equal(crossOrigin.status, 403);
    assert.equal(crossOrigin.data.error, "CROSS_ORIGIN_DENIED");
  });

  // ========================================
  // Test 6：Content-Type
  // ========================================
  await t.test("寫入必須是 application/json", async () => {
    const response = await api(
      "owner",
      "POST",
      tasksUrl,
      { title: "錯誤 Content-Type" },
      { json: false },
    );

    assert.equal(response.status, 415);
    assert.equal(response.data.error, "JSON_REQUIRED");
  });

  // ========================================
  // Test 7：禁止冒名欄位
  // ========================================
  await t.test("拒絕偽造 actorId、ownerId 等欄位", async () => {
    const result = await api("owner", "POST", tasksUrl, {
      title: "偽造使用者",
      actorId: ids.outsider,
    });

    assert.equal(result.status, 400);
    assert.equal(result.data.error, "INVALID_INPUT");

    const other = await api("owner", "POST", tasksUrl, {
      title: "偽造 Owner",
      ownerId: ids.outsider,
    });

    assert.equal(other.status, 400);
  });

  // ========================================
  // Test 8：Owner 建立任務
  // ========================================
  await t.test("Owner 建立任務並回傳 201 與正確欄位", async () => {
    const result = await api("owner", "POST", tasksUrl, {
      title: "  建立 Task API  ",
      assigneeId: ids.member,
    });

    assert.equal(result.status, 201);
    assert.equal(result.data.task.title, "建立 Task API");
    assert.equal(result.data.task.status, "todo");
    assert.equal(result.data.task.priority, "medium");
    assert.equal(result.data.task.version, 1);
    assert.equal(result.data.task.assigneeId, ids.member);

    taskId = result.data.task.id;

    assert.equal(
      result.response.headers.get("location"),
      `${tasksUrl}/${taskId}`,
    );
  });

  // ========================================
  // Test 9：讀取任務
  // ========================================
  await t.test("Member 可讀取自己專案的任務", async () => {
    const list = await api("member", "GET", tasksUrl);

    const single = await api("member", "GET", `${tasksUrl}/${taskId}`);

    assert.equal(list.status, 200);
    assert.equal(list.data.tasks.length, 1);
    assert.equal(single.status, 200);
    assert.equal(single.data.task.id, taskId);
  });

  // ========================================
  // Test 10：Admin 新增權限
  // ========================================
  await t.test("Admin 可以新增，Member 不能新增", async () => {
    const result = await api("admin", "POST", tasksUrl, {
      title: "管理者任務",
      priority: "high",
    });

    assert.equal(result.status, 201);
    adminTaskId = result.data.task.id;

    const member = await api("member", "POST", tasksUrl, { title: "禁止新增" });

    assert.equal(member.status, 403);
    assert.equal(member.data.error, "FORBIDDEN");
  });

  // ========================================
  // Test 11：任務欄位驗證
  // ========================================
  await t.test("不合法任務資料及跨專案負責人遭拒", async () => {
    const badBodies = [
      { title: "   " },
      { title: "x", status: "invalid" },
      { title: "x", priority: "urgent" },
      { title: "x", dueDate: "2026-02-30" },
      { title: "x", position: -1 },
    ];

    for (const body of badBodies) {
      const result = await api("owner", "POST", tasksUrl, body);

      assert.equal(result.status, 400);
    }

    const badAssignee = await api("owner", "POST", tasksUrl, {
      title: "跨專案指派",
      assigneeId: ids.outsider,
    });

    assert.equal(badAssignee.status, 400);
    assert.equal(badAssignee.data.error, "ASSIGNEE_NOT_MEMBER");
  });

  // ========================================
  // Test 12：Member 更新限制
  // ========================================
  await t.test("Member 只能修改自己受指派任務的 status", async () => {
    const updated = await api("member", "PATCH", `${tasksUrl}/${taskId}`, {
      version: 1,
      status: "in_progress",
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.data.task.version, 2);
    assert.equal(updated.data.task.status, "in_progress");

    const titleChange = await api("member", "PATCH", `${tasksUrl}/${taskId}`, {
      version: 2,
      title: "不允許",
    });

    assert.equal(titleChange.status, 403);

    const unrelated = await api(
      "member",
      "PATCH",
      `${tasksUrl}/${adminTaskId}`,
      {
        version: 1,
        status: "done",
      },
    );

    assert.equal(unrelated.status, 403);
  });

  // ========================================
  // Test 13：更新與版本衝突
  // ========================================
  await t.test("Owner/Admin 可修改欄位，過期版本遭拒", async () => {
    const updated = await api("admin", "PATCH", `${tasksUrl}/${taskId}`, {
      version: 2,
      title: "API 完成驗收",
      status: "done",
      priority: "high",
      dueDate: "2026-12-25",
      position: 3,
    });

    assert.equal(updated.status, 200);
    assert.equal(updated.data.task.version, 3);
    assert.equal(updated.data.task.priority, "high");

    const stale = await api("owner", "PATCH", `${tasksUrl}/${taskId}`, {
      version: 2,
      title: "過期更新",
    });

    assert.equal(stale.status, 409);
    assert.equal(stale.data.error, "VERSION_CONFLICT");

    const unchanged = await api("owner", "GET", `${tasksUrl}/${taskId}`);

    assert.equal(unchanged.data.task.title, "API 完成驗收");
  });

  // ========================================
  // Test 14：PATCH 請求驗證
  // ========================================
  await t.test("PATCH 需要 CSRF、version 與更新欄位", async () => {
    const noCsrf = await api(
      "owner",
      "PATCH",
      `${tasksUrl}/${taskId}`,
      {
        version: 3,
        title: "不可更新",
      },
      { csrf: false },
    );

    assert.equal(noCsrf.status, 403);

    const missingVersion = await api(
      "owner",
      "PATCH",
      `${tasksUrl}/${taskId}`,
      {
        title: "不可更新",
      },
    );

    assert.equal(missingVersion.status, 400);

    const missingPatch = await api("owner", "PATCH", `${tasksUrl}/${taskId}`, {
      version: 3,
    });

    assert.equal(missingPatch.status, 400);
  });

  // ========================================
  // Test 15：HTTP 錯誤資料
  // ========================================
  await t.test("錯誤 JSON 回傳 400，過大請求回傳 413", async () => {
    const headers = {
      origin: base,
      cookie: sessions.owner.cookie,
      "x-taskflow-csrf": sessions.owner.csrf,
      "content-type": "application/json",
    };

    const malformed = await fetch(base + tasksUrl, {
      method: "POST",
      headers,
      body: "{bad",
    });

    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, "INVALID_JSON");

    const huge = await fetch(base + tasksUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "a".repeat(20000),
      }),
    });

    assert.equal(huge.status, 413);
    assert.equal((await huge.json()).error, "PAYLOAD_TOO_LARGE");
  });

  // ========================================
  // Test 16：刪除任務
  // ========================================
  await t.test("刪除只有 Owner/Admin 且需要正確版本與 CSRF", async () => {
    const route = `${tasksUrl}/${adminTaskId}`;

    const memberDelete = await api("member", "DELETE", `${route}?version=1`);

    assert.equal(memberDelete.status, 403);

    const noCsrf = await api(
      "admin",
      "DELETE",
      `${route}?version=1`,
      undefined,
      { csrf: false },
    );

    assert.equal(noCsrf.status, 403);

    const stale = await api("admin", "DELETE", `${route}?version=2`);

    assert.equal(stale.status, 409);

    const deleted = await api("admin", "DELETE", `${route}?version=1`);

    assert.equal(deleted.status, 204);

    const gone = await api("owner", "GET", route);

    assert.equal(gone.status, 404);
  });

  // ========================================
  // Test 17：跨專案隔離
  // ========================================
  await t.test("不同專案不能交叉查詢其他人的任務", async () => {
    const foreign = `/api/projects/${foreignProject.id}/tasks/${taskId}`;

    const outsider = await api("outsider", "GET", foreign);

    const owner = await api("owner", "GET", foreign);

    const unauthorized = await api("outsider", "GET", `${tasksUrl}/${taskId}`);

    assert.equal(outsider.status, 404);
    assert.equal(owner.status, 404);
    assert.equal(unauthorized.status, 404);
  });

  // ========================================
  // Test 18：專案封存保護
  // ========================================
  await t.test("封存專案可以讀取，但不能寫入任務", async () => {
    const version = db
      .prepare("SELECT version FROM projects WHERE id = ?")
      .get(projectId).version;

    projects.update(ids.owner, projectId, version, { status: "archived" });

    const read = await api("owner", "GET", tasksUrl);

    assert.equal(read.status, 200);

    const create = await api("owner", "POST", tasksUrl, { title: "不可建立" });

    assert.equal(create.status, 403);

    const update = await api("admin", "PATCH", `${tasksUrl}/${taskId}`, {
      version: 3,
      status: "todo",
    });

    assert.equal(update.status, 403);

    const deleted = await api(
      "owner",
      "DELETE",
      `${tasksUrl}/${taskId}?version=3`,
    );

    assert.equal(deleted.status, 403);
  });

  // ========================================
  // Test 19：Session 撤銷
  // ========================================
  await t.test("撤銷 Session 後不得再讀取私人任務", async () => {
    authRepo.revokeSession(sessions.member.token);

    const response = await api("member", "GET", tasksUrl);

    assert.equal(response.status, 401);
  });
});
