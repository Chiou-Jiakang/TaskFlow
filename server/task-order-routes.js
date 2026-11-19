"use strict";

const express = require("express");
const { ProjectError } = require("./project-repository");
const { createTaskOrderRepository } = require("./task-order-repository");

function invalid(message) {
  throw new ProjectError(400, "INVALID_INPUT", message);
}

function pathId(value, label) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    invalid(`${label} 必須是正整數。`);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id)) {
    invalid(`${label} 超出有效範圍。`);
  }

  return id;
}

function moveBody(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 3 ||
    !["version", "status", "index"].every((key) => Object.hasOwn(body, key))
  ) {
    invalid("請提供且僅提供 version、status、index 三個欄位。");
  }

  if (!Number.isSafeInteger(body.version) || body.version < 1) {
    invalid("version 必須是正整數。");
  }

  if (!["todo", "in_progress", "done"].includes(body.status)) {
    invalid("status 不合法。");
  }

  if (!Number.isSafeInteger(body.index) || body.index < 0) {
    invalid("index 必須是從 0 開始的整數。");
  }

  return body;
}

function createTaskOrderRouter({ db, getAuthenticatedUserId = () => null }) {
  const router = express.Router();
  const order = createTaskOrderRepository(db);

  const route = "/:projectId/tasks/:taskId/move";

  // 禁止快取私人任務資料。
  router.use(route, (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // 確認使用者已登入。
  router.patch(
    route,
    (req, res, next) => {
      const actorId = getAuthenticatedUserId(req);

      if (!Number.isSafeInteger(actorId) || actorId < 1) {
        return res.status(401).json({
          error: "UNAUTHENTICATED",
          message: "請先登入。",
        });
      }

      req.actorId = actorId;
      next();
    },

    // 只接受 JSON。
    (req, res, next) => {
      if (!req.is("application/json")) {
        return res.status(415).json({
          error: "JSON_REQUIRED",
          message: "請使用 application/json。",
        });
      }

      next();
    },

    // 執行任務排序。
    (req, res) => {
      const projectId = pathId(req.params.projectId, "projectId");

      const taskId = pathId(req.params.taskId, "taskId");

      const { version, status, index } = moveBody(req.body);

      const result = order.move(req.actorId, projectId, taskId, version, {
        status,
        index,
      });

      res.status(200).json(result);
    },
  );

  return router;
}

module.exports = {
  createTaskOrderRouter,
};
