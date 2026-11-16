"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { openDatabase, initializeSchema } = require("../server/db");

const {
  ProjectError,
  createProjectRepository,
} = require("../server/project-repository");

// 每個子測試建立獨立的暫存 SQLite 檔案，
// 絕不使用正式資料庫。
function createFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m2c-"));

  const filename = path.join(directory, "integration.db");

  const connections = new Set();

  function open() {
    const db = openDatabase(filename);

    connections.add(db);
    initializeSchema(db);

    return db;
  }

  function close(db) {
    if (connections.delete(db)) {
      db.close();
    }
  }

  t.after(() => {
    for (const db of connections) {
      db.close();
    }

    connections.clear();

    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  });

  return { filename, open, close };
}

function addUser(db, name) {
  const result = db
    .prepare(
      `
    INSERT INTO users (
      email,
      password_hash,
      display_name
    )
    VALUES (?, ?, ?)
  `,
    )
    .run(`${name}@example.invalid`, "TEST_ONLY_NOT_A_HASH", name);

  return Number(result.lastInsertRowid);
}

function count(db, table) {
  // 表名只接受測試程式內的固定清單，
  // 不接收外部使用者輸入。
  assert.ok(["projects", "project_members", "users"].includes(table));

  return db
    .prepare(
      `
    SELECT COUNT(*) AS count
    FROM ${table}
  `,
    )
    .get().count;
}

