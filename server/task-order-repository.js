"use strict";

// M6-A：後端原子排序；尚未接入 HTTP API。
// 沿用 M5 的 tasks.position，不修改資料表。
const { ProjectError } = require("./project-repository");

const STATUSES = Object.freeze(["todo", "in_progress", "done"]);

function fail(status, code, message) {
  throw new ProjectError(status, code, message);
}

function positiveId(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(400, "INVALID_INPUT", `${label} 必須為正整數。`);
  }
  return value;
}

function validateDestination(destination) {
  if (
    !destination ||
    typeof destination !== "object" ||
    Array.isArray(destination) ||
    Object.keys(destination).length !== 2 ||
    !Object.hasOwn(destination, "status") ||
    !Object.hasOwn(destination, "index")
  ) {
    fail(400, "INVALID_INPUT", "必須提供 status 和 index 兩個欄位。");
  }
  if (!STATUSES.includes(destination.status)) {
    fail(400, "INVALID_INPUT", "status 不合法。");
  }
  if (!Number.isSafeInteger(destination.index) || destination.index < 0) {
    fail(400, "INVALID_INPUT", "index 必須是從 0 開始的整數。");
  }
  return destination;
}

function createTaskOrderRepository(db) {
  const findProject = db.prepare(`
    SELECT p.status, pm.role
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ? AND pm.user_id = ?
  `);

  const findTask = db.prepare(`
    SELECT id, project_id AS projectId, status, position, version
    FROM tasks WHERE project_id = ? AND id = ?
  `);

  const listTasks = db.prepare(`
    SELECT id, project_id AS projectId, status, position, version
    FROM tasks WHERE project_id = ?
    ORDER BY CASE status
      WHEN 'todo' THEN 0
      WHEN 'in_progress' THEN 1
      ELSE 2 END, position, id
  `);

  const updateTask = db.prepare(`
    UPDATE tasks
    SET status = ?, position = ?, version = version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE project_id = ? AND id = ? AND version = ?
  `);

  // index 是先移除來源任務後，在目標欄位中的 0-based 位置。
  function move(actorId, projectId, taskId, expectedVersion, destination) {
    positiveId(actorId, "actorId");
    positiveId(projectId, "projectId");
    positiveId(taskId, "taskId");
    positiveId(expectedVersion, "version");

    const { status: targetStatus, index: targetIndex } =
      validateDestination(destination);

    db.exec("BEGIN IMMEDIATE");

    try {
      const project = findProject.get(projectId, actorId);

      if (!project) {
        fail(404, "PROJECT_NOT_FOUND", "專案不存在或無存取權限。");
      }

      if (project.status === "archived") {
        fail(403, "PROJECT_ARCHIVED", "已封存專案不能排序任務。");
      }

      if (project.role !== "owner" && project.role !== "admin") {
        fail(403, "FORBIDDEN", "只有 Owner 或 Admin 可以重新排序任務。");
      }

      const moving = findTask.get(projectId, taskId);

      if (!moving) {
        fail(404, "TASK_NOT_FOUND", "任務不存在。");
      }

      if (moving.version !== expectedVersion) {
        fail(409, "VERSION_CONFLICT", "任務版本已變更，請重新載入看板。");
      }

      const all = listTasks.all(projectId);
      const sourceStatus = moving.status;

      const source = all.filter(
        (row) => row.status === sourceStatus && row.id !== taskId,
      );

      const target =
        targetStatus === sourceStatus
          ? source
          : all.filter((row) => row.status === targetStatus);

      if (targetIndex > target.length) {
        fail(400, "INVALID_INPUT", "index 超出目標欄位範圍。");
      }

      target.splice(targetIndex, 0, { ...moving, status: targetStatus });

      // 只重新編號受影響的來源欄及目標欄。
      const affected =
        targetStatus === sourceStatus
          ? [[targetStatus, target]]
          : [
              [sourceStatus, source],
              [targetStatus, target],
            ];

      const originalSource = all
        .filter((row) => row.status === sourceStatus)
        .map((row) => row.id);

      const finalSource =
        targetStatus === sourceStatus
          ? target.map((row) => row.id)
          : source.map((row) => row.id);

      const movedOrder =
        sourceStatus !== targetStatus ||
        originalSource.some((id, i) => id !== finalSource[i]);

      const changedTaskIds = [];

      for (const [columnStatus, rows] of affected) {
        for (let position = 0; position < rows.length; position += 1) {
          const row = rows[position];

          const changed =
            row.status !== columnStatus ||
            row.position !== position ||
            (row.id === taskId && movedOrder);

          if (!changed) continue;

          const result = updateTask.run(
            columnStatus,
            position,
            projectId,
            row.id,
            row.version,
          );

          if (Number(result.changes) !== 1) {
            fail(409, "VERSION_CONFLICT", "排序期間任務已變更。");
          }

          changedTaskIds.push(row.id);
        }
      }

      const result = {
        task: findTask.get(projectId, taskId),
        tasks: listTasks.all(projectId),
        changedTaskIds,
      };

      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return { move };
}

module.exports = {
  createTaskOrderRepository,
};
