"use strict";

// M4-B：成員管理 HTTP API。
// 身分由 Session Middleware 提供；絕不採信請求中的 actorId。
const express = require("express");
const { ProjectError } = require("./project-repository");
const { createMemberRepository } = require("./member-repository");

function invalid(message) {
  throw new ProjectError(400, "INVALID_INPUT", message);
}

function positiveId(raw, field) {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    invalid(`${field} 必須是正整數。`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    invalid(`${field} 超出有效範圍。`);
  }
  return value;
}

function versionFromBody(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    invalid("version 必須是正整數。");
  }
  return value;
}

function checkBody(body, allowed, required) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("請提供 JSON 物件。");
  }

  const keys = Object.keys(body);
  if (
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(body, key))
  ) {
    invalid("JSON 欄位不合法或缺少必填欄位。");
  }
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

function createMemberRouter({ db, getAuthenticatedUserId = () => null }) {
  const router = express.Router();
  const members = createMemberRepository(db);

  // 只對成員 API 加入私人資料防快取標頭。
  router.use("/:projectId/members", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // 從伺服器的 Session 或受信任的測試注入取得使用者身分。
  router.use("/:projectId/members", (req, res, next) => {
    const actor = getAuthenticatedUserId(req);
    if (!Number.isSafeInteger(actor) || actor < 1) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "請先登入。",
      });
    }
    req.actorId = actor;
    next();
  });

  // GET /api/projects/:projectId/members
  router.get("/:projectId/members", (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");
    res.json(members.list(req.actorId, projectId));
  });

  // POST /api/projects/:projectId/members
  // body: { version, email, role? }
  router.post("/:projectId/members", jsonRequired, (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");
    checkBody(req.body, ["version", "email", "role"], ["version", "email"]);

    const version = versionFromBody(req.body.version);
    const created = members.add(req.actorId, projectId, version, {
      email: req.body.email,
      role: req.body.role === undefined ? "member" : req.body.role,
    });

    res.status(201).json(created);
  });

  // PATCH /api/projects/:projectId/members/:userId
  // body: { version, role }
  router.patch("/:projectId/members/:userId", jsonRequired, (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");
    const userId = positiveId(req.params.userId, "userId");
    checkBody(req.body, ["version", "role"], ["version", "role"]);

    const updated = members.changeRole(
      req.actorId,
      projectId,
      userId,
      versionFromBody(req.body.version),
      req.body.role,
    );

    res.json(updated);
  });

  // DELETE /api/projects/:projectId/members/:userId?version=N
  // 權限可移除其他成員；非 Owner 可刪除自己的成員紀錄。
  router.delete("/:projectId/members/:userId", (req, res) => {
    const projectId = positiveId(req.params.projectId, "projectId");
    const userId = positiveId(req.params.userId, "userId");
    const version = positiveId(req.query.version, "version");

    members.remove(req.actorId, projectId, userId, version);
    res.status(204).end();
  });

  return router;
}

module.exports = { createMemberRouter };
