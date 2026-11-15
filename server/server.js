"use strict";

const express = require("express");
const path = require("node:path");

const { openDatabase, initializeSchema } = require("./db");

const { ProjectError } = require("./project-repository");

const { createProjectRouter } = require("./project-routes");

// 建立 Express 應用程式
function createApp({
  database = null,
  getAuthenticatedUserId = () => null,
} = {}) {
  const app = express();

  app.disable("x-powered-by");

  // 解析 JSON，限制請求大小
  app.use(express.json({ limit: "16kb" }));

  // 保留 M1 健康檢查格式，避免破壞舊測試
  app.get("/api/health", (req, res) => {
    res.json({
      service: "TaskFlow",
      status: "ok",
      milestone: "M1",
    });
  });

  // 已提供資料庫時，啟用 Project API
  if (database) {
    app.use(
      "/api/projects",
      createProjectRouter({
        db: database,
        getAuthenticatedUserId,
      }),
    );
  }

  // 提供現有 Dashboard
  app.use(express.static(path.join(__dirname, "..", "public")));

  // API 404
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: "API_NOT_FOUND",
      message: "找不到指定的 API。",
    });
  });

  // 統一錯誤處理
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    // 業務邏輯錯誤
    if (error instanceof ProjectError) {
      return res.status(error.status).json({
        error: error.code,
        message: error.message,
      });
    }

    // JSON 格式錯誤
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "INVALID_JSON",
        message: "JSON 格式錯誤。",
      });
    }

    // 請求內容超出限制
    if (error.type === "entity.too.large") {
      return res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: "請求內容過大。",
      });
    }

    console.error("TaskFlow request error:", error);

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "伺服器處理失敗。",
    });
  });

  return app;
}

// 維持 M1 自動化測試的匯入方式
const app = createApp();

// 只有直接執行 server.js 時才啟動伺服器
if (require.main === module) {
  const db = openDatabase();
  initializeSchema(db);

  const port = Number(process.env.PORT || 3000);

  // M3 尚未實作登入
  // 不注入使用者身分，因此 Project API 會回傳 401
  createApp({ database: db }).listen(port, "127.0.0.1", () => {
    console.log("TaskFlow | M2-B");
    console.log(`Server: http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/api/health`);
    console.log("Project API: authentication required (M3 pending)");
  });
}

module.exports = app;
module.exports.createApp = createApp;
