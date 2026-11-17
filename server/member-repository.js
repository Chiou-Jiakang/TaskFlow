"use strict";

// M4-A：專案成員資料操作與 RBAC 基礎。
// 只處理已註冊使用者，不發送邀請信；HTTP API 在 M4-B 實作。
const { ProjectError } = require("./project-repository");

const ROLES = Object.freeze(["owner", "admin", "member"]);

function fail(status, code, message) {
  throw new ProjectError(status, code, message);
}

function positiveId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(400, "INVALID_INPUT", `${label} 必須是正整數。`);
  }
  return value;
}

function requireVersion(version) {
  return positiveId(version, "version");
}

function requireNewRole(role) {
  if (role !== "member" && role !== "admin") {
    fail(400, "INVALID_ROLE", "只能指定 admin 或 member，不能新增 owner。");
  }
  return role;
}

function normalizeEmail(email) {
  if (typeof email !== "string") {
    fail(400, "INVALID_INPUT", "Email 格式不正確。");
  }

  const normalized = email.trim().toLowerCase();

  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    fail(400, "INVALID_INPUT", "Email 格式不正確。");
  }

  return normalized;
}

function can(role, action) {
  const permissions = {
    owner: [
      "read",
      "add_member",
      "add_admin",
      "change_role",
      "remove_member",
      "remove_admin",
    ],
    admin: ["read", "add_member", "remove_member", "leave"],
    member: ["read", "leave"],
  };

  return Boolean(permissions[role]?.includes(action));
}

function createMemberRepository(db) {
  const findProject = db.prepare(`
    SELECT p.id, p.owner_id AS ownerId, p.version,
           pm.role AS actorRole
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ? AND pm.user_id = ?
  `);

  const findUser = db.prepare(`
    SELECT id, email, display_name AS displayName
    FROM users WHERE email = ?
  `);

  const getMember = db.prepare(`
    SELECT pm.user_id AS userId, pm.role,
           u.email, u.display_name AS displayName,
           pm.joined_at AS joinedAt
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ? AND pm.user_id = ?
  `);

  const listMembers = db.prepare(`
    SELECT pm.user_id AS userId, pm.role,
           u.email, u.display_name AS displayName,
           pm.joined_at AS joinedAt
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY CASE pm.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END, pm.user_id
  `);

  const insertMember = db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, ?)
  `);

  const updateRole = db.prepare(`
    UPDATE project_members SET role = ?
    WHERE project_id = ? AND user_id = ? AND role <> 'owner'
  `);

  const deleteMember = db.prepare(`
    DELETE FROM project_members
    WHERE project_id = ? AND user_id = ? AND role <> 'owner'
  `);

  const bumpVersion = db.prepare(`
    UPDATE projects
    SET version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND version = ?
  `);

  function transaction(action) {
    db.exec("BEGIN IMMEDIATE");

    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function access(actorId, projectId) {
    positiveId(actorId, "actorId");
    positiveId(projectId, "projectId");

    const project = findProject.get(projectId, actorId);

    if (!project) {
      fail(404, "PROJECT_NOT_FOUND", "專案不存在或無存取權限。");
    }

    return project;
  }

  function checkVersion(project, expectedVersion) {
    requireVersion(expectedVersion);

    if (project.version !== expectedVersion) {
      fail(409, "VERSION_CONFLICT", "專案版本已改變，請重新載入。");
    }
  }

  function bump(project) {
    if (Number(bumpVersion.run(project.id, project.version).changes) !== 1) {
      fail(409, "VERSION_CONFLICT", "資料版本已改變。");
    }

    return project.version + 1;
  }

  return {
    // 查詢成員。非成員回應 404。
    list(actorId, projectId) {
      const project = access(actorId, projectId);

      return {
        projectId: project.id,
        version: project.version,
        members: listMembers.all(projectId),
      };
    },

    // 新增已註冊成員。禁止自行產生 Owner。
    add(actorId, projectId, expectedVersion, { email, role = "member" } = {}) {
      return transaction(() => {
        const project = access(actorId, projectId);

        checkVersion(project, expectedVersion);
        requireNewRole(role);

        const action = role === "admin" ? "add_admin" : "add_member";

        if (!can(project.actorRole, action)) {
          fail(403, "FORBIDDEN", "沒有新增此角色的權限。");
        }

        const user = findUser.get(normalizeEmail(email));

        if (!user) {
          fail(404, "USER_NOT_FOUND", "使用者尚未註冊。");
        }

        if (getMember.get(projectId, user.id)) {
          fail(409, "ALREADY_MEMBER", "使用者已是專案成員。");
        }

        insertMember.run(projectId, user.id, role);

        const version = bump(project);

        return {
          member: getMember.get(projectId, user.id),
          version,
        };
      });
    },

    // 只有 Owner 可以修改成員角色。
    changeRole(actorId, projectId, userId, expectedVersion, role) {
      return transaction(() => {
        const project = access(actorId, projectId);

        checkVersion(project, expectedVersion);
        positiveId(userId, "userId");
        requireNewRole(role);

        if (!can(project.actorRole, "change_role")) {
          fail(403, "FORBIDDEN", "只有 Owner 可以調整角色。");
        }

        const target = getMember.get(projectId, userId);

        if (!target) {
          fail(404, "MEMBER_NOT_FOUND", "專案成員不存在。");
        }

        if (target.role === "owner" || userId === project.ownerId) {
          fail(403, "OWNER_PROTECTED", "不得變更 Owner 角色。");
        }

        if (target.role === role) {
          fail(409, "ROLE_UNCHANGED", "角色沒有變更。");
        }

        if (Number(updateRole.run(role, projectId, userId).changes) !== 1) {
          fail(409, "MEMBER_CONFLICT", "角色變更失敗。");
        }

        const version = bump(project);

        return {
          member: getMember.get(projectId, userId),
          version,
        };
      });
    },

    // 移除成員，或允許非 Owner 自行離開。
    remove(actorId, projectId, userId, expectedVersion) {
      return transaction(() => {
        const project = access(actorId, projectId);

        checkVersion(project, expectedVersion);
        positiveId(userId, "userId");

        const target = getMember.get(projectId, userId);

        if (!target) {
          fail(404, "MEMBER_NOT_FOUND", "專案成員不存在。");
        }

        if (target.role === "owner" || userId === project.ownerId) {
          fail(403, "OWNER_PROTECTED", "不能移除 Owner。");
        }

        if (userId === actorId) {
          if (!can(project.actorRole, "leave")) {
            fail(403, "FORBIDDEN", "不能離開此專案。");
          }
        } else {
          const action =
            target.role === "admin" ? "remove_admin" : "remove_member";

          if (!can(project.actorRole, action)) {
            fail(403, "FORBIDDEN", "沒有移除此成員的權限。");
          }
        }

        if (Number(deleteMember.run(projectId, userId).changes) !== 1) {
          fail(409, "MEMBER_CONFLICT", "移除失敗。");
        }

        return {
          removedUserId: userId,
          version: bump(project),
        };
      });
    },
  };
}

module.exports = {
  ROLES,
  can,
  createMemberRepository,
};