test("M2-C SQLite integration tests", async (t) => {
  await t.test("關閉並重新開啟資料庫後，專案與版本仍存在", (t) => {
    const fixture = createFixture(t);

    let db = fixture.open();

    const userId = addUser(db, "persist_owner");

    const repo = createProjectRepository(db);

    const created = repo.create(userId, {
      name: "持久化測試",
      description: "資料必須保留",
    });

    const updated = repo.update(userId, created.id, 1, {
      name: "重開後保留的名稱",
    });

    assert.equal(updated.version, 2);

    fixture.close(db);

    assert.equal(fs.existsSync(fixture.filename), true);

    db = fixture.open();

    const restored = createProjectRepository(db).get(userId, created.id);

    assert.equal(restored.name, "重開後保留的名稱");

    assert.equal(restored.description, "資料必須保留");

    assert.equal(restored.version, 2);
    assert.equal(restored.myRole, "owner");

    assert.equal(count(db, "project_members"), 1);
  });

  await t.test("成員關聯建立失敗時，整筆交易回滾且可再次成功建立", (t) => {
    const fixture = createFixture(t);
    const db = fixture.open();

    const userId = addUser(db, "rollback_owner");

    const repo = createProjectRepository(db);

    // 故意在交易的第二次 INSERT
    // 觸發 SQLite 錯誤。
    db.exec(`
        CREATE TRIGGER m2c_fail_member_insert
        BEFORE INSERT ON project_members
        BEGIN
          SELECT RAISE(
            ABORT,
            'M2C_FORCED_MEMBER_FAILURE'
          );
        END;
      `);

    assert.throws(
      () =>
        repo.create(userId, {
          name: "不應保留",
          description: "",
        }),
      /M2C_FORCED_MEMBER_FAILURE/,
    );

    assert.equal(count(db, "projects"), 0);
    assert.equal(count(db, "project_members"), 0);

    db.exec("DROP TRIGGER m2c_fail_member_insert;");

    const retry = repo.create(userId, {
      name: "恢復後正常建立",
      description: "",
    });

    assert.equal(retry.myRole, "owner");
    assert.equal(count(db, "projects"), 1);

    assert.equal(count(db, "project_members"), 1);
  });

  await t.test("兩條 SQLite 連線使用舊版本更新或刪除時收到 409", (t) => {
    const fixture = createFixture(t);

    const dbA = fixture.open();

    const userId = addUser(dbA, "concurrent_owner");

    const repoA = createProjectRepository(dbA);

    const created = repoA.create(userId, {
      name: "初始名稱",
      description: "",
    });

    const dbB = fixture.open();

    const repoB = createProjectRepository(dbB);

    const snapshotA = repoA.get(userId, created.id);

    const snapshotB = repoB.get(userId, created.id);

    assert.equal(snapshotA.version, 1);
    assert.equal(snapshotB.version, 1);

    const updatedA = repoA.update(userId, created.id, snapshotA.version, {
      name: "A 的修改",
    });

    assert.equal(updatedA.version, 2);

    const isConflict = (error) =>
      error instanceof ProjectError &&
      error.status === 409 &&
      error.code === "VERSION_CONFLICT";

    assert.throws(
      () =>
        repoB.update(userId, created.id, snapshotB.version, {
          name: "B 的過期修改",
        }),
      isConflict,
    );

    assert.throws(
      () => repoB.delete(userId, created.id, snapshotB.version),
      isConflict,
    );

    const latest = repoB.get(userId, created.id);

    assert.equal(latest.name, "A 的修改");

    assert.equal(latest.version, 2);

    const updatedB = repoB.update(userId, created.id, latest.version, {
      description: "B 讀取新版後的修改",
    });

    assert.equal(updatedB.version, 3);

    assert.equal(repoA.get(userId, created.id).version, 3);
  });

  await t.test("重新開啟資料庫後刪除專案，成員關聯正確連動清除", (t) => {
    const fixture = createFixture(t);

    let db = fixture.open();

    const ownerId = addUser(db, "delete_owner");

    const memberId = addUser(db, "delete_member");

    const created = createProjectRepository(db).create(ownerId, {
      name: "待刪除專案",
      description: "",
    });

    db.prepare(
      `
        INSERT INTO project_members (
          project_id,
          user_id,
          role
        )
        VALUES (?, ?, 'member')
      `,
    ).run(created.id, memberId);

    assert.equal(count(db, "project_members"), 2);

    fixture.close(db);

    db = fixture.open();

    createProjectRepository(db).delete(ownerId, created.id, 1);

    assert.equal(count(db, "projects"), 0);

    assert.equal(count(db, "project_members"), 0);

    assert.equal(count(db, "users"), 2);
  });

  await t.test("重新連線後外鍵、唯一性、狀態約束仍生效", (t) => {
    const fixture = createFixture(t);

    let db = fixture.open();

    const ownerId = addUser(db, "constraint_owner");

    const created = createProjectRepository(db).create(ownerId, {
      name: "約束測試",
      description: "",
    });

    fixture.close(db);

    db = fixture.open();

    assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);

    assert.throws(
      () => addUser(db, "CONSTRAINT_OWNER"),
      /UNIQUE constraint failed/,
    );

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO projects (
            name,
            owner_id
          )
          VALUES ('非法擁有者', 999999)
        `,
          )
          .run(),
      /FOREIGN KEY constraint failed/,
    );

    assert.throws(
      () =>
        db
          .prepare(
            `
          UPDATE projects
          SET status = 'invalid'
          WHERE id = ?
        `,
          )
          .run(created.id),
      /CHECK constraint failed/,
    );

    assert.throws(
      () =>
        db
          .prepare(
            `
          DELETE FROM users
          WHERE id = ?
        `,
          )
          .run(ownerId),
      /FOREIGN KEY constraint failed/,
    );

    assert.equal(count(db, "projects"), 1);
  });

  await t.test("WAL、資料完整性及多專案列表在重開後正常", (t) => {
    const fixture = createFixture(t);

    let db = fixture.open();

    const ownerId = addUser(db, "list_owner");

    const outsiderId = addUser(db, "list_outsider");

    const repo = createProjectRepository(db);

    const first = repo.create(ownerId, {
      name: "第一個",
      description: "",
    });

    const second = repo.create(ownerId, {
      name: "第二個",
      description: "",
    });

    repo.create(outsiderId, {
      name: "其他人的專案",
      description: "",
    });

    fixture.close(db);

    db = fixture.open();

    const restored = createProjectRepository(db);

    assert.deepEqual(
      restored.list(ownerId).map((project) => project.id),
      [second.id, first.id],
    );

    assert.equal(restored.list(outsiderId).length, 1);

    assert.equal(db.prepare("PRAGMA journal_mode").get().journal_mode, "wal");

    assert.equal(
      db.prepare("PRAGMA integrity_check").get().integrity_check,
      "ok",
    );

    const indexes = db
      .prepare(
        `
        SELECT name
        FROM sqlite_master
        WHERE type = 'index'
          AND name IN (
            'idx_projects_owner_id',
            'idx_project_members_user_id'
          )
      `,
      )
      .all();

    assert.equal(indexes.length, 2);
  });
});
