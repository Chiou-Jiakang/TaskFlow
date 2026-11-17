"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { openDatabase, initializeSchema } = require("../server/db");
const { initializeAuthSchema } = require("../server/auth-foundation");
const {
  createProjectRepository,
  ProjectError,
} = require("../server/project-repository");
const { createMemberRepository } = require("../server/member-repository");
const {
  initializeTaskSchema,
  createTaskRepository,
} = require("../server/task-repository");

function setup(t, dbPath = ":memory:") {
  const db = openDatabase(dbPath);
  initializeSchema(db);
  initializeAuthSchema(db);
  initializeTaskSchema(db);
  t.after(() => db.close());

  const addUser = db.prepare(`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (?, 'TEST_ONLY_NOT_REAL_HASH', ?)
  `);
  function user(email, name) {
    return Number(addUser.run(email, name).lastInsertRowid);
  }
  const owner = user("m5-owner@example.test", "Owner");
  const admin = user("m5-admin@example.test", "Admin");
  const member = user("m5-member@example.test", "Member");
  const outsider = user("m5-outsider@example.test", "Outsider");

  const projectRepo = createProjectRepository(db);
  const project = projectRepo.create(owner, {
    name: "M5 任務測試專案",
    description: "isolated test",
  });
  const secondProject = projectRepo.create(outsider, {
    name: "其他專案",
    description: "not accessible",
  });
  const memberRepo = createMemberRepository(db);
  memberRepo.add(owner, project.id, 1, {
    email: "m5-admin@example.test",
    role: "admin",
  });
  memberRepo.add(owner, project.id, 2, {
    email: "m5-member@example.test",
    role: "member",
  });

  return {
    db,
    repo: createTaskRepository(db),
    memberRepo,
    projectRepo,
    projectId: project.id,
    secondProjectId: secondProject.id,
    owner,
    admin,
    member,
    outsider,
  };
}

function isError(status, code) {
  return (error) =>
    error instanceof ProjectError &&
    error.status === status &&
    error.code === code;
}

