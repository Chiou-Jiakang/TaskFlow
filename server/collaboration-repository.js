"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ProjectError } = require("./project-repository");

const SCHEMA_PATH = path.join(__dirname, "collaboration-schema.sql");
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function fail(status, code, message) {
  throw new ProjectError(status, code, message);
}

function positiveId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(400, "INVALID_INPUT", `${label} 必須為正整數。`);
  }
  return value;
}

function pagination(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    fail(400, "INVALID_INPUT", "分頁參數不合法。");
  }
  if (Object.keys(options).some((key) => !["limit", "beforeId"].includes(key))) {
    fail(400, "INVALID_INPUT", "分頁包含不允許的欄位。");
  }
  const limit = options.limit === undefined ? DEFAULT_PAGE_SIZE : options.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    fail(400, "INVALID_INPUT", `limit 必須介於 1～${MAX_PAGE_SIZE}。`);
  }
  const beforeId = options.beforeId === undefined ? null : positiveId(options.beforeId, "beforeId");
  return { limit, beforeId };
}

function commentText(value) {
  if (typeof value !== "string") {
    fail(400, "INVALID_INPUT", "留言必須是字串。");
  }
  const body = value.trim();
  if (body.length < 1 || body.length > 2000) {
    fail(400, "INVALID_INPUT", "留言長度必須介於 1～2000 字元。");
  }
  return body;
}

