"use strict";

const express = require("express");

const {
  ProjectError,
  createProjectRepository,
} = require("./project-repository");

function invalid(message) {
  throw new ProjectError(400, "INVALID_INPUT", message);
}

// 將路由 ID 轉換成安全正整數
function projectId(raw) {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    invalid("專案 ID 必須為正整數。");
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id)) {
    invalid("專案 ID 超出有效範圍。");
  }

  return id;
}

// 驗證樂觀鎖的版本編號
function versionNumber(raw) {
  if (!Number.isSafeInteger(raw) || raw < 1) {
    invalid("version 必須為正整數。");
  }

  return raw;
}

// 限制可接受的 JSON 欄位
function objectBody(body, allowedKeys) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("請提供 JSON 物件。");
  }

  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    invalid("請求含有不允許的欄位。");
  }
}

function validName(value) {
  if (typeof value !== "string") {
    invalid("name 必須為字串。");
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 100) {
    invalid("name 長度必須介於 1 至 100 字元。");
  }

  return name;
}

function validDescription(value) {
  if (typeof value !== "string" || value.length > 2000) {
    invalid("description 必須為不超過 2000 字元的字串。");
  }

  return value.trim();
}

// POST /api/projects
function parseCreate(body) {
  objectBody(body, ["name", "description"]);

  return {
    name: validName(body.name),
    description:
      body.description === undefined ? "" : validDescription(body.description),
  };
}

// PATCH /api/projects/:id
function parseUpdate(body) {
  objectBody(body, ["version", "name", "description", "status"]);

  const version = versionNumber(body.version);
  const patch = {};

  if (Object.hasOwn(body, "name")) {
    patch.name = validName(body.name);
  }

  if (Object.hasOwn(body, "description")) {
    patch.description = validDescription(body.description);
  }

  if (Object.hasOwn(body, "status")) {
    if (!["active", "archived"].includes(body.status)) {
      invalid("status 不合法。");
    }

    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) {
    invalid("沒有提供可更新欄位。");
  }

  return { version, patch };
}

function createProjectRouter({ db, getAuthenticatedUserId = () => null }) {
  const router = express.Router();
  const repository = createProjectRepository(db);

  // 由可信任的伺服器函式提供使用者身分
  // 不接受客戶端自行傳入 user_id 作為認證
  router.use((req, res, next) => {
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

  // 查詢專案列表
  router.get("/", (req, res) => {
    res.json({
      projects: repository.list(req.actorId),
    });
  });

  // 新增專案
  router.post("/", (req, res) => {
    const created = repository.create(req.actorId, parseCreate(req.body));
    res.locals.taskflowRealtimeChange = { projectId: created.id, resource: "project", action: "created", resourceId: created.id, version: created.version };

    res
      .location(`/api/projects/${created.id}`)
      .status(201)
      .json({ project: created });
  });

  // 查詢單一專案
  router.get("/:id", (req, res) => {
    const id = projectId(req.params.id);

    res.json({
      project: repository.get(req.actorId, id),
    });
  });

  // 更新專案
  router.patch("/:id", (req, res) => {
    const id = projectId(req.params.id);

    const { version, patch } = parseUpdate(req.body);

    const updated = repository.update(req.actorId, id, version, patch);
    res.locals.taskflowRealtimeChange = { projectId: id, resource: "project", action: "updated", resourceId: id, version: updated.version };

    res.json({ project: updated });
  });

  // 刪除專案
  router.delete("/:id", (req, res) => {
    const id = projectId(req.params.id);
    const version = projectId(req.query.version);

    repository.delete(req.actorId, id, version);
    res.locals.taskflowRealtimeChange = { projectId: id, resource: "project", action: "deleted", resourceId: id };

    res.status(204).end();
  });

  return router;
}

module.exports = {
  createProjectRouter,
};
