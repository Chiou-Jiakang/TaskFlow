"use strict";

const { openDatabase, initializeSchema } = require("./db");

let db;

try {
  db = openDatabase();

  initializeSchema(db);

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
    .all();

  const names = tables.map((row) => row.name);

  console.log("TaskFlow SQLite 初始化完成：", names.join(", "));

  console.log("資料庫：data/taskflow.db（不提交至 Git）");
} catch (error) {
  console.error("SQLite 初始化失敗：", error.message);

  process.exitCode = 1;
} finally {
  db?.close();
}