function initializeCollaborationSchema(db) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function createCollaborationRepository(db) {
  const membership = db.prepare(`
    SELECT p.status, pm.role
    FROM projects AS p
    JOIN project_members AS pm ON pm.project_id = p.id
    WHERE p.id = ? AND pm.user_id = ?
  `);
  const taskExists = db.prepare(`
    SELECT id FROM tasks WHERE id = ? AND project_id = ?
  `);
  const selectComment = db.prepare(`
    SELECT c.id, c.project_id AS projectId, c.task_id AS taskId,
           c.author_id AS authorId, u.display_name AS authorName,
           c.body, c.version, c.created_at AS createdAt,
           c.updated_at AS updatedAt
    FROM task_comments AS c
    JOIN users AS u ON u.id = c.author_id
    WHERE c.id = ? AND c.project_id = ? AND c.task_id = ? AND c.is_deleted = 0
  `);
  const listComments = db.prepare(`
    SELECT c.id, c.project_id AS projectId, c.task_id AS taskId,
           c.author_id AS authorId, u.display_name AS authorName,
           c.body, c.version, c.created_at AS createdAt,
           c.updated_at AS updatedAt
    FROM task_comments AS c
    JOIN users AS u ON u.id = c.author_id
    WHERE c.project_id = ? AND c.task_id = ? AND c.is_deleted = 0
      AND (? IS NULL OR c.id < ?)
    ORDER BY c.id DESC LIMIT ?
  `);
  const listActivities = db.prepare(`
    SELECT a.id, a.project_id AS projectId, a.actor_id AS actorId,
           u.display_name AS actorName, a.task_id AS taskId,
           a.comment_id AS commentId, a.action, a.created_at AS createdAt
    FROM project_activity AS a
    LEFT JOIN users AS u ON u.id = a.actor_id
    WHERE a.project_id = ? AND (? IS NULL OR a.id < ?)
    ORDER BY a.id DESC LIMIT ?
  `);
  const insertComment = db.prepare(`
    INSERT INTO task_comments(project_id, task_id, author_id, body)
    VALUES (?, ?, ?, ?)
  `);
  const updateComment = db.prepare(`
    UPDATE task_comments
    SET body = ?, version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND project_id = ? AND task_id = ?
      AND version = ? AND is_deleted = 0
  `);
  const deleteComment = db.prepare(`
    UPDATE task_comments
    SET body = '', is_deleted = 1, version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = ? AND project_id = ? AND task_id = ?
      AND version = ? AND is_deleted = 0
  `);
  const insertActivity = db.prepare(`
    INSERT INTO project_activity(project_id, actor_id, task_id, comment_id, action)
    VALUES (?, ?, ?, ?, ?)
  `);

  function access(actorId, projectId, write = false) {
    positiveId(actorId, "actorId");
    positiveId(projectId, "projectId");
    const project = membership.get(projectId, actorId);
    if (!project) fail(404, "PROJECT_NOT_FOUND", "專案不存在或無存取權限。");
    if (write && project.status === "archived") {
      fail(403, "PROJECT_ARCHIVED", "已封存專案不能修改留言。");
    }
    return project;
  }

  function task(projectId, taskId) {
    positiveId(taskId, "taskId");
    if (!taskExists.get(taskId, projectId)) {
      fail(404, "TASK_NOT_FOUND", "任務不存在。");
    }
  }

  function findComment(projectId, taskId, commentId) {
    positiveId(commentId, "commentId");
    const found = selectComment.get(commentId, projectId, taskId);
    if (!found) fail(404, "COMMENT_NOT_FOUND", "留言不存在。");
    return found;
  }

  function expectedVersion(value) {
    return positiveId(value, "version");
  }

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

  return {
    listComments(actorId, projectId, taskId, options) {
      access(actorId, projectId);
      task(projectId, taskId);
      const { limit, beforeId } = pagination(options);
      return listComments.all(projectId, taskId, beforeId, beforeId, limit);
    },
    getComment(actorId, projectId, taskId, commentId) {
      access(actorId, projectId);
      task(projectId, taskId);
      return findComment(projectId, taskId, commentId);
    },
    createComment(actorId, projectId, taskId, body) {
      return transaction(() => {
        access(actorId, projectId, true);
        task(projectId, taskId);
        const content = commentText(body);
        const inserted = insertComment.run(projectId, taskId, actorId, content);
        const commentId = Number(inserted.lastInsertRowid);
        insertActivity.run(projectId, actorId, taskId, commentId, "comment_created");
        return findComment(projectId, taskId, commentId);
      });
    },
    updateComment(actorId, projectId, taskId, commentId, version, body) {
      return transaction(() => {
        access(actorId, projectId, true);
        task(projectId, taskId);
        const previous = findComment(projectId, taskId, commentId);
        if (previous.authorId !== actorId) {
          fail(403, "FORBIDDEN", "只能編輯自己發表的留言。");
        }
        expectedVersion(version);
        if (previous.version !== version) {
          fail(409, "VERSION_CONFLICT", "留言版本已改變，請重新取得資料。");
        }
        const content = commentText(body);
        if (Number(updateComment.run(content, commentId, projectId, taskId, version).changes) !== 1) {
          fail(409, "VERSION_CONFLICT", "留言版本已改變。");
        }
        insertActivity.run(projectId, actorId, taskId, commentId, "comment_updated");
        return findComment(projectId, taskId, commentId);
      });
    },
    deleteComment(actorId, projectId, taskId, commentId, version) {
      return transaction(() => {
        const project = access(actorId, projectId, true);
        task(projectId, taskId);
        const previous = findComment(projectId, taskId, commentId);
        if (previous.authorId !== actorId && !["owner", "admin"].includes(project.role)) {
          fail(403, "FORBIDDEN", "只有作者或管理者可以刪除留言。");
        }
        expectedVersion(version);
        if (previous.version !== version) {
          fail(409, "VERSION_CONFLICT", "留言版本已改變，請重新取得資料。");
        }
        if (Number(deleteComment.run(commentId, projectId, taskId, version).changes) !== 1) {
          fail(409, "VERSION_CONFLICT", "留言版本已改變。");
        }
        insertActivity.run(projectId, actorId, taskId, commentId, "comment_deleted");
        return { deletedCommentId: commentId };
      });
    },
    listActivity(actorId, projectId, options) {
      access(actorId, projectId);
      const { limit, beforeId } = pagination(options);
      return listActivities.all(projectId, beforeId, beforeId, limit);
    },
  };
}

module.exports = {
  initializeCollaborationSchema,
  createCollaborationRepository,
};
