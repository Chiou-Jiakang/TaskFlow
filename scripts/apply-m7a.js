"use strict";

// M7-A 一次性安全整合工具：只對 server/server.js 做兩個精確插入。
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "server", "server.js");
const dryRun = process.argv.includes("--dry-run");
const eol = fs.readFileSync(file, "utf8").includes("\r\n") ? "\r\n" : "\n";
const content = fs.readFileSync(file, "utf8");

const moduleImport = 'const { createAuthContext, sameOriginOnly } = require("./auth-routes");';
const importLine = 'const { attachRealtime } = require("./realtime-hub");';
const startupLine = '  server.on("error", (err) => {';
const attachLine = '  attachRealtime(server, db);';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

if (content.includes(importLine) && content.includes(attachLine)) {
  console.log("M7-A 已整合，沒有重複修改。");
  process.exit(0);
}
if (content.includes(importLine) || content.includes(attachLine)) {
  throw new Error("只偵測到部分 M7-A 修改，請人工確認 server/server.js。未寫入。");
}
if (countOccurrences(content, moduleImport) !== 1 || countOccurrences(content, startupLine) !== 1) {
  throw new Error("找不到唯一的 M6 參照位置，可能版本不同。未寫入。");
}
if (!fs.existsSync(path.join(root, "server", "realtime-hub.js"))) {
  throw new Error("缺少 server/realtime-hub.js。未寫入。");
}

const updated = content
  .replace(moduleImport, moduleImport + eol + importLine)
  .replace(startupLine, attachLine + eol + eol + startupLine);

if (dryRun) {
  console.log("[預覽] server/server.js 將新增 realtime-hub import 和正式啟動掛載。");
  console.log("尚未修改任何檔案。");
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M7A-server-"));
const backup = path.join(dir, "server.js");
fs.copyFileSync(file, backup);
fs.writeFileSync(file, updated, "utf8");
console.log("M7-A server.js 整合成功。僅新增兩行程式。");
console.log(`備份路徑：${backup}`);
console.log("請執行：node --check server/server.js");
