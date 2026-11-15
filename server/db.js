"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sqlite = require("node:sqlite");

// 相容不同 Node.js 版本的 SQLite 類別名稱
const SQLiteDatabase = sqlite.Database || sqlite.DatabaseSync;

const DEFAULT_DB_PATH = path.join(__dirname, "..", "data", "taskflow.db");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

// 開啟 SQLite 資料庫
function openDatabase(filename = DEFAULT_DB_PATH) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), {
      recursive: true,
    });
  }

  const db = new SQLiteDatabase(filename);

  // 啟用外鍵約束
  db.exec("PRAGMA foreign_keys = ON;");

  // 遇到資料庫鎖定時，最多等待 5 秒
  db.exec("PRAGMA busy_timeout = 5000;");

  // 檔案型資料庫使用 WAL 模式
  if (filename !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }

  return db;
}

// 建立資料表與索引
function initializeSchema(db) {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");

  db.exec(schema);
}

module.exports = {
  openDatabase,
  initializeSchema,
};
