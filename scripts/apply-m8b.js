"use strict";

// M8-B source-only patcher. No real SQLite database is opened or modified.
// Usage: node scripts/apply-m8b.js --dry-run
//        node scripts/apply-m8b.js
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
if (process.argv.some((arg) => arg !== "--dry-run" && arg !== process.argv[0] && arg !== process.argv[1])) {
  throw new Error("不支援的命令參數。只允許 --dry-run。");
}

function replaceOnce(content, oldText, newText, label) {
  if (content.includes(newText)) return content;
  const index = content.indexOf(oldText);
  if (index === -1 || content.indexOf(oldText, index + oldText.length) !== -1) {
    throw new Error(`無法在 ${label} 找到唯一的預期修改位置。為保護既有程式，本次中止。`);
  }
  return content.replace(oldText, newText);
}

function patchServer(content) {
  let code = content;
  code = replaceOnce(code,
    'const { initializeTaskSchema } = require("./task-repository");',
    'const { initializeTaskSchema } = require("./task-repository");\n' +
    'const { initializeCollaborationSchema } = require("./collaboration-repository");\n' +
    'const { createCollaborationRouter } = require("./collaboration-routes");',
    "server.js imports");
  code = replaceOnce(code,
    '    initializeTaskSchema(database);',
    '    initializeTaskSchema(database);\n    initializeCollaborationSchema(database);',
    "server.js schema");
  const anchor = '    // ========================================\n    // M2 Project CRUD API';
  const router = [
    '    // ========================================',
    '    // M8-B Task Comments / Project Activity API',
    '    // ========================================',
    '    app.use(',
    '      "/api/projects",',
    '      createCollaborationRouter({',
    '        db: database,',
    '        getAuthenticatedUserId: actorId,',
    '      }),',
    '    );',
    '',
  ].join("\n");
  code = replaceOnce(code, anchor, router + anchor, "server.js router");
  return code;
}

function patchDbInit(content) {
  let code = content;
  code = replaceOnce(code,
    'const { initializeTaskSchema } = require("./task-repository");',
    'const { initializeTaskSchema } = require("./task-repository");\n' +
    'const { initializeCollaborationSchema } = require("./collaboration-repository");',
    "init-db.js imports");
  code = replaceOnce(code,
    '  initializeTaskSchema(db);',
    '  initializeTaskSchema(db);\n  initializeCollaborationSchema(db);',
    "init-db.js schema");
  return code;
}

const edits = [
  { rel: "server/server.js", patch: patchServer },
  { rel: "server/init-db.js", patch: patchDbInit },
];
const prepared = edits.map(({ rel, patch }) => {
  const filename = path.join(root, rel);
  const before = fs.readFileSync(filename, "utf8");
  const eol = before.includes("\r\n") ? "\r\n" : "\n";
  const beforeLF = before.replace(/\r\n/g, "\n");
  const afterLF = patch(beforeLF);
  return { rel, filename, before, after: afterLF.replace(/\n/g, eol) };
});

// Require M8-A source files and new M8-B module before editing anything.
for (const rel of [
  "server/collaboration-schema.sql",
  "server/collaboration-repository.js",
  "server/collaboration-routes.js",
  "tests/collaboration-repository.test.js",
  "tests/collaboration-api.test.js",
]) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`缺少必要檔案：${rel}。本次未修改任何檔案。`);
  }
}

const changed = prepared.filter((item) => item.before !== item.after);
for (const item of prepared) {
  console.log(`${dryRun ? "[預覽]" : "[檢查]"} ${item.rel}: ${item.before === item.after ? "已整合，跳過" : "需要新增 M8-B 整合"}`);
}
if (dryRun || changed.length === 0) {
  console.log(dryRun ? "Dry run 完成，沒有寫入任何檔案。" : "整合已存在，不需要重複修改。");
  process.exit(0);
}

// Backup all originals before writing. If writing fails, restore both.
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M8B-source-backup-"));
for (const item of changed) {
  fs.copyFileSync(item.filename, path.join(backupDir, path.basename(item.filename)));
}
try {
  for (const item of changed) {
    fs.writeFileSync(item.filename, item.after, "utf8");
    console.log(`[更新] ${item.rel}`);
  }
} catch (error) {
  for (const item of changed) {
    try { fs.writeFileSync(item.filename, item.before, "utf8"); } catch (restoreError) {
      console.error("回復失敗，請使用備份：", item.rel, restoreError.message);
    }
  }
  throw error;
}
console.log(`M8-B source integration 完成。備份：${backupDir}`);
console.log("接下來先執行 node --check 與單元／API 測試，再進行 db:init。尚未 Commit/Push。");
