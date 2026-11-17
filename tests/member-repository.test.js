"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { openDatabase, initializeSchema } = require("../server/db");

const {
  createProjectRepository,
  ProjectError,
} = require("../server/project-repository");

const {
  ROLES,
  can,
  createMemberRepository,
} = require("../server/member-repository");

function setup(t) {
  // 不影響 data/taskflow.db
  const db = openDatabase(":memory:");
  initializeSchema(db);

  t.after(() => db.close());

  const addUser = db.prepare(`
    INSERT INTO users(email, password_hash, display_name)
    VALUES (?, 'TEST_ONLY', ?)
  `);

  function user(email, name) {
    return Number(addUser.run(email, name).lastInsertRowid);
  }

  const owner = user("owner@example.test", "Owner");

  const admin = user("admin@example.test", "Admin");

  const member = user("member@example.test", "Member");

  const outsider = user("outsider@example.test", "Outsider");

  const project = createProjectRepository(db).create(owner, {
    name: "M4 測試專案",
    description: "只存在記憶體中",
  });

  const repo = createMemberRepository(db);

  const version = () =>
    db.prepare("SELECT version FROM projects WHERE id = ?").get(project.id)
      .version;

  return {
    db,
    repo,
    owner,
    admin,
    member,
    outsider,
    projectId: project.id,
    version,
  };
}

function isError(status, code) {
  return (err) =>
    err instanceof ProjectError && err.status === status && err.code === code;
}

