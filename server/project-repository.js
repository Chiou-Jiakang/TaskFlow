"use strict";

class ProjectError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ProjectError";
    this.status = status;
    this.code = code;
  }
}

function createProjectRepository(db) {
  const findUser = db.prepare("SELECT id FROM users WHERE id = ?");

  const listProjects = db.prepare(`
    SELECT p.id, p.name, p.description,
           p.owner_id AS ownerId, p.status, p.version,
           p.created_at AS createdAt,
           p.updated_at AS updatedAt,
           pm.role AS myRole
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ?
    ORDER BY p.id DESC
  `);

  const findProject = db.prepare(`
    SELECT p.id, p.name, p.description,
           p.owner_id AS ownerId, p.status, p.version,
           p.created_at AS createdAt,
           p.updated_at AS updatedAt,
           pm.role AS myRole
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ? AND pm.user_id = ?
  `);

  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, owner_id)
    VALUES (?, ?, ?)
  `);

  const insertMember = db.prepare(`
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (?, ?, 'owner')
  `);

  const updateProject = db.prepare(`
    UPDATE projects
    SET name = ?,
        description = ?,
        status = ?,
        version = version + 1,
        updated_at = strftime(
          '%Y-%m-%dT%H:%M:%fZ', 'now'
        )
    WHERE id = ? AND version = ?
  `);

  const deleteProject = db.prepare(`
    DELETE FROM projects
    WHERE id = ? AND version = ?
  `);

  // 使用 SQLite Transaction 確保操作完整性
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

  // 僅允許專案成員讀取專案
  function requireProject(userId, projectId) {
    const project = findProject.get(projectId, userId);

    if (!project) {
      throw new ProjectError(
        404,
        "PROJECT_NOT_FOUND",
        "專案不存在或無存取權限。",
      );
    }

    return project;
  }

  return {
    // 取得使用者所屬專案
    list(userId) {
      return listProjects.all(userId);
    },

    // 取得指定專案
    get(userId, projectId) {
      return requireProject(userId, projectId);
    },

    // 建立專案及 Owner 關聯
    create(userId, data) {
      return transaction(() => {
        if (!findUser.get(userId)) {
          throw new ProjectError(401, "UNAUTHENTICATED", "使用者驗證失敗。");
        }

        const result = insertProject.run(data.name, data.description, userId);

        const projectId = Number(result.lastInsertRowid);

        insertMember.run(projectId, userId);

        return requireProject(userId, projectId);
      });
    },

    // Owner / Admin 可以修改專案
    update(userId, projectId, expectedVersion, patch) {
      return transaction(() => {
        const existing = requireProject(userId, projectId);

        if (!["owner", "admin"].includes(existing.myRole)) {
          throw new ProjectError(403, "FORBIDDEN", "沒有修改專案的權限。");
        }

        if (existing.version !== expectedVersion) {
          throw new ProjectError(
            409,
            "VERSION_CONFLICT",
            "專案已由其他操作更新，請重新取得資料。",
          );
        }

        const result = updateProject.run(
          patch.name ?? existing.name,
          patch.description ?? existing.description,
          patch.status ?? existing.status,
          projectId,
          expectedVersion,
        );

        if (Number(result.changes) !== 1) {
          throw new ProjectError(409, "VERSION_CONFLICT", "資料版本已變更。");
        }

        return requireProject(userId, projectId);
      });
    },

    // 僅 Owner 可以刪除專案
    delete(userId, projectId, expectedVersion) {
      return transaction(() => {
        const existing = requireProject(userId, projectId);

        if (existing.myRole !== "owner" || existing.ownerId !== userId) {
          throw new ProjectError(
            403,
            "FORBIDDEN",
            "只有專案擁有者可以刪除專案。",
          );
        }

        if (existing.version !== expectedVersion) {
          throw new ProjectError(
            409,
            "VERSION_CONFLICT",
            "專案版本已變更，請重新取得資料。",
          );
        }

        const result = deleteProject.run(projectId, expectedVersion);

        if (Number(result.changes) !== 1) {
          throw new ProjectError(409, "VERSION_CONFLICT", "資料版本已變更。");
        }
      });
    },
  };
}

module.exports = {
  ProjectError,
  createProjectRepository,
};
