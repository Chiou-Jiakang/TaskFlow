"use strict";

// M8-C1：只在 index.html / task-board.js 插入有限的前端掛載點。
// dry-run 不寫入；正式執行前先備份；重複執行不增加重複程式。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
if (process.argv.slice(2).some((arg) => arg !== "--dry-run")) {
  throw new Error("不支援的參數；僅接受 --dry-run。");
}
const START = "M8-C1-BEGIN";

function replaceExactlyOnce(content, before, after, file) {
  if (content.includes(after)) throw new Error(`${file} 已包含修改片段，可能有部分套用；請先檢查。`);
  const first = content.indexOf(before);
  if (first < 0 || content.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${file} 預期錨點不存在或重複，停止修改以保護既有程式。`);
  }
  return content.replace(before, after);
}
function patchIndex(content) {
  let data = content;
  data = replaceExactlyOnce(data,
    '    <link rel="stylesheet" href="/task-board.css" />',
    '    <link rel="stylesheet" href="/task-board.css" />\n' +
    `    <!-- ${START}: 任務留言樣式 -->\n` +
    '    <link rel="stylesheet" href="/task-comments.css" />',
    "public/index.html");
  data = replaceExactlyOnce(data,
    '    <script src="/task-realtime.js" defer></script>',
    '    <script src="/task-realtime.js" defer></script>\n' +
    `    <!-- ${START}: 任務留言模組，先於看板載入 -->\n` +
    '    <script src="/task-comments.js" defer></script>',
    "public/index.html");
  return data;
}
function patchBoard(content) {
  let data = content;
  data = replaceExactlyOnce(data,
    '    return card;\n  }\n\n  function render() {',
    `    // ${START}: 專案成員均可查看留言；修改權限由伺服器再次驗證。\n` +
    '    if (state.project) {\n' +
    '      const comments = button("留言", () => window.TaskComments?.open({\n' +
    '        projectId: Number(selector.value),\n' +
    '        taskId: task.id,\n' +
    '        taskTitle: task.title,\n' +
    '        userId: state.user?.id,\n' +
    '        role: state.project.myRole,\n' +
    '        writable: canWrite(),\n' +
    '        csrfToken: state.csrf,\n' +
    '      }));\n' +
    '      comments.classList.add("tf-comments-trigger");\n' +
    '      card.append(comments);\n' +
    '    }\n' +
    '    return card;\n  }\n\n  function render() {',
    "public/task-board.js makeCard");
  data = replaceExactlyOnce(data,
    '  async function refresh() {\n    const currentId = selector.value;',
    `  async function refresh() {\n    const currentId = selector.value;\n    // ${START}: 切換專案時關閉過時留言內容。\n    window.TaskComments?.projectChanged(currentId);`,
    "public/task-board.js refresh");
  data = replaceExactlyOnce(data,
    '    realtimeRevoked(projectId) {\n      if (Number(selector.value) !== projectId) return;',
    '    realtimeRevoked(projectId) {\n      if (Number(selector.value) !== projectId) return;\n' +
    `      // ${START}: 權限撤銷時立即清除留言面板。\n` +
    '      window.TaskComments?.revoke(projectId);',
    "public/task-board.js revoke");
  return data;
}
const edits = [
  { rel: "public/index.html", edit: patchIndex, checks: [
    '<link rel="stylesheet" href="/task-comments.css" />',
    '<script src="/task-comments.js" defer></script>',
  ] },
  { rel: "public/task-board.js", edit: patchBoard, checks: [
    'window.TaskComments?.open({',
    'window.TaskComments?.projectChanged(currentId)',
    'window.TaskComments?.revoke(projectId)',
  ] },
];
const required = ["public/task-comments.js", "public/task-comments.css",
  "server/collaboration-routes.js", "server/collaboration-repository.js"];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`缺少前置檔案 ${rel}，未修改。`);
}
const planned = edits.map(({ rel, edit, checks }) => {
  const file = path.join(root, rel);
  const original = fs.readFileSync(file, "utf8");
  const normalized = original.replace(/\r\n/g, "\n");
  if (normalized.includes(START)) {
    if (!checks.every((marker) => normalized.includes(marker))) {
      throw new Error(`${rel} M8-C1 標記不完整，請先檢查。`);
    }
    return { rel, file, original, updated: original, changed: false };
  }
  const newLF = edit(normalized);
  const updated = original.includes("\r\n") ? newLF.replace(/\n/g, "\r\n") : newLF;
  return { rel, file, original, updated, changed: updated !== original };
});
for (const item of planned) {
  console.log(`[${item.changed ? (dryRun ? "預覽" : "準備") : "已整合，跳過"}] ${item.rel}`);
}
if (dryRun) { console.log("Dry run 完成：沒有修改檔案。"); process.exit(0); }
const changed = planned.filter((item) => item.changed);
if (!changed.length) { console.log("M8-C1 已整合：本次未修改檔案。"); process.exit(0); }
const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M8C1-source-backup-"));
for (const item of changed) {
  const dest = path.join(backup, item.rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(item.file, dest);
}
const written = [];
try {
  for (const item of changed) {
    fs.writeFileSync(item.file, item.updated, "utf8");
    written.push(item);
    console.log(`[更新] ${item.rel}`);
  }
} catch (error) {
  for (const item of written) {
    fs.copyFileSync(path.join(backup, item.rel), item.file);
  }
  console.error("發生寫入錯誤，已嘗試還原原檔；請檢查備份位置。", backup);
  throw error;
}
console.log("M8-C1 整合完成；原檔備份：", backup);
console.log("請執行專項測試、Edge E2E、npm test。尚未 Git Commit／Push。");
