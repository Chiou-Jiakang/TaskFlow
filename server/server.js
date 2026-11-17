"use strict";

const express = require("express");
const path = require("node:path");

const { openDatabase, initializeSchema } = require("./db");
const { ProjectError } = require("./project-repository");
const { createProjectRouter } = require("./project-routes");
const { createMemberRouter } = require("./member-routes");
const { AuthError } = require("./auth-foundation");
const { createAuthContext, sameOriginOnly } = require("./auth-routes");

// 建立 Express 應用程式
function createApp({ database = null, getAuthenticatedUserId = null } = {}) {
  const app = express();
  app.disable("x-powered-by");

  // 限制 JSON 請求大小
  app.use(express.json({ limit: "16kb" }));

  // M1 健康檢查
  app.get("/api/health", (_req, res) => {
    res.json({
      service: "TaskFlow",
      status: "ok",
      milestone: "M1",
    });
  });

  // 有資料庫時啟用正式 API
  if (database) {
    // 僅相容既有自動化測試中的可信任身分注入
    const injected = typeof getAuthenticatedUserId === "function";
    const auth = injected ? null : createAuthContext(database);

    if (auth) {
      // 正式註冊、登入、登出、目前使用者 API
      app.use("/api/auth", sameOriginOnly, auth.router);

      // 所有 /api/projects 寫入（含 /members）共用同源與 CSRF 防護
      app.use("/api/projects", (req, res, next) => {
        if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
          return next();
        }

        // 未登入時由路由回傳 401
        if (!auth.actorId(req)) {
          return next();
        }

        sameOriginOnly(req, res, () => auth.requireCsrf(req, res, next));
      });
    }

    const actorId = injected
      ? getAuthenticatedUserId
      : (req) => auth.actorId(req);

    // M4-B 成員管理路由（與 Project CRUD 共用安全 Middleware）
    app.use(
      "/api/projects",
      createMemberRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );

    // 原本 M2-B Project CRUD，原有行為不變
    app.use(
      "/api/projects",
      createProjectRouter({
        db: database,
        getAuthenticatedUserId: actorId,
      }),
    );
  }

  // 前端 Dashboard
  app.use(express.static(path.join(__dirname, "..", "public")));

  // 不存在的 API
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "API_NOT_FOUND",
      message: "找不到指定的 API。",
    });
  });

  // 統一錯誤處理
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

// 保留 M1 測試匯入方式
const app = createApp();

if (require.main === module) {
  const db = openDatabase();
  initializeSchema(db);

  const port = Number(process.env.PORT || 3000);

  const server = createApp({ database: db }).listen(port, "127.0.0.1", () => {
    console.log("TaskFlow | M4-B Member API");
    console.log(`Server: http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/api/health`);
    console.log("Auth API: /api/auth/register, /login, /me, /logout");
    console.log("Member API: /api/projects/:id/members");
  });

  server.on("error", (err) => {
    console.error("Server startup error:", err.message);
    db.close();
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.createApp = createApp;
