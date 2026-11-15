"use strict";

const express = require("express");
const path = require("node:path");

const app = express();

// 避免在 HTTP 回應中揭露 Express 識別標頭
app.disable("x-powered-by");

// 提供健康檢查 API
app.get("/api/health", (req, res) => {
  res.json({
    service: "TaskFlow",
    status: "ok",
    milestone: "M1",
  });
});

// 提供 public 資料夾內的前端靜態檔案
app.use(express.static(path.join(__dirname, "..", "public")));

// 對不存在的 API 回傳 JSON 錯誤
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API_NOT_FOUND",
    message: "找不到指定的 API。",
  });
});

// 直接啟動時才監聽連接埠
// 匯入至自動化測試時，不會自行啟動伺服器
if (require.main === module) {
  const PORT = Number(process.env.PORT || 3000);

  app.listen(PORT, "127.0.0.1", () => {
    console.log("==================================");
    console.log("TaskFlow | Milestone 1");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log("==================================");
  });
}

module.exports = app;
