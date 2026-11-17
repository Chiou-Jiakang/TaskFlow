"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ProjectError } = require("./project-repository");

const TASK_SCHEMA = path.join(__dirname, "task-schema.sql");
const STATUSES = Object.freeze(["todo", "in_progress", "done"]);
const PRIORITIES = Object.freeze(["low", "medium", "high"]);
const FIELDS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "assigneeId",
  "dueDate",
  "position",
]);

function fail(status, code, message) {
  throw new ProjectError(status, code, message);
}

function positiveId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(400, "INVALID_INPUT", `${label} 必須為正整數。`);
  }
  return value;
}

function initializeTaskSchema(db) {
  // Make all CREATE TABLE, INDEX, and TRIGGER steps atomic.
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(fs.readFileSync(TASK_SCHEMA, "utf8"));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function validatePatch(data, { creating = false } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail(400, "INVALID_INPUT", "請提供任務資料物件。");
  }
  const keys = Object.keys(data);
  if (keys.length === 0 && !creating) {
    fail(400, "INVALID_INPUT", "至少指定一個欄位。");
  }
  if (keys.some((key) => !FIELDS.has(key))) {
    fail(400, "INVALID_INPUT", "任務包含不允許的欄位。");
  }
  const result = {};
  if (creating || Object.hasOwn(data, "title")) {
    if (typeof data.title !== "string") {
      fail(400, "INVALID_INPUT", "title 必須為字串。");
    }
    const title = data.title.trim();
    if (title.length < 1 || title.length > 120) {
      fail(400, "INVALID_INPUT", "title 長度必須介於 1 至 120。");
    }
    result.title = title;
  }
  if (creating || Object.hasOwn(data, "description")) {
    const description =
      creating && data.description === undefined ? "" : data.description;
    if (typeof description !== "string" || description.length > 2000) {
      fail(400, "INVALID_INPUT", "description 必須是 2000 字元內的字串。");
    }
    result.description = description.trim();
  }
  if (creating || Object.hasOwn(data, "status")) {
    const status = creating && data.status === undefined ? "todo" : data.status;
    if (!STATUSES.includes(status)) {
      fail(400, "INVALID_INPUT", "status 只能是 todo、in_progress、done。");
    }
    result.status = status;
  }
  if (creating || Object.hasOwn(data, "priority")) {
    const priority =
      creating && data.priority === undefined ? "medium" : data.priority;
    if (!PRIORITIES.includes(priority)) {
      fail(400, "INVALID_INPUT", "priority 只能是 low、medium、high。");
    }
    result.priority = priority;
  }
  if (creating || Object.hasOwn(data, "assigneeId")) {
    const value =
      creating && data.assigneeId === undefined ? null : data.assigneeId;
    result.assigneeId = value === null ? null : positiveId(value, "assigneeId");
  }
  if (creating || Object.hasOwn(data, "dueDate")) {
    const value = creating && data.dueDate === undefined ? null : data.dueDate;
    if (value !== null) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        fail(400, "INVALID_INPUT", "dueDate 必須是 YYYY-MM-DD 或 null。");
      }
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
      ) {
        fail(400, "INVALID_INPUT", "dueDate 不是有效日期。");
      }
    }
    result.dueDate = value;
  }
  if (creating || Object.hasOwn(data, "position")) {
    const value = creating && data.position === undefined ? 0 : data.position;
    if (!Number.isSafeInteger(value) || value < 0) {
      fail(400, "INVALID_INPUT", "position 必須為非負整數。");
    }
    result.position = value;
  }
  return result;
}

