"use strict";

const express = require("express");
const path = require("node:path");

const { openDatabase, initializeSchema } = require("./db");

const { ProjectError } = require("./project-repository");
const { createProjectRouter } = require("./project-routes");

const { createMemberRouter } = require("./member-routes");

const { createTaskRouter } = require("./task-routes");
const { initializeTaskSchema } = require("./task-repository");
const { initializeCollaborationSchema } = require("./collaboration-repository");
const { createCollaborationRouter } = require("./collaboration-routes");
const { createTaskOrderRouter } = require("./task-order-routes");
const { createRealtimeNotifier } = require("./realtime-notifier");

const { AuthError } = require("./auth-foundation");
const { createAuthContext, sameOriginOnly } = require("./auth-routes");
const { attachRealtime } = require("./realtime-hub");

// 建立 Express 應用程式
function createApp({ database = null, getAuthenticatedUserId = null } = {}) {
  const app = express();

  app.disable("x-powered-by");

  // 限制 JSON 請求大小
  app.use(express.json({ limit: "16kb" }));

  // ========================================
  // M1 健康檢查
  // ========================================
  app.get("/api/health", (_req, res) => {
    res.json({
      service: "TaskFlow",
      status: "ok",
      milestone: "M1",
    });
  });

  // ========================================
  // 正式資料庫 API
  // ========================================
  if (database) {
    // M5 增量初始化。
    // 既有 M2 測試可能只建立三張核心表，
    // 因此要在建立 Task Repository 前初始化。
    // CREATE IF NOT EXISTS 不會清空現有任務。
    initializeTaskSchema(database);
    initializeCollaborationSchema(database);

    // 只相容既有測試中的受信任身分注入。
    const injected = typeof getAuthenticatedUserId === "function";

    const auth = injected ? null : createAuthContext(database);

    if (auth) {
      // ========================================
      // M3 Authentication API
      // ========================================
      app.use("/api/auth", sameOriginOnly, auth.router);

      // ========================================
      // Project / Member / Task 共用防護
      // ========================================
      app.use("/api/projects", (req, res, next) => {
        if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
          return next();
        }

        // 未登入者由對應路由回傳 401
        if (!auth.actorId(req)) {
          return next();
        }

        // 同源檢查 + CSRF
        sameOriginOnly(req, res, () => auth.requireCsrf(req, res, next));
      });
    }

    // 取得已驗證的使用者身分
    const actorId = injected
      ? getAuthenticatedUserId
      : (req) => auth.actorId(req);

    // M7-B-BEGIN: 在所有 Project 寫入 API 前註冊成功回應的通知器。
    app.use("/api/projects", createRealtimeNotifier(
      () => app.locals.publishProjectChanged,
    ));

    // ========================================
    // M4 Member Management API
    // ========================================
    app.use(
      "/api/projects",
      createMemberRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );

    // ========================================
    // M5-B Task REST API
    // ========================================
    app.use(
      "/api/projects",
      createTaskRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );

    // ========================================
    // M6-B Task Reorder REST API
    // ========================================
    app.use(
      "/api/projects",
      createTaskOrderRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );

    // ========================================
    // M8-B Task Comments / Project Activity API
    // ========================================
    app.use(
      "/api/projects",
      createCollaborationRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );
    // ========================================
    // M2 Project CRUD API
    // ========================================
    app.use(
      "/api/projects",
      createProjectRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );
  }

  // ========================================
  // 前端 Dashboard 與 Authentication
  // ========================================
  app.use(express.static(path.join(__dirname, "..", "public")));

  // ========================================
  // 不存在的 API
  // ========================================
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API_NOT_FOUND",
      message: "找不到指定的 API。",
    });
  });

  // ========================================
  // 統一錯誤處理
  // ========================================
  app.use((err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof ProjectError || err instanceof AuthError) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
      });
    }

    if (err.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "INVALID_JSON",
        message: "JSON 格式錯誤。",
      });
    }

    if (err.type === "entity.too.large") {
      return res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: "請求內容過大。",
      });
    }

    console.error("TaskFlow request error:", err);

    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "伺服器處理失敗。",
    });
  });

  return app;
}

// 保留 M1 測試原本的匯入方式
const app = createApp();

// ========================================
// 正式啟動伺服器
// ========================================
if (require.main === module) {
  const db = openDatabase();

  initializeSchema(db);

  const port = Number(process.env.PORT || 3000);

  const runtimeApp = createApp({ database: db });
  const server = runtimeApp.listen(port, "127.0.0.1", () => {
    console.log("TaskFlow | M6-B Task Reorder API");

    console.log(`Server: http://localhost:${port}`);

    console.log(`Health: http://localhost:${port}/api/health`);

    console.log("Auth API: /api/auth/register, /login, /me, /logout");

    console.log("Member API: /api/projects/:id/members");

    console.log("Task API: /api/projects/:id/tasks");

    console.log("Task Move API: PATCH /api/projects/:id/tasks/:taskId/move");
  });

  const realtimeHub = attachRealtime(server, db);
  runtimeApp.locals.publishProjectChanged = realtimeHub.publishProjectChanged;

  server.on("error", (err) => {
    console.error("Server startup error:", err.message);

    db.close();

    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.createApp = createApp;
