"use strict";

// M8-B: Collaboration HTTP API.
// Authentication, Origin and CSRF checks are inherited from server/server.js.
const express = require("express");
const { ProjectError } = require("./project-repository");
const { createCollaborationRepository } = require("./collaboration-repository");

function invalid(message) {
  throw new ProjectError(400, "INVALID_INPUT", message);
}

function positivePathId(raw, label) {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    invalid(`${label} 必須是正整數。`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) invalid(`${label} 超出有效範圍。`);
  return value;
}

function positiveBodyVersion(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    invalid("version 必須是正整數。");
  }
  return value;
}

function exactBody(body, fields) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => !fields.includes(key)) ||
      fields.some((key) => !Object.hasOwn(body, key))) {
    invalid(`JSON 只能提供必要欄位：${fields.join(", ")}。`);
  }
  return body;
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

function parsePagination(query) {
  if (!query || typeof query !== "object" || Array.isArray(query) ||
      Object.keys(query).some((key) => !["limit", "beforeId"].includes(key))) {
    invalid("分頁參數不合法。");
  }
  const options = {};
  if (Object.hasOwn(query, "limit")) {
    const raw = query.limit;
    if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
      invalid("limit 必須介於 1 至 100。");
    }
    const limit = Number(raw);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      invalid("limit 必須介於 1 至 100。");
    }
    options.limit = limit;
  }
  if (Object.hasOwn(query, "beforeId")) {
    options.beforeId = positivePathId(query.beforeId, "beforeId");
  }
  return options;
}

function createCollaborationRouter({ db, getAuthenticatedUserId = () => null }) {
  const router = express.Router();
  const repository = createCollaborationRepository(db);

  // Only intercept M8-B paths. Other M2-M7 project routes remain unchanged.
  function requireProjectMemberSession(req, res, next) {
    res.set("Cache-Control", "no-store");
    // Never accept actorId/userId from request body or query.
    const actorId = getAuthenticatedUserId(req);
    if (!Number.isSafeInteger(actorId) || actorId < 1) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "請先登入。",
      });
    }
    req.actorId = actorId;
    next();
  }
  router.use("/:projectId/tasks/:taskId/comments", requireProjectMemberSession);
  router.use("/:projectId/activity", requireProjectMemberSession);

  // GET /api/projects/:projectId/tasks/:taskId/comments?limit=50&beforeId=...
  router.get("/:projectId/tasks/:taskId/comments", (req, res) => {
    const projectId = positivePathId(req.params.projectId, "projectId");
    const taskId = positivePathId(req.params.taskId, "taskId");
    const options = parsePagination(req.query);
    res.json({ comments: repository.listComments(req.actorId, projectId, taskId, options) });
  });

  // GET /api/projects/:projectId/tasks/:taskId/comments/:commentId
  router.get("/:projectId/tasks/:taskId/comments/:commentId", (req, res) => {
    const projectId = positivePathId(req.params.projectId, "projectId");
    const taskId = positivePathId(req.params.taskId, "taskId");
    const commentId = positivePathId(req.params.commentId, "commentId");
    res.json({ comment: repository.getComment(req.actorId, projectId, taskId, commentId) });
  });

  // POST /api/projects/:projectId/tasks/:taskId/comments  { body }
  router.post("/:projectId/tasks/:taskId/comments", jsonRequired, (req, res) => {
    const projectId = positivePathId(req.params.projectId, "projectId");
    const taskId = positivePathId(req.params.taskId, "taskId");
    const { body } = exactBody(req.body, ["body"]);
    const comment = repository.createComment(req.actorId, projectId, taskId, body);
    // M8-C3-BEGIN: 資料庫已 COMMIT 後，交由 M7-B 的 response-finish notifier 發佈 ID 事件。
    res.locals.taskflowRealtimeChange = { projectId, resource: "comment", action: "created", resourceId: comment.id, version: comment.version };
    res.location(`/api/projects/${projectId}/tasks/${taskId}/comments/${comment.id}`)
      .status(201).json({ comment });
  });

  // PATCH /api/projects/:projectId/tasks/:taskId/comments/:commentId
  // { version, body }
  router.patch("/:projectId/tasks/:taskId/comments/:commentId", jsonRequired, (req, res) => {
    const projectId = positivePathId(req.params.projectId, "projectId");
    const taskId = positivePathId(req.params.taskId, "taskId");
    const commentId = positivePathId(req.params.commentId, "commentId");
    const { version, body } = exactBody(req.body, ["version", "body"]);
    const comment = repository.updateComment(
      req.actorId, projectId, taskId, commentId, positiveBodyVersion(version), body,
    );
    // M8-C3-BEGIN: 更新成功才標記通知，不帶留言正文。
    res.locals.taskflowRealtimeChange = { projectId, resource: "comment", action: "updated", resourceId: comment.id, version: comment.version };
    res.json({ comment });
  });

  // DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId?version=N
  router.delete("/:projectId/tasks/:taskId/comments/:commentId", (req, res) => {
    const projectId = positivePathId(req.params.projectId, "projectId");
    const taskId = positivePathId(req.params.taskId, "taskId");
    const commentId = positivePathId(req.params.commentId, "commentId");
    if (Object.keys(req.query).length !== 1 || !Object.hasOwn(req.query, "version")) {
      invalid("刪除留言必須指定 version。");
    }
    const version = positivePathId(req.query.version, "version");
    repository.deleteComment(req.actorId, projectId, taskId, commentId, version);
    // M8-C3-BEGIN: 204 成功才標記刪除通知。
    res.locals.taskflowRealtimeChange = { projectId, resource: "comment", action: "deleted", resourceId: commentId };
    res.status(204).end();
  });

  // GET /api/projects/:projectId/activity?limit=50&beforeId=...
  router.get("/:projectId/activity", (req, res) => {
    const projectId = positivePathId(req.params.projectId, "projectId");
    const options = parsePagination(req.query);
    res.json({ activities: repository.listActivity(req.actorId, projectId, options) });
  });

  return router;
}

module.exports = {
  createCollaborationRouter,
  positivePathId,
  parsePagination,
};
