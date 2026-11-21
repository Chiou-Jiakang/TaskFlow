"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { openDatabase, initializeSchema } = require("../server/db");
const { initializeTaskSchema } = require("../server/task-repository");
const { ProjectError } = require("../server/project-repository");
const {
  initializeCollaborationSchema,
  createCollaborationRepository,
} = require("../server/collaboration-repository");

function fixture(t, filename = ":memory:") {
  const db = openDatabase(filename);
  t.after(() => db.close());
  initializeSchema(db);
  initializeTaskSchema(db);
  initializeCollaborationSchema(db);

  const insertUser = db.prepare(`
    INSERT INTO users(email, password_hash, display_name)
    VALUES (?, 'TEST_HASH_ONLY', ?)
  `);
  const addUser = (email, name) => Number(insertUser.run(email, name).lastInsertRowid);
  const owner = addUser("m8-owner@example.test", "Owner");
  const admin = addUser("m8-admin@example.test", "Admin");
  const member = addUser("m8-member@example.test", "Member");
  const outsider = addUser("m8-outsider@example.test", "Outsider");

  const insertProject = db.prepare("INSERT INTO projects(name, owner_id) VALUES (?, ?)");
  const projectId = Number(insertProject.run("M8 協作專案", owner).lastInsertRowid);
  const otherProjectId = Number(insertProject.run("隔離專案", outsider).lastInsertRowid);
  const insertMember = db.prepare(`
    INSERT INTO project_members(project_id, user_id, role) VALUES (?, ?, ?)
  `);
  insertMember.run(projectId, owner, "owner");
  insertMember.run(projectId, admin, "admin");
  insertMember.run(projectId, member, "member");
  insertMember.run(otherProjectId, outsider, "owner");

  const insertTask = db.prepare("INSERT INTO tasks(project_id, title) VALUES (?, ?)");
  const taskId = Number(insertTask.run(projectId, "M8 的測試任務").lastInsertRowid);
  const otherTaskId = Number(insertTask.run(otherProjectId, "其他專案任務").lastInsertRowid);
  return {
    db, owner, admin, member, outsider, projectId, otherProjectId, taskId, otherTaskId,
    repo: createCollaborationRepository(db),
  };
}

function errorIs(status, code) {
  return (error) => error instanceof ProjectError && error.status === status && error.code === code;
}

