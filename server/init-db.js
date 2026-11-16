"use strict";

const { openDatabase, initializeSchema } = require("./db");

const { initializeAuthSchema } = require("./auth-foundation");

let db;

try {
  // 開啟正式 SQLite 資料庫
  db = openDatabase();

  // 初始化 M2 核心資料表
  initializeSchema(db);

  // 初始化 M3 身分驗證資料表
  initializeAuthSchema(db);

  // 確認目前有哪些資料表
  const tables = db
    .prepare(
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `,
    )
    .all()
    .map((row) => row.name);

  console.log("TaskFlow SQLite 初始化完成：", tables.join(", "));

  console.log("資料庫：data/taskflow.db（不提交至 Git）");
} catch (err) {
  console.error("SQLite 初始化失敗：", err.message);

  process.exitCode = 1;
} finally {
  db?.close();
}