test("M4-A Member Repository and RBAC foundation", async (t) => {
  await t.test("角色權限矩陣明確且預設拒絕", () => {
    assert.deepEqual(ROLES, ["owner", "admin", "member"]);

    assert.equal(can("owner", "change_role"), true);
    assert.equal(can("admin", "change_role"), false);
    assert.equal(can("admin", "add_member"), true);
    assert.equal(can("admin", "add_admin"), false);
    assert.equal(can("member", "read"), true);
    assert.equal(can("member", "add_member"), false);
    assert.equal(can("unknown", "read"), false);
  });

  await t.test("建專案自帶 Owner；清單不洩漏密碼 Hash", (t) => {
    const f = setup(t);
    const list = f.repo.list(f.owner, f.projectId);

    assert.equal(list.version, 1);
    assert.equal(list.members.length, 1);
    assert.equal(list.members[0].role, "owner");
    assert.equal(list.members[0].userId, f.owner);
    assert.equal("password_hash" in list.members[0], false);
  });

  await t.test("未加入專案者看不到成員清單與專案存在資訊", (t) => {
    const f = setup(t);

    assert.throws(
      () => f.repo.list(f.outsider, f.projectId),
      isError(404, "PROJECT_NOT_FOUND"),
    );

    assert.throws(
      () =>
        f.repo.add(f.outsider, f.projectId, 1, {
          email: "member@example.test",
        }),
      isError(404, "PROJECT_NOT_FOUND"),
    );
  });

  await t.test("Owner 可按 Email 新增 Member，並更新版本", (t) => {
    const f = setup(t);

    const added = f.repo.add(f.owner, f.projectId, 1, {
      email: " MEMBER@EXAMPLE.TEST ",
    });

    assert.equal(added.member.userId, f.member);
    assert.equal(added.member.role, "member");
    assert.equal(added.version, 2);
    assert.equal(f.version(), 2);

    assert.equal(f.repo.list(f.member, f.projectId).members.length, 2);
  });

  await t.test("Admin 能新增 Member，不能建立 Admin 或 Owner", (t) => {
    const f = setup(t);

    f.repo.add(f.owner, f.projectId, 1, {
      email: "admin@example.test",
      role: "admin",
    });

    const added = f.repo.add(f.admin, f.projectId, 2, {
      email: "member@example.test",
    });

    assert.equal(added.member.role, "member");

    assert.throws(
      () =>
        f.repo.add(f.admin, f.projectId, 3, {
          email: "outsider@example.test",
          role: "admin",
        }),
      isError(403, "FORBIDDEN"),
    );

    assert.throws(
      () =>
        f.repo.add(f.owner, f.projectId, 3, {
          email: "outsider@example.test",
          role: "owner",
        }),
      isError(400, "INVALID_ROLE"),
    );
  });

  await t.test("非法 Email、不存在帳號、重複加入不更動資料", (t) => {
    const f = setup(t);

    assert.throws(
      () => f.repo.add(f.owner, f.projectId, 1, { email: "not-email" }),
      isError(400, "INVALID_INPUT"),
    );

    assert.throws(
      () =>
        f.repo.add(f.owner, f.projectId, 1, { email: "missing@example.test" }),
      isError(404, "USER_NOT_FOUND"),
    );

    assert.throws(
      () =>
        f.repo.add(f.owner, f.projectId, 1, { email: "owner@example.test" }),
      isError(409, "ALREADY_MEMBER"),
    );

    assert.equal(f.version(), 1);

    assert.equal(f.repo.list(f.owner, f.projectId).members.length, 1);
  });

  await t.test("Member 無新增與調整角色權限", (t) => {
    const f = setup(t);

    f.repo.add(f.owner, f.projectId, 1, { email: "member@example.test" });

    assert.throws(
      () =>
        f.repo.add(f.member, f.projectId, 2, {
          email: "outsider@example.test",
        }),
      isError(403, "FORBIDDEN"),
    );

    assert.throws(
      () => f.repo.changeRole(f.member, f.projectId, f.member, 2, "admin"),
      isError(403, "FORBIDDEN"),
    );

    assert.equal(f.version(), 2);
  });

  await t.test("只有 Owner 可升降角色，Owner 本身不可變更", (t) => {
    const f = setup(t);

    f.repo.add(f.owner, f.projectId, 1, { email: "member@example.test" });

    assert.equal(
      f.repo.changeRole(f.owner, f.projectId, f.member, 2, "admin").version,
      3,
    );

    assert.equal(
      f.repo.changeRole(f.owner, f.projectId, f.member, 3, "member").member
        .role,
      "member",
    );

    assert.throws(
      () => f.repo.changeRole(f.owner, f.projectId, f.owner, 4, "member"),
      isError(403, "OWNER_PROTECTED"),
    );

    assert.throws(
      () => f.repo.changeRole(f.owner, f.projectId, f.member, 4, "member"),
      isError(409, "ROLE_UNCHANGED"),
    );
  });

  await t.test("Admin 只能移除 Member；Member 可自行離開", (t) => {
    const f = setup(t);

    f.repo.add(f.owner, f.projectId, 1, {
      email: "admin@example.test",
      role: "admin",
    });

    f.repo.add(f.owner, f.projectId, 2, { email: "member@example.test" });

    assert.throws(
      () => f.repo.remove(f.member, f.projectId, f.admin, 3),
      isError(403, "FORBIDDEN"),
    );

    assert.throws(
      () => f.repo.remove(f.admin, f.projectId, f.owner, 3),
      isError(403, "OWNER_PROTECTED"),
    );

    assert.equal(f.repo.remove(f.admin, f.projectId, f.member, 3).version, 4);

    assert.throws(
      () => f.repo.list(f.member, f.projectId),
      isError(404, "PROJECT_NOT_FOUND"),
    );

    assert.equal(f.repo.remove(f.admin, f.projectId, f.admin, 4).version, 5);

    assert.equal(f.repo.list(f.owner, f.projectId).members.length, 1);
  });

  await t.test("舊版請求 409，操作回滾，Owner 不可退出", (t) => {
    const f = setup(t);

    f.repo.add(f.owner, f.projectId, 1, { email: "member@example.test" });

    assert.throws(
      () => f.repo.remove(f.owner, f.projectId, f.member, 1),
      isError(409, "VERSION_CONFLICT"),
    );

    assert.equal(f.version(), 2);

    assert.equal(f.repo.list(f.owner, f.projectId).members.length, 2);

    assert.throws(
      () => f.repo.remove(f.owner, f.projectId, f.owner, 2),
      isError(403, "OWNER_PROTECTED"),
    );

    assert.equal(f.repo.list(f.owner, f.projectId).members.length, 2);
  });
});
