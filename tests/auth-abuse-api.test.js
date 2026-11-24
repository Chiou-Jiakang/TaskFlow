"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const crypto = require("node:crypto");
const { openDatabase, initializeSchema } = require("../server/db");
const { createAuthRepository, initializeAuthSchema } = require("../server/auth-foundation");
const { createApp } = require("../server/server");

test("M10-A5b-1 HTTP registration protection", async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function register(email) {
    return fetch(base + "/api/auth/register", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({ email, password: "A long safe password 2026!", displayName: "Someone" }),
    });
  }

  for (let i = 0; i < 10; i++) {
    const response = await register("invalid-email");
    assert.equal(response.status, 400);
    await response.text();
  }
  const limited = await register("valid@example.com");
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, "TOO_MANY_ATTEMPTS");
  assert.equal(limited.headers.get("cache-control"), "no-store");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
});

test("M10-A5b-1 startup expires only stale sessions", async (t) => {
  const db = openDatabase(":memory:");
  initializeSchema(db);
  initializeAuthSchema(db);
  t.after(() => db.close());
  const repo = createAuthRepository(db);
  const user = await repo.register({
    email: "session-gc@example.com",
    password: "A long safe password 2026!",
    displayName: "Session GC",
  });
  const expired = repo.issueSession(user.id);
  const active = repo.issueSession(user.id);
  // 保持 SQLite CHECK(expires_at > created_at)，並模擬「已合法過期」的 Session。
  // 測試資料須在過去建立，且在過去到期，而非把 expires_at 設為 0。
  const now = Date.now();
  const createdAt = now - 2 * 60 * 60 * 1000;
  const expiredAt = now - 60 * 60 * 1000;
  db.prepare(
    "UPDATE auth_sessions SET created_at = ?, expires_at = ? WHERE token_hash = ?",
  ).run(
    createdAt,
    expiredAt,
    crypto.createHash("sha256").update(expired.token).digest("hex"),
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 2);
  const app = createApp({ database: db });
  assert.ok(app);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM auth_sessions").get().n, 1);
  assert.equal(repo.getUserBySession(expired.token), null);
  assert.equal(repo.getUserBySession(active.token).id, user.id);
});