test("M8-A Collaboration Schema / Repository", async (t) => {
  await t.test("Schema 可重複初始化，不清除原本 users/projects/tasks", (t) => {
    const f = fixture(t);
    assert.doesNotThrow(() => initializeCollaborationSchema(f.db));
    const tables = f.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    for (const table of ["users", "projects", "project_members", "tasks", "task_comments", "project_activity"]) {
      assert.ok(tables.includes(table), `missing ${table}`);
    }
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 4);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  });

  await t.test("Owner/Admin/Member 均可留言，版本和作者資訊可回讀", (t) => {
    const f = fixture(t);
    for (const userId of [f.owner, f.admin, f.member]) {
      const row = f.repo.createComment(userId, f.projectId, f.taskId, "  留言內容  ");
      assert.equal(row.body, "留言內容");
      assert.equal(row.authorId, userId);
      assert.equal(row.version, 1);
      assert.ok(row.authorName);
    }
    assert.equal(f.repo.listComments(f.member, f.projectId, f.taskId).length, 3);
    assert.equal(f.repo.listActivity(f.owner, f.projectId).length, 3);
  });

  await t.test("匿名、非成員與跨專案的讀寫一律被拒絕", (t) => {
    const f = fixture(t);
    assert.throws(() => f.repo.listComments(f.outsider, f.projectId, f.taskId), errorIs(404, "PROJECT_NOT_FOUND"));
    assert.throws(() => f.repo.createComment(f.outsider, f.projectId, f.taskId, "X"), errorIs(404, "PROJECT_NOT_FOUND"));
    assert.throws(() => f.repo.listActivity(f.outsider, f.projectId), errorIs(404, "PROJECT_NOT_FOUND"));
    assert.throws(() => f.repo.listComments(f.owner, f.projectId, f.otherTaskId), errorIs(404, "TASK_NOT_FOUND"));
    assert.throws(() => f.repo.createComment(0, f.projectId, f.taskId, "X"), errorIs(400, "INVALID_INPUT"));
  });

  await t.test("SQL Trigger 擋下直接把留言掛到其他專案任務", (t) => {
    const f = fixture(t);
    assert.throws(() => f.db.prepare(`
      INSERT INTO task_comments(project_id, task_id, author_id, body)
      VALUES (?, ?, ?, '非法留言')
    `).run(f.projectId, f.otherTaskId, f.owner), /TASK_PROJECT_MISMATCH/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM task_comments").get().n, 0);
  });

  await t.test("空白、非字串、過長留言以及錯誤分頁不可寫入", (t) => {
    const f = fixture(t);
    for (const invalid of [null, 1, "   ", "a".repeat(2001)]) {
      assert.throws(() => f.repo.createComment(f.owner, f.projectId, f.taskId, invalid), errorIs(400, "INVALID_INPUT"));
    }
    assert.throws(() => f.repo.listComments(f.owner, f.projectId, f.taskId, { limit: 101 }), errorIs(400, "INVALID_INPUT"));
    assert.throws(() => f.repo.listActivity(f.owner, f.projectId, { unknown: true }), errorIs(400, "INVALID_INPUT"));
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM task_comments").get().n, 0);
  });

  await t.test("留言只能由作者編輯；舊版本 409 且資料不變", (t) => {
    const f = fixture(t);
    const row = f.repo.createComment(f.member, f.projectId, f.taskId, "第一版");
    assert.throws(() => f.repo.updateComment(f.admin, f.projectId, f.taskId, row.id, 1, "竄改"), errorIs(403, "FORBIDDEN"));
    const updated = f.repo.updateComment(f.member, f.projectId, f.taskId, row.id, 1, "第二版");
    assert.equal(updated.version, 2);
    assert.equal(updated.body, "第二版");
    assert.throws(() => f.repo.updateComment(f.member, f.projectId, f.taskId, row.id, 1, "舊版本"), errorIs(409, "VERSION_CONFLICT"));
    assert.equal(f.repo.getComment(f.owner, f.projectId, f.taskId, row.id).body, "第二版");
    assert.deepEqual(f.repo.listActivity(f.owner, f.projectId).map((x) => x.action), ["comment_updated", "comment_created"]);
  });

  await t.test("作者、Admin、Owner 可以軟刪除；其他 Member 不可", (t) => {
    const f = fixture(t);
    const row = f.repo.createComment(f.member, f.projectId, f.taskId, "稍後刪除");
    // Another project member needs to be a regular Member, not Admin/Owner.
    const otherMember = Number(f.db.prepare("INSERT INTO users(email,password_hash,display_name) VALUES ('m8-other@example.test','X','Other')").run().lastInsertRowid);
    f.db.prepare("INSERT INTO project_members(project_id,user_id,role) VALUES (?,?,'member')").run(f.projectId, otherMember);
    assert.throws(() => f.repo.deleteComment(otherMember, f.projectId, f.taskId, row.id, 1), errorIs(403, "FORBIDDEN"));
    assert.deepEqual(f.repo.deleteComment(f.admin, f.projectId, f.taskId, row.id, 1), { deletedCommentId: row.id });
    assert.equal(f.repo.listComments(f.member, f.projectId, f.taskId).length, 0);
    assert.throws(() => f.repo.getComment(f.owner, f.projectId, f.taskId, row.id), errorIs(404, "COMMENT_NOT_FOUND"));
    assert.equal(f.repo.listActivity(f.owner, f.projectId)[0].action, "comment_deleted");
    assert.equal(f.db.prepare("SELECT body,is_deleted,version FROM task_comments WHERE id=?").get(row.id).is_deleted, 1);
  });

  await t.test("封存專案可讀但不可新增、編輯、刪除留言", (t) => {
    const f = fixture(t);
    const row = f.repo.createComment(f.owner, f.projectId, f.taskId, "原始留言");
    f.db.prepare("UPDATE projects SET status='archived' WHERE id=?").run(f.projectId);
    assert.equal(f.repo.listComments(f.member, f.projectId, f.taskId).length, 1);
    assert.throws(() => f.repo.createComment(f.owner, f.projectId, f.taskId, "新增"), errorIs(403, "PROJECT_ARCHIVED"));
    assert.throws(() => f.repo.updateComment(f.owner, f.projectId, f.taskId, row.id, 1, "修改"), errorIs(403, "PROJECT_ARCHIVED"));
    assert.throws(() => f.repo.deleteComment(f.owner, f.projectId, f.taskId, row.id, 1), errorIs(403, "PROJECT_ARCHIVED"));
  });

  await t.test("分頁上限與 beforeId 游標均能正常運作", (t) => {
    const f = fixture(t);
    const comments = Array.from({ length: 5 }, (_, i) => f.repo.createComment(f.owner, f.projectId, f.taskId, `留言 ${i}`));
    const page1 = f.repo.listComments(f.member, f.projectId, f.taskId, { limit: 2 });
    const page2 = f.repo.listComments(f.member, f.projectId, f.taskId, { limit: 2, beforeId: page1.at(-1).id });
    assert.deepEqual(page1.map((x) => x.id), [comments[4].id, comments[3].id]);
    assert.deepEqual(page2.map((x) => x.id), [comments[2].id, comments[1].id]);
    assert.equal(f.repo.listActivity(f.owner, f.projectId, { limit: 2 }).length, 2);
  });

  await t.test("活動紀錄僅儲存事件資訊、不洩漏留言內文", (t) => {
    const f = fixture(t);
    f.repo.createComment(f.owner, f.projectId, f.taskId, "_PRIVATE_COMMENT_TEXT_");
    const activity = f.repo.listActivity(f.member, f.projectId)[0];
    assert.equal(activity.action, "comment_created");
    assert.equal(activity.projectId, f.projectId);
    assert.ok(!JSON.stringify(activity).includes("_PRIVATE_COMMENT_TEXT_"));
  });

  await t.test("Task 刪除後留言連動刪除，活動紀錄仍保留事件", (t) => {
    const f = fixture(t);
    f.repo.createComment(f.owner, f.projectId, f.taskId, "跟著任務刪除");
    f.db.prepare("DELETE FROM tasks WHERE id=?").run(f.taskId);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM task_comments").get().n, 0);
    const activity = f.repo.listActivity(f.owner, f.projectId)[0];
    assert.equal(activity.taskId, null);
    assert.equal(activity.commentId, null);
    assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(), []);
  });

  await t.test("活動紀錄插入失敗會 Rollback，不留下半筆留言", (t) => {
    const f = fixture(t);
    f.db.exec(`
      CREATE TRIGGER test_injected_activity_error
      BEFORE INSERT ON project_activity
      BEGIN SELECT RAISE(ABORT, 'INJECTED_ACTIVITY_FAILURE'); END;
    `);
    assert.throws(() => f.repo.createComment(f.owner, f.projectId, f.taskId, "不應儲存"), /INJECTED_ACTIVITY_FAILURE/);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM task_comments").get().n, 0);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM project_activity").get().n, 0);
  });

  await t.test("檔案型 SQLite 重開後留言仍保留", (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m8a-"));
    const filename = path.join(dir, "comments.db");
    const f = fixture(t, filename);
    const row = f.repo.createComment(f.owner, f.projectId, f.taskId, "持久化內容");
    const reopened = openDatabase(filename);
    t.after(() => reopened.close());
    // Windows：先關閉 SQLite 的兩個連線，再刪除暫存目錄。
    // t.after() 按登記順序執行，fixture 已先登記原始 db.close()。
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    initializeCollaborationSchema(reopened);
    const otherRepo = createCollaborationRepository(reopened);
    assert.equal(otherRepo.getComment(f.member, f.projectId, f.taskId, row.id).body, "持久化內容");
  });
});
