"use strict";

// M6-A：只使用隔離的記憶體 SQLite。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { ProjectError } = require("../server/project-repository");
const {
  createTaskOrderRepository,
} = require("../server/task-order-repository");

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE projects (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE project_members (
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    INSERT INTO projects (id, status)
    VALUES (1, 'active'), (2, 'active');

    INSERT INTO project_members (project_id, user_id, role)
    VALUES
      (1, 10, 'owner'),
      (1, 20, 'admin'),
      (1, 30, 'member'),
      (2, 40, 'owner');
  `);

  // 使用專案現有 M5 tasks Schema。
  db.exec(
    fs.readFileSync(
      path.join(__dirname, "..", "server", "task-schema.sql"),
      "utf8",
    ),
  );

  const insert = db.prepare(`
    INSERT INTO tasks (project_id, title, status, position)
    VALUES (?, ?, ?, ?)
  `);

  const a = Number(insert.run(1, "A", "todo", 0).lastInsertRowid);
  const b = Number(insert.run(1, "B", "todo", 1).lastInsertRowid);
  const c = Number(insert.run(1, "C", "todo", 2).lastInsertRowid);
  const d = Number(insert.run(1, "D", "in_progress", 0).lastInsertRowid);
  const x = Number(insert.run(2, "X", "todo", 0).lastInsertRowid);

  return {
    db,
    ids: { a, b, c, d, x },
    order: createTaskOrderRepository(db),

    rows: (projectId = 1) =>
      db
        .prepare(
          `
        SELECT id, title, status, position, version
        FROM tasks
        WHERE project_id = ?
        ORDER BY CASE status
          WHEN 'todo' THEN 0
          WHEN 'in_progress' THEN 1
          ELSE 2 END, position, id
      `,
        )
        .all(projectId),
  };
}

function errorIs(status, code) {
  return (error) =>
    error instanceof ProjectError &&
    error.status === status &&
    error.code === code;
}

test("M6-A Task Order Repository", async (t) => {
  await t.test("既有 position 與索引存在", (t) => {
    const f = fixture(t);

    assert.ok(
      f.db
        .prepare("PRAGMA table_info(tasks)")
        .all()
        .some((row) => row.name === "position"),
    );

    assert.ok(
      f.db
        .prepare("PRAGMA index_list(tasks)")
        .all()
        .some((row) => row.name === "idx_tasks_project_board"),
    );
  });

  await t.test("沒有變動時不增加 version", (t) => {
    const f = fixture(t);
    const before = f.rows();

    const result = f.order.move(10, 1, f.ids.a, 1, {
      status: "todo",
      index: 0,
    });

    assert.deepEqual(f.rows(), before);
    assert.deepEqual(result.changedTaskIds, []);
  });

  await t.test("同欄排序，位置與版本正確", (t) => {
    const f = fixture(t);

    const result = f.order.move(10, 1, f.ids.c, 1, {
      status: "todo",
      index: 0,
    });

    assert.deepEqual(
      f
        .rows()
        .filter((row) => row.status === "todo")
        .map((row) => [row.title, row.position, row.version]),
      [
        ["C", 0, 2],
        ["A", 1, 2],
        ["B", 2, 2],
      ],
    );

    assert.equal(f.rows().find((row) => row.title === "D").version, 1);

    assert.equal(result.task.id, f.ids.c);
    assert.equal(result.changedTaskIds.length, 3);
  });

  await t.test("跨欄移動，同時整理兩個欄位", (t) => {
    const f = fixture(t);

    f.order.move(20, 1, f.ids.a, 1, {
      status: "in_progress",
      index: 0,
    });

    assert.deepEqual(
      f.rows().map((row) => [row.title, row.status, row.position]),
      [
        ["B", "todo", 0],
        ["C", "todo", 1],
        ["A", "in_progress", 0],
        ["D", "in_progress", 1],
      ],
    );

    assert.deepEqual(
      f.rows().map((row) => row.version),
      [2, 2, 2, 2],
    );
  });

  await t.test("重複 position 可安全重新排序", (t) => {
    const f = fixture(t);

    f.db.exec(`
      UPDATE tasks SET position = 0
      WHERE project_id = 1 AND status = 'todo'
    `);

    f.order.move(10, 1, f.ids.c, 1, {
      status: "todo",
      index: 1,
    });

    assert.deepEqual(
      f
        .rows()
        .filter((row) => row.status === "todo")
        .map((row) => [row.title, row.position]),
      [
        ["A", 0],
        ["C", 1],
        ["B", 2],
      ],
    );
  });

  await t.test("Member、非成員及跨專案操作被拒絕", (t) => {
    const f = fixture(t);
    const before = f.rows();

    assert.throws(
      () =>
        f.order.move(30, 1, f.ids.a, 1, {
          status: "todo",
          index: 1,
        }),
      errorIs(403, "FORBIDDEN"),
    );

    assert.throws(
      () =>
        f.order.move(40, 1, f.ids.a, 1, {
          status: "todo",
          index: 1,
        }),
      errorIs(404, "PROJECT_NOT_FOUND"),
    );

    assert.throws(
      () =>
        f.order.move(10, 1, f.ids.x, 1, {
          status: "todo",
          index: 0,
        }),
      errorIs(404, "TASK_NOT_FOUND"),
    );

    assert.deepEqual(f.rows(), before);
  });

  await t.test("封存專案禁止排序", (t) => {
    const f = fixture(t);

    f.db.exec(`
      UPDATE projects SET status = 'archived'
      WHERE id = 1
    `);

    assert.throws(
      () =>
        f.order.move(10, 1, f.ids.a, 1, {
          status: "done",
          index: 0,
        }),
      errorIs(403, "PROJECT_ARCHIVED"),
    );
  });

  await t.test("過期版本回傳 409，資料不變", (t) => {
    const f = fixture(t);
    const before = f.rows();

    assert.throws(
      () =>
        f.order.move(10, 1, f.ids.a, 99, {
          status: "done",
          index: 0,
        }),
      errorIs(409, "VERSION_CONFLICT"),
    );

    assert.deepEqual(f.rows(), before);
  });

  await t.test("非法輸入一律拒絕", (t) => {
    const f = fixture(t);
    const before = f.rows();

    const invalidInputs = [
      { status: "todo", index: -1 },
      { status: "todo", index: 3 },
      { status: "unknown", index: 0 },
      { status: "todo", index: "0" },
      { status: "todo", index: 0, actorId: 10 },
      null,
    ];

    for (const data of invalidInputs) {
      assert.throws(
        () => f.order.move(10, 1, f.ids.a, 1, data),
        errorIs(400, "INVALID_INPUT"),
      );
    }

    assert.throws(
      () =>
        f.order.move(10, 1, f.ids.a, 0, {
          status: "done",
          index: 0,
        }),
      errorIs(400, "INVALID_INPUT"),
    );

    assert.deepEqual(f.rows(), before);
  });

  await t.test("SQL 失敗時完整 Transaction Rollback", (t) => {
    const f = fixture(t);
    const before = f.rows();

    f.db.exec(`
      CREATE TRIGGER reject_m6_test_update
      BEFORE UPDATE ON tasks
      WHEN NEW.id = ${f.ids.b}
      BEGIN
        SELECT RAISE(ABORT, 'injected update failure');
      END;
    `);

    assert.throws(() =>
      f.order.move(10, 1, f.ids.c, 1, {
        status: "todo",
        index: 0,
      }),
    );

    assert.deepEqual(f.rows(), before);

    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  });
});