test("M5-A Task Schema / Repository", async (t) => {
  await t.test("增量建表可重複執行，舊資料與 Session 表不消失", (t) => {
    const f = setup(t);
    assert.doesNotThrow(() => initializeTaskSchema(f.db));
    const tables = f.db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all()
      .map((row) => row.name);
    for (const name of [
      "users",
      "projects",
      "project_members",
      "auth_sessions",
      "tasks",
    ]) {
      assert.ok(tables.includes(name));
    }
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 4);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(f.db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  });

  await t.test("Owner 建立任務，預設狀態、優先度、版本正確", (t) => {
    const f = setup(t);
    const task = f.repo.create(f.owner, f.projectId, { title: "  完成 API  " });
    assert.equal(task.title, "完成 API");
    assert.equal(task.status, "todo");
    assert.equal(task.priority, "medium");
    assert.equal(task.version, 1);
    assert.equal(task.assigneeId, null);
    assert.equal(task.dueDate, null);
    assert.equal(task.position, 0);
    assert.ok(task.createdAt);
    assert.equal(f.repo.list(f.member, f.projectId).length, 1);
    assert.equal(f.repo.get(f.owner, f.projectId, task.id).id, task.id);
    assert.equal(
      f.db.prepare("SELECT version FROM projects WHERE id = ?").get(f.projectId)
        .version,
      3,
    );
  });

  await t.test("非成員無法讀取、建立、修改或刪除任務", (t) => {
    const f = setup(t);
    const row = f.repo.create(f.owner, f.projectId, { title: "private" });
    assert.throws(
      () => f.repo.list(f.outsider, f.projectId),
      isError(404, "PROJECT_NOT_FOUND"),
    );
    assert.throws(
      () => f.repo.get(f.outsider, f.projectId, row.id),
      isError(404, "PROJECT_NOT_FOUND"),
    );
    assert.throws(
      () => f.repo.create(f.outsider, f.projectId, { title: "bad" }),
      isError(404, "PROJECT_NOT_FOUND"),
    );
    assert.throws(
      () => f.repo.update(f.outsider, f.projectId, row.id, 1, { title: "bad" }),
      isError(404, "PROJECT_NOT_FOUND"),
    );
    assert.throws(
      () => f.repo.delete(f.outsider, f.projectId, row.id, 1),
      isError(404, "PROJECT_NOT_FOUND"),
    );
  });

  await t.test("Admin 可新增，Member 無法新增或刪除", (t) => {
    const f = setup(t);
    const row = f.repo.create(f.admin, f.projectId, { title: "Admin's task" });
    assert.equal(row.title, "Admin's task");
    assert.throws(
      () => f.repo.create(f.member, f.projectId, { title: "no" }),
      isError(403, "FORBIDDEN"),
    );
    assert.throws(
      () => f.repo.delete(f.member, f.projectId, row.id, 1),
      isError(403, "FORBIDDEN"),
    );
    assert.equal(f.repo.list(f.owner, f.projectId).length, 1);
  });

  await t.test("負責人必須屬於同專案，外鍵拒絕跨專案寫入", (t) => {
    const f = setup(t);
    const good = f.repo.create(f.owner, f.projectId, {
      title: "assigned",
      assigneeId: f.member,
    });
    assert.equal(good.assigneeId, f.member);
    assert.throws(
      () =>
        f.repo.create(f.owner, f.projectId, {
          title: "cross-project",
          assigneeId: f.outsider,
        }),
      isError(400, "ASSIGNEE_NOT_MEMBER"),
    );
    assert.throws(
      () =>
        f.db
          .prepare(
            `
      INSERT INTO tasks (project_id, title, assignee_id) VALUES (?, ?, ?)
    `,
          )
          .run(f.projectId, "bad direct SQL", f.outsider),
      /FOREIGN KEY constraint failed/,
    );
    assert.equal(f.repo.list(f.owner, f.projectId).length, 1);
  });

  await t.test("Member 只可修改自己受指派任務的 status", (t) => {
    const f = setup(t);
    const task = f.repo.create(f.owner, f.projectId, {
      title: "進行中",
      assigneeId: f.member,
    });
    assert.equal(
      f.repo.update(f.member, f.projectId, task.id, 1, {
        status: "in_progress",
      }).version,
      2,
    );
    assert.throws(
      () =>
        f.repo.update(f.member, f.projectId, task.id, 2, { title: "hijack" }),
      isError(403, "FORBIDDEN"),
    );
    const other = f.repo.create(f.owner, f.projectId, {
      title: "not assigned",
    });
    assert.throws(
      () =>
        f.repo.update(f.member, f.projectId, other.id, 1, { status: "done" }),
      isError(403, "FORBIDDEN"),
    );
    assert.equal(f.repo.get(f.owner, f.projectId, task.id).title, "進行中");
  });

  await t.test("Task version 樂觀鎖拒絕過期更新，失敗時資料不變", (t) => {
    const f = setup(t);
    const task = f.repo.create(f.owner, f.projectId, { title: "Original" });
    const newTask = f.repo.update(f.admin, f.projectId, task.id, 1, {
      title: "Updated",
      priority: "high",
    });
    assert.equal(newTask.version, 2);
    assert.equal(newTask.priority, "high");
    assert.throws(
      () => f.repo.update(f.owner, f.projectId, task.id, 1, { title: "Stale" }),
      isError(409, "VERSION_CONFLICT"),
    );
    assert.equal(f.repo.get(f.owner, f.projectId, task.id).title, "Updated");
  });

  await t.test("欄位驗證、非法日期、非法 status 不寫入資料", (t) => {
    const f = setup(t);
    const badCases = [
      { title: "   " },
      { title: "x".repeat(121) },
      { title: "ok", priority: "critical" },
      { title: "ok", status: "blocked" },
      { title: "ok", dueDate: "2026-02-30" },
      { title: "ok", dueDate: "not a date" },
      { title: "ok", position: -1 },
      { title: "ok", ownerId: f.outsider },
    ];
    for (const bad of badCases) {
      assert.throws(
        () => f.repo.create(f.owner, f.projectId, bad),
        isError(400, "INVALID_INPUT"),
      );
    }
    assert.equal(f.repo.list(f.owner, f.projectId).length, 0);
  });

  await t.test("位置排序及完整欄位更新可回讀", (t) => {
    const f = setup(t);
    const b = f.repo.create(f.owner, f.projectId, { title: "B", position: 10 });
    const a = f.repo.create(f.owner, f.projectId, { title: "A", position: 2 });
    assert.deepEqual(
      f.repo.list(f.owner, f.projectId).map((x) => x.title),
      ["A", "B"],
    );
    const updated = f.repo.update(f.owner, f.projectId, b.id, 1, {
      title: "Changed",
      description: "Details",
      status: "done",
      priority: "high",
      position: 0,
      dueDate: "2026-12-25",
      assigneeId: f.admin,
    });
    assert.equal(updated.status, "done");
    assert.equal(updated.dueDate, "2026-12-25");
    assert.equal(updated.assigneeId, f.admin);
    assert.equal(updated.version, 2);
    assert.equal(f.repo.get(f.owner, f.projectId, a.id).version, 1);
  });

  await t.test("刪除需 Owner/Admin 及正確版本；刪除後 404", (t) => {
    const f = setup(t);
    const task = f.repo.create(f.owner, f.projectId, { title: "Delete" });
    assert.throws(
      () => f.repo.delete(f.admin, f.projectId, task.id, 2),
      isError(409, "VERSION_CONFLICT"),
    );
    assert.equal(
      f.repo.delete(f.admin, f.projectId, task.id, 1).deletedTaskId,
      task.id,
    );
    assert.throws(
      () => f.repo.get(f.owner, f.projectId, task.id),
      isError(404, "TASK_NOT_FOUND"),
    );
  });

  await t.test("成員離開自動解除指派，任務版本增加", (t) => {
    const f = setup(t);
    const task = f.repo.create(f.owner, f.projectId, {
      title: "Unassign",
      assigneeId: f.member,
    });
    f.memberRepo.remove(f.member, f.projectId, f.member, 3);
    const after = f.repo.get(f.owner, f.projectId, task.id);
    assert.equal(after.assigneeId, null);
    assert.equal(after.version, 2);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  });

  await t.test("刪除專案時任務 Cascade 刪除", (t) => {
    const f = setup(t);
    f.repo.create(f.owner, f.projectId, { title: "Cascade" });
    f.projectRepo.delete(f.owner, f.projectId, 3);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM tasks").get().n, 0);
  });

  await t.test("封存專案可讀，但不能新增、修改、刪除任務", (t) => {
    const f = setup(t);
    const task = f.repo.create(f.owner, f.projectId, { title: "Archived" });
    f.projectRepo.update(f.owner, f.projectId, 3, { status: "archived" });
    assert.equal(f.repo.get(f.member, f.projectId, task.id).title, "Archived");
    assert.throws(
      () => f.repo.create(f.owner, f.projectId, { title: "New" }),
      isError(403, "PROJECT_ARCHIVED"),
    );
    assert.throws(
      () =>
        f.repo.update(f.owner, f.projectId, task.id, 1, { title: "Update" }),
      isError(403, "PROJECT_ARCHIVED"),
    );
    assert.throws(
      () => f.repo.delete(f.owner, f.projectId, task.id, 1),
      isError(403, "PROJECT_ARCHIVED"),
    );
  });

  await t.test("重新開啟檔案型 SQLite 後任務仍存在", (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m5a-"));
    const file = path.join(dir, "tasks.db");
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    let db = openDatabase(file);
    initializeSchema(db);
    initializeAuthSchema(db);
    initializeTaskSchema(db);
    const owner = Number(
      db
        .prepare(
          `INSERT INTO users(email,password_hash,display_name)
      VALUES ('persist@example.test', 'TEST_ONLY', 'Persist')`,
        )
        .run().lastInsertRowid,
    );
    const project = createProjectRepository(db).create(owner, {
      name: "Persist",
      description: "",
    });
    const id = createTaskRepository(db).create(owner, project.id, {
      title: "保留此任務",
      dueDate: "2026-12-01",
    }).id;
    db.close();
    db = openDatabase(file);
    try {
      initializeSchema(db);
      initializeAuthSchema(db);
      initializeTaskSchema(db);
      assert.equal(
        createTaskRepository(db).get(owner, project.id, id).title,
        "保留此任務",
      );
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      db.close();
    }
  });
});
