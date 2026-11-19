"use strict";

const express = require("express");
const { ProjectError } = require("./project-repository");
const { createTaskRepository } = require("./task-repository");

function invalid(message) {
  throw new ProjectError(400, "INVALID_INPUT", message);
}

function positiveId(raw, label) {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    invalid(`${label} 必須是正整數。`);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value)) {
    invalid(`${label} 超出有效範圍。`);
  }

  return value;
}

function versionNumber(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    invalid("version 必須是正整數。");
  }

  return value;
}

function taskBody(body, editing = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("請提供 JSON 物件。");
  }

  const allowed = [
    "title",
    "description",
    "status",
    "priority",
    "assigneeId",
    "dueDate",
    "position",
  ];

  const keys = Object.keys(body);

  if (
    keys.some(
      (key) => !allowed.includes(key) && !(editing && key === "version"),
    )
  ) {
    invalid("JSON 含有不允許的欄位。");
  }

  if (!editing) {
    return body;
  }

  const { version, ...patch } = body;

  if (Object.keys(patch).length === 0) {
    invalid("沒有提供可更新的任務欄位。");
  }

  return {
    version: versionNumber(version),
    patch,
  };
}

function jsonRequired(req, res, next) {
  if (!req.is("application/json")) {
    return res.status(415).json({
      error: "JSON_REQUIRED",
      message: "請使用 application/json。",
    });
  }

  next();
}

function createTaskRouter({ db, getAuthenticatedUserId = () => null }) {
  const router = express.Router();
  const tasks = createTaskRepository(db);

  // 任務屬於私人資料，禁止中介快取。
  router.use("/:projectId/tasks", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // 使用伺服器驗證的身分，不信任客戶端提供的 user ID。
  router.use("/:projectId/tasks", (req, res, next) => {
    const userId = getAuthenticatedUserId(req);

    if (!Number.isSafeInteger(userId) || userId < 1) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "請先登入。",
      });
    }

    req.actorId = userId;
    next();
  });

  // ========================================
  // GET /api/projects/:projectId/tasks
  // ========================================
  router.get("/:projectId/tasks", (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");

    res.json({
      tasks: tasks.list(req.actorId, projectId),
    });
  });

  // ========================================
  // GET /api/projects/:projectId/tasks/:taskId
  // ========================================
  router.get("/:projectId/tasks/:taskId", (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");

    const taskId = positiveId(req.params.taskId, "taskId");

    res.json({
      task: tasks.get(req.actorId, projectId, taskId),
    });
  });

  // ========================================
  // POST /api/projects/:projectId/tasks
  // ========================================
  router.post("/:projectId/tasks", jsonRequired, (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");

    const task = tasks.create(req.actorId, projectId, taskBody(req.body));
    // M7-B: Repository 成功 COMMIT 後註記，僅於 HTTP 2xx finish 推播。
    res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "created", resourceId: task.id, version: task.version };

    res
      .location(`/api/projects/${projectId}/tasks/${task.id}`)
      .status(201)
      .json({ task });
  });

  // ========================================
  // PATCH /api/projects/:projectId/tasks/:taskId
  // ========================================
  router.patch("/:projectId/tasks/:taskId", jsonRequired, (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");

    const taskId = positiveId(req.params.taskId, "taskId");

    const { version, patch } = taskBody(req.body, true);

    const updated = tasks.update(
      req.actorId,
      projectId,
      taskId,
      version,
      patch,
    );

    res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "updated", resourceId: updated.id, version: updated.version };
    res.json({
      task: updated,
    });
  });

  // ========================================
  // DELETE /api/projects/:projectId/tasks/:taskId
  // ========================================
  router.delete("/:projectId/tasks/:taskId", (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");

    const taskId = positiveId(req.params.taskId, "taskId");

    const version = positiveId(req.query.version, "version");

    tasks.delete(req.actorId, projectId, taskId, version);
    res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "deleted", resourceId: taskId };

    res.status(204).end();
  });

  return router;
}

module.exports = {
  createTaskRouter,
};
