"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const { createApp } = require("../server/server");

const { openDatabase, initializeSchema } = require("../server/db");

test("M3-B Authentication HTTP API", async (t) => {
  // 建立隔離測試資料庫
  const db = openDatabase(":memory:");
  initializeSchema(db);

  // 啟用正式 Session 模式
  const app = createApp({
    database: db,
  });

  // 使用系統分配的隨機 Port
  const server = app.listen(0, "127.0.0.1");

  await once(server, "listening");

  const base = `http://127.0.0.1:${server.address().port}`;

  // 測試結束後清理資源
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
    });

    db.close();
  });

  // HTTP 測試輔助方法
  async function api(method, route, data, cookie, csrf, origin = base) {
    const headers = { origin };

    if (cookie) {
      headers.cookie = cookie;
    }

    if (csrf) {
      headers["x-taskflow-csrf"] = csrf;
    }

    if (data !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(base + route, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });

    const json = response.status === 204 ? null : await response.json();

    return {
      response,
      json,
    };
  }

  let cookie;
  let csrf;
  let projectId;

  // ==================================
  // Test 1：匿名使用者
  // ==================================
  await t.test("匿名者無法讀取 me 或 projects", async () => {
    const me = await api("GET", "/api/auth/me");

    const projects = await api("GET", "/api/projects");

    assert.equal(me.response.status, 401);

    assert.equal(projects.response.status, 401);
  });

  // ==================================
  // Test 2：註冊
  // ==================================
  await t.test("註冊回傳安全資料，資料庫儲存密碼雜湊", async () => {
    const result = await api("POST", "/api/auth/register", {
      email: "  Alice@Example.COM  ",
      password: "A safe long passphrase 2026!",
      displayName: "Alice",
    });

    assert.equal(result.response.status, 201);

    assert.equal(result.json.user.email, "alice@example.com");

    assert.equal("password_hash" in result.json.user, false);

    const stored = db
      .prepare(
        `
          SELECT password_hash
          FROM users
        `,
      )
      .get();

    assert.match(stored.password_hash, /^scrypt\$/);

    // 註冊不代表已經登入
    assert.equal(result.response.headers.get("set-cookie"), null);
  });

  // ==================================
  // Test 3：重複帳號與非法欄位
  // ==================================
  await t.test("重複註冊為 409，不合法欄位為 400", async () => {
    const duplicate = await api("POST", "/api/auth/register", {
      email: "alice@example.com",
      password: "A safe long passphrase 2026!",
      displayName: "Another",
    });

    assert.equal(duplicate.response.status, 409);

    assert.equal(duplicate.json.error, "EMAIL_TAKEN");

    const extra = await api("POST", "/api/auth/register", {
      email: "bob@example.com",
      password: "A safe long passphrase 2026!",
      displayName: "Bob",
      role: "admin",
    });

    assert.equal(extra.response.status, 400);
  });

  // ==================================
  // Test 4：登入與 Cookie
  // ==================================
  await t.test("錯誤密碼 401，正確登入建立 HttpOnly Cookie", async () => {
    const wrong = await api("POST", "/api/auth/login", {
      email: "alice@example.com",
      password: "wrong-password",
    });

    assert.equal(wrong.response.status, 401);

    assert.equal(wrong.json.error, "INVALID_CREDENTIALS");

    const result = await api("POST", "/api/auth/login", {
      email: "ALICE@example.com",
      password: "A safe long passphrase 2026!",
    });

    assert.equal(result.response.status, 200);

    const setCookie = result.response.headers.get("set-cookie");

    assert.match(setCookie, /taskflow_session=/);

    assert.match(setCookie, /httponly/i);

    assert.match(setCookie, /samesite=strict/i);

    cookie = setCookie.split(";")[0];
    csrf = result.json.csrfToken;

    assert.match(csrf, /^[0-9a-f]{64}$/);

    assert.equal(result.json.user.email, "alice@example.com");
  });

  // ==================================
  // Test 5：讀取登入者與專案
  // ==================================
  await t.test("Cookie 可查詢本人 me 與空專案列表", async () => {
    const me = await api("GET", "/api/auth/me", undefined, cookie);

    assert.equal(me.response.status, 200);

    assert.equal(me.json.user.displayName, "Alice");

    assert.equal(me.json.csrfToken, csrf);

    const projects = await api("GET", "/api/projects", undefined, cookie);

    assert.equal(projects.response.status, 200);

    assert.deepEqual(projects.json.projects, []);
  });

  // ==================================
  // Test 6：Project CRUD 與 CSRF
  // ==================================
  await t.test("專案寫入需要 CSRF；成功建立、修改、刪除", async () => {
    const noCsrf = await api(
      "POST",
      "/api/projects",
      {
        name: "TaskFlow",
      },
      cookie,
    );

    assert.equal(noCsrf.response.status, 403);

    assert.equal(noCsrf.json.error, "CSRF_INVALID");

    // 正確攜帶 CSRF Token
    const created = await api(
      "POST",
      "/api/projects",
      {
        name: "TaskFlow",
      },
      cookie,
      csrf,
    );

    assert.equal(created.response.status, 201);

    projectId = created.json.project.id;

    assert.equal(created.json.project.myRole, "owner");

    const updated = await api(
      "PATCH",
      `/api/projects/${projectId}`,
      {
        version: 1,
        name: "TaskFlow 2",
      },
      cookie,
      csrf,
    );

    assert.equal(updated.response.status, 200);

    assert.equal(updated.json.project.version, 2);

    const removed = await api(
      "DELETE",
      `/api/projects/${projectId}?version=2`,
      undefined,
      cookie,
      csrf,
    );

    assert.equal(removed.response.status, 204);
  });

  // ==================================
  // Test 7：跨來源防護
  // ==================================
  await t.test("跨來源登入及註冊請求被拒絕", async () => {
    const result = await api(
      "POST",
      "/api/auth/login",
      {
        email: "alice@example.com",
        password: "A safe long passphrase 2026!",
      },
      undefined,
      undefined,
      "https://attacker.example",
    );

    assert.equal(result.response.status, 403);

    assert.equal(result.json.error, "CROSS_ORIGIN_DENIED");
  });

  // ==================================
  // Test 8：錯誤輸入
  // ==================================
  await t.test("錯誤 JSON 400，過大請求 413", async () => {
    const bad = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
      },
      body: "{bad",
    });

    assert.equal(bad.status, 400);

    assert.equal((await bad.json()).error, "INVALID_JSON");

    const huge = await api("POST", "/api/auth/login", {
      email: "a@example.com",
      password: "x".repeat(20000),
    });

    assert.equal(huge.response.status, 413);
  });

  // ==================================
  // Test 9：登出
  // ==================================
  await t.test("登出必須通過 CSRF，登出後 Session 失效", async () => {
    const rejected = await api("POST", "/api/auth/logout", undefined, cookie);

    assert.equal(rejected.response.status, 403);

    const ended = await api(
      "POST",
      "/api/auth/logout",
      undefined,
      cookie,
      csrf,
    );

    assert.equal(ended.response.status, 204);

    const after = await api("GET", "/api/auth/me", undefined, cookie);

    assert.equal(after.response.status, 401);

    const result = db
      .prepare(
        `
          SELECT COUNT(*) AS n
          FROM auth_sessions
        `,
      )
      .get();

    assert.equal(result.n, 0);
  });

  // ==================================
  // Test 10：登入限速
  // ==================================
  await t.test("同一 IP 連續登入失敗後會暫時限制", async () => {
    for (let i = 0; i < 10; i++) {
      const denied = await api("POST", "/api/auth/login", {
        email: "alice@example.com",
        password: "wrong-password",
      });

      assert.equal(denied.response.status, 401);
    }

    const limited = await api("POST", "/api/auth/login", {
      email: "alice@example.com",
      password: "wrong-password",
    });

    assert.equal(limited.response.status, 429);

    assert.equal(limited.json.error, "TOO_MANY_ATTEMPTS");
  });
});