function createTaskRepository(db) {
  const projectStmt = db.prepare(`
    SELECT p.id, p.status, pm.role
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ? AND pm.user_id = ?
  `);
  const assigneeStmt = db.prepare(`
    SELECT 1 AS found FROM project_members
    WHERE project_id = ? AND user_id = ?
  `);
  const taskFields = `
    id, project_id AS projectId, title, description, status, priority,
    assignee_id AS assigneeId, due_date AS dueDate, position, version,
    created_at AS createdAt, updated_at AS updatedAt
  `;
  const findStmt = db.prepare(
    `SELECT ${taskFields} FROM tasks WHERE project_id = ? AND id = ?`,
  );
  const listStmt = db.prepare(`
    SELECT ${taskFields} FROM tasks WHERE project_id = ?
    ORDER BY CASE status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
             position, id
  `);
  const insertStmt = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, priority, assignee_id,
                       due_date, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?,
        due_date = ?, position = ?, version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE project_id = ? AND id = ? AND version = ?
  `);
  const deleteStmt = db.prepare(`
    DELETE FROM tasks WHERE project_id = ? AND id = ? AND version = ?
  `);

  function project(actorId, projectId) {
    positiveId(actorId, "actorId");
    positiveId(projectId, "projectId");
    const found = projectStmt.get(projectId, actorId);
    if (!found) fail(404, "PROJECT_NOT_FOUND", "專案不存在或無存取權限。");
    return found;
  }
  function task(projectId, taskId) {
    positiveId(taskId, "taskId");
    const found = findStmt.get(projectId, taskId);
    if (!found) fail(404, "TASK_NOT_FOUND", "任務不存在。");
    return found;
  }
  function writable(p) {
    if (p.status === "archived") {
      fail(403, "PROJECT_ARCHIVED", "已封存專案不能修改任務。");
    }
  }
  function manage(p) {
    if (p.role !== "owner" && p.role !== "admin") {
      fail(403, "FORBIDDEN", "只有 Owner 或 Admin 可管理任務。");
    }
  }
  function assign(projectId, assigneeId) {
    if (assigneeId !== null && !assigneeStmt.get(projectId, assigneeId)) {
      fail(400, "ASSIGNEE_NOT_MEMBER", "任務負責人必須是同一專案的成員。");
    }
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
    list(actorId, projectId) {
      project(actorId, projectId);
      return listStmt.all(projectId);
    },
    get(actorId, projectId, taskId) {
      project(actorId, projectId);
      return task(projectId, taskId);
    },
    create(actorId, projectId, data) {
      return transaction(() => {
        const p = project(actorId, projectId);
        writable(p);
        manage(p);
        const input = validatePatch(data, { creating: true });
        assign(projectId, input.assigneeId);
        const inserted = insertStmt.run(
          projectId,
          input.title,
          input.description,
          input.status,
          input.priority,
          input.assigneeId,
          input.dueDate,
          input.position,
        );
        return task(projectId, Number(inserted.lastInsertRowid));
      });
    },
    update(actorId, projectId, taskId, expectedVersion, patch) {
      return transaction(() => {
        const p = project(actorId, projectId);
        writable(p);
        const previous = task(projectId, taskId);
        positiveId(expectedVersion, "version");
        // Non-admin members may change only the status of tasks assigned to them.
        if (p.role === "member") {
          if (
            previous.assigneeId !== actorId ||
            !patch ||
            typeof patch !== "object" ||
            Array.isArray(patch) ||
            Object.keys(patch).length !== 1 ||
            !Object.hasOwn(patch, "status")
          ) {
            fail(403, "FORBIDDEN", "Member 只能更新自己任務的狀態。");
          }
        } else {
          manage(p);
        }
        if (previous.version !== expectedVersion) {
          fail(409, "VERSION_CONFLICT", "任務版本已改變，請重新取得資料。");
        }
        const input = validatePatch(patch);
        const updated = { ...previous, ...input };
        assign(projectId, updated.assigneeId);
        const result = updateStmt.run(
          updated.title,
          updated.description,
          updated.status,
          updated.priority,
          updated.assigneeId,
          updated.dueDate,
          updated.position,
          projectId,
          taskId,
          expectedVersion,
        );
        if (Number(result.changes) !== 1) {
          fail(409, "VERSION_CONFLICT", "任務版本已改變。");
        }
        return task(projectId, taskId);
      });
    },
    delete(actorId, projectId, taskId, expectedVersion) {
      return transaction(() => {
        const p = project(actorId, projectId);
        writable(p);
        manage(p);
        const previous = task(projectId, taskId);
        positiveId(expectedVersion, "version");
        if (previous.version !== expectedVersion) {
          fail(409, "VERSION_CONFLICT", "任務版本已改變，請重新取得資料。");
        }
        if (
          Number(deleteStmt.run(projectId, taskId, expectedVersion).changes) !==
          1
        ) {
          fail(409, "VERSION_CONFLICT", "任務版本已改變。");
        }
        return { deletedTaskId: taskId };
      });
    },
  };
}

module.exports = {
  STATUSES,
  PRIORITIES,
  initializeTaskSchema,
  createTaskRepository,
};
