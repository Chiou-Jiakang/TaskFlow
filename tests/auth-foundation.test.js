"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const { openDatabase, initializeSchema } = require("../server/db");

const {
  AuthError,
  initializeAuthSchema,
  hashPassword,
  verifyPassword,
  createAuthRepository,
} = require("../server/auth-foundation");

function fixture(t, filename = ":memory:") {
  const db = openDatabase(filename);

  initializeSchema(db);
  initializeAuthSchema(db);

  t.after(() => db.close());

  return {
    db,
    auth: createAuthRepository(db),
  };
}

test("M3-A Authentication foundation", async (t) => {
  await t.test("Session 表可以建立並重複初始化，外鍵有效", (t) => {
    const { db } = fixture(t);

    assert.doesNotThrow(() => initializeAuthSchema(db));

    const rows = db
      .prepare(
        `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'auth_sessions'
      `,
      )
      .all();

    assert.equal(rows.length, 1);

    assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  });

  await t.test("註冊會正規化 Email，密碼只儲存雜湊", async (t) => {
    const { db, auth } = fixture(t);

    const user = await auth.register({
      email: "  Test.User@Example.COM  ",
      password: "A long private passphrase 123!",
      displayName: " 測試使用者 ",
    });

    assert.equal(user.email, "test.user@example.com");

    assert.equal(user.displayName, "測試使用者");

    assert.equal("password_hash" in user, false);

    const record = db
      .prepare(
        `
        SELECT password_hash
        FROM users
        WHERE id = ?
      `,
      )
      .get(user.id);

    assert.match(record.password_hash, /^scrypt\$32768\$8\$3\$/);

    assert.equal(record.password_hash.includes("private passphrase"), false);

    assert.equal(
      await verifyPassword(
        "A long private passphrase 123!",
        record.password_hash,
      ),
      true,
    );
  });

  await t.test("重複 Email 不可註冊，非法輸入會拒絕", async (t) => {
    const { db, auth } = fixture(t);

    await auth.register({
      email: "hello@example.com",
      password: "My secure passphrase 321",
      displayName: "Hello",
    });

    await assert.rejects(
      () =>
        auth.register({
          email: "HELLO@example.com",
          password: "My secure passphrase 456",
          displayName: "Hello2",
        }),
      (error) =>
        error instanceof AuthError &&
        error.status === 409 &&
        error.code === "EMAIL_TAKEN",
    );

    await assert.rejects(
      () =>
        auth.register({
          email: "not-an-email",
          password: "My secure passphrase 456",
          displayName: "Hello",
        }),
      (error) => error instanceof AuthError && error.status === 400,
    );

    assert.equal(
      db
        .prepare(
          `
          SELECT COUNT(*) AS n
          FROM users
        `,
        )
        .get().n,
      1,
    );
  });

  await t.test("隨機 Salt 不重複，錯誤密碼與舊測試 Hash 不通過", async () => {
    const password = "Very strong password 888";

    const first = await hashPassword(password);
    const second = await hashPassword(password);

    assert.notEqual(first, second);

    assert.equal(await verifyPassword(password, first), true);

    assert.equal(await verifyPassword("incorrect password", first), false);

    assert.equal(await verifyPassword(password, "TEST_ONLY"), false);
  });

  await t.test("登入正確回傳安全資料，錯誤帳密回傳 null", async (t) => {
    const { auth } = fixture(t);

    await auth.register({
      email: "person@example.com",
      password: "Correct horse battery 123",
      displayName: "Person",
    });

    const user = await auth.authenticate({
      email: "PERSON@example.com",
      password: "Correct horse battery 123",
    });

    assert.equal(user.email, "person@example.com");

    assert.equal("password_hash" in user, false);

    assert.equal(
      await auth.authenticate({
        email: "person@example.com",
        password: "wrong one",
      }),
      null,
    );

    assert.equal(
      await auth.authenticate({
        email: "noone@example.com",
        password: "wrong one",
      }),
      null,
    );
  });

  await t.test("Session Token 只存 SHA-256 雜湊，過期會拒絕", async (t) => {
    const { db, auth } = fixture(t);

    const user = await auth.register({
      email: "session@example.com",
      password: "Session security 2026!",
      displayName: "S",
    });

    let clock = 1_800_000_000_000;

    const sessions = createAuthRepository(db, { now: () => clock });

    const { token, expiresAt } = sessions.issueSession(user.id);

    assert.match(token, /^[A-Za-z0-9_-]{43}$/);

    const record = db
      .prepare(
        `
        SELECT token_hash
        FROM auth_sessions
      `,
      )
      .get();

    assert.equal(
      record.token_hash,
      crypto.createHash("sha256").update(token).digest("hex"),
    );

    assert.notEqual(record.token_hash, token);

    assert.equal(sessions.getUserBySession(token).id, user.id);

    clock = expiresAt;

    assert.equal(sessions.getUserBySession(token), null);

    assert.equal(sessions.pruneExpiredSessions(), 1);
  });

  await t.test("撤銷一個 Session 不會影響其他 Session", async (t) => {
    const { db, auth } = fixture(t);

    const user = await auth.register({
      email: "logout@example.com",
      password: "Logout test passphrase!",
      displayName: "L",
    });

    const first = auth.issueSession(user.id);
    const second = auth.issueSession(user.id);

    assert.equal(auth.revokeSession(first.token), true);

    assert.equal(auth.revokeSession(first.token), false);

    assert.equal(auth.getUserBySession(first.token), null);

    assert.equal(auth.getUserBySession(second.token).id, user.id);

    assert.equal(
      db
        .prepare(
          `
          SELECT COUNT(*) AS n
          FROM auth_sessions
        `,
        )
        .get().n,
      1,
    );
  });

  await t.test("Session 跨資料庫重開保留，刪除使用者後連動清除", async (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m3a-"));

    const filename = path.join(directory, "auth.db");

    let db = openDatabase(filename);

    t.after(() => {
      if (db) db.close();

      fs.rmSync(directory, {
        recursive: true,
        force: true,
      });
    });

    initializeSchema(db);
    initializeAuthSchema(db);

    let auth = createAuthRepository(db);

    const user = await auth.register({
      email: "persist@example.com",
      password: "Persist this account 42",
      displayName: "P",
    });

    const session = auth.issueSession(user.id);

    db.close();
    db = null;

    db = openDatabase(filename);

    initializeSchema(db);
    initializeAuthSchema(db);

    auth = createAuthRepository(db);

    assert.equal(auth.getUserBySession(session.token).id, user.id);

    db.prepare(
      `
        DELETE FROM users
        WHERE id = ?
      `,
    ).run(user.id);

    assert.equal(auth.getUserBySession(session.token), null);

    assert.equal(
      db
        .prepare(
          `
          SELECT COUNT(*) AS n
          FROM auth_sessions
        `,
        )
        .get().n,
      0,
    );
  });
});
