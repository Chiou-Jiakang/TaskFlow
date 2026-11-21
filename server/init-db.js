"use strict";

const { openDatabase, initializeSchema } = require("./db");
const { initializeAuthSchema } = require("./auth-foundation");
const { initializeTaskSchema } = require("./task-repository");
const { initializeCollaborationSchema } = require("./collaboration-repository");

let db;
try {
  db = openDatabase();
  // These are additive, idempotent migrations. No existing rows are deleted.
  initializeSchema(db);
  initializeAuthSchema(db);
  initializeTaskSchema(db);
  initializeCollaborationSchema(db);

  const tables = db
    .prepare(
      `
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `,
    )
    .all()
    .map((row) => row.name);

  const violations = db.prepare("PRAGMA foreign_key_check").all();
  if (violations.length) {
    throw new Error(`資料庫外鍵檢查失敗：${JSON.stringify(violations)}`);
  }

  console.log("TaskFlow SQLite 初始化完成：", tables.join(", "));
  console.log("資料庫：data/taskflow.db（不提交至 Git）");
} catch (err) {
  console.error("SQLite 初始化失敗：", err.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
