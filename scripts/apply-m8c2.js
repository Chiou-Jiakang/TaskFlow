"use strict";

// M8-C2：增量、安全且可重複執行的前端整合工具。
// --dry-run 僅預覽。實際改動前備份原檔；不動 server/ 或資料庫。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) {
  throw new Error("不支援的參數；僅接受 --dry-run。");
}
const MARK = "M8-C2-BEGIN";
function replaceOnce(data, anchor, replacement, label) {
  const index = data.indexOf(anchor);
  if (index < 0 || data.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`${label} 錨點不存在或不唯一，停止寫入以保護已完成的功能。`);
  }
  return data.replace(anchor, replacement);
}
function patchIndex(data) {
  data = replaceOnce(data,
    '    <link rel="stylesheet" href="/task-comments.css" />',
    '    <link rel="stylesheet" href="/task-comments.css" />\n' +
      `    <!-- ${MARK}: 專案活動時間軸 -->\n` +
      '    <link rel="stylesheet" href="/task-activity.css" />',
    "public/index.html CSS");
  data = replaceOnce(data,
    '    <script src="/task-comments.js" defer></script>',
    '    <script src="/task-comments.js" defer></script>\n' +
      `    <!-- ${MARK}: 活動時間軸模組，使用現有專案選擇器 -->\n` +
      '    <script src="/task-activity.js" defer></script>',
    "public/index.html JS");
  return data;
}
function patchBoard(data) {
  data = replaceOnce(data,
    '    window.TaskComments?.projectChanged(currentId);',
    '    window.TaskComments?.projectChanged(currentId);\n' +
      `    // ${MARK}: 切換專案後不得殘留舊活動紀錄。\n` +
      '    window.TaskActivity?.projectChanged(currentId);',
    "public/task-board.js refresh");
  data = replaceOnce(data,
    '      window.TaskComments?.revoke(projectId);',
    '      window.TaskComments?.revoke(projectId);\n' +
      `      // ${MARK}: 權限撤銷時關閉活動面板。\n` +
      '      window.TaskActivity?.revoke(projectId);',
    "public/task-board.js revoke");
  data = replaceOnce(data,
    '      el("task-submit").disabled = !isManager() || !canWrite();',
    '      el("task-submit").disabled = !isManager() || !canWrite();\n' +
      `      // ${MARK}: 任務操作結束後復原工具列活動按鈕。\n` +
      '      if (el("task-activity-open")) el("task-activity-open").disabled = false;',
    "public/task-board.js setBusy");
  return data;
}
const files = [
  { rel: "public/index.html", modify: patchIndex, indicators: [
    '<link rel="stylesheet" href="/task-activity.css" />',
    '<script src="/task-activity.js" defer></script>',
  ] },
  { rel: "public/task-board.js", modify: patchBoard, indicators: [
    'window.TaskActivity?.projectChanged(currentId)',
    'window.TaskActivity?.revoke(projectId)',
    'el("task-activity-open").disabled = false',
  ] },
];
const prerequisites = [
  "public/task-comments.js", "public/task-comments.css",
  "public/task-activity.js", "public/task-activity.css",
  "server/collaboration-routes.js", "server/collaboration-repository.js",
];
for (const name of prerequisites) {
  if (!fs.existsSync(path.join(root, name))) {
    throw new Error(`缺少必要檔案：${name}，沒有寫入任何檔案。`);
  }
}
const planned = files.map(({ rel, modify, indicators }) => {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, "utf8");
  const normalized = before.replace(/\r\n/g, "\n");
  if (normalized.includes(MARK)) {
    if (!indicators.every((i) => normalized.includes(i))) {
      throw new Error(`${rel} M8-C2 標記不完整，可能曾部分整合；請先檢查。`);
    }
    return { rel, file, before, after: before, changed: false };
  }
  const output = modify(normalized);
  const after = before.includes("\r\n") ? output.replace(/\n/g, "\r\n") : output;
  return { rel, file, before, after, changed: before !== after };
});
for (const item of planned) console.log(`[${item.changed ? dryRun ? "預覽" : "準備" : "已整合，跳過"}] ${item.rel}`);
if (dryRun) {
  console.log("Dry run 完成：未寫入任何檔案。");
  process.exit(0);
}
const pending = planned.filter((item) => item.changed);
if (!pending.length) {
  console.log("M8-C2 已整合，不需再次修改。");
  process.exit(0);
}
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M8C2-backup-"));
for (const item of pending) {
  const location = path.join(backupDir, item.rel);
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.copyFileSync(item.file, location);
}
const written = [];
try {
  for (const item of pending) {
    fs.writeFileSync(item.file, item.after, "utf8");
    written.push(item);
    console.log(`[更新] ${item.rel}`);
  }
} catch (error) {
  for (const item of written) fs.copyFileSync(path.join(backupDir, item.rel), item.file);
  console.error("寫入發生錯誤；已嘗試還原，備份：", backupDir);
  throw error;
}
console.log("M8-C2 整合完成，原始檔案備份於：", backupDir);
console.log("請執行 M8-C2 專項測試與完整 Edge E2E，尚未 Git Commit／Push。");
