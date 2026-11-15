"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { openDatabase, initializeSchema } = require("../server/db");

test("M2 SQLite schema tests", async (t) => {
  // 使用記憶體資料庫，不影響正式資料
  const db = openDatabase(":memory:");

  t.after(() => db.close());

  initializeSchema(db);

  await t.test("建立三張核心資料表並啟用外鍵", () => {
    const names = db
      .prepare(
        `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
      `,
      )
      .all()
      .map((row) => row.name);

    assert.deepEqual(names.sort(), ["project_members", "projects", "users"]);

    const setting = db.prepare("PRAGMA foreign_keys").get();

    assert.equal(setting.foreign_keys, 1);
  });

  await t.test("重複初始化不破壞資料表", () => {
    assert.doesNotThrow(() => initializeSchema(db));
  });

  await t.test("不存在的擁有者不可建立專案", () => {
    assert.throws(() => {
      db.prepare(
        `
          INSERT INTO projects (name, owner_id)
          VALUES (?, ?)
        `,
      ).run("無效專案", 999);
    }, /FOREIGN KEY constraint failed/);
  });

  // 只在記憶體資料庫建立測試使用者
  const insertUser = db.prepare(`
    INSERT INTO users (
      email,
      password_hash,
      display_name
    )
    VALUES (?, ?, ?)
  `);

  const owner = insertUser.run(
    "owner@example.invalid",
    "TEST_ONLY_NOT_A_REAL_HASH",
    "擁有者",
  );

  const colleague = insertUser.run(
    "colleague@example.invalid",
    "TEST_ONLY_NOT_A_REAL_HASH",
    "成員",
  );

  const project = db
    .prepare(
      `
    INSERT INTO projects (name, owner_id)
    VALUES (?, ?)
  `,
    )
    .run("測試專案", owner.lastInsertRowid);

  await t.test("角色、唯一性與專案狀態限制", () => {
    const addMember = db.prepare(`
        INSERT INTO project_members (
          project_id,
          user_id,
          role
        )
        VALUES (?, ?, ?)
      `);

    addMember.run(project.lastInsertRowid, owner.lastInsertRowid, "owner");

    // 同一位成員不能重複加入
    assert.throws(() => {
      addMember.run(project.lastInsertRowid, owner.lastInsertRowid, "owner");
    }, /UNIQUE constraint failed/);

    // 不接受未定義的角色
    assert.throws(() => {
      addMember.run(
        project.lastInsertRowid,
        colleague.lastInsertRowid,
        "superuser",
      );
    }, /CHECK constraint failed/);

    // 不接受未定義的專案狀態
    assert.throws(() => {
      db.prepare(
        `
          UPDATE projects
          SET status = ?
          WHERE id = ?
        `,
      ).run("deleted", project.lastInsertRowid);
    }, /CHECK constraint failed/);
  });

  await t.test("刪除專案會清除成員關聯", () => {
    db.prepare(
      `
        DELETE FROM projects
        WHERE id = ?
      `,
    ).run(project.lastInsertRowid);

    const result = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM project_members
      `,
      )
      .get();

    assert.equal(result.count, 0);
  });
});
