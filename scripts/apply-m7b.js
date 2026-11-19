"use strict";

// M7-B：安全、具版本錨點的整合工具。只修改已知的六份路由／入口檔。
// 預設 --dry-run 或執行無參數時會備份修改前檔案；重複執行不會重複插入。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const marker = "M7-B-BEGIN";

const steps = {
  "server/server.js": [
    [
      'const { createTaskOrderRouter } = require("./task-order-routes");',
      'const { createTaskOrderRouter } = require("./task-order-routes");\nconst { createRealtimeNotifier } = require("./realtime-notifier");',
    ],
    [
      '    // ========================================\n    // M4 Member Management API',
      `    // ${marker}: 在所有 Project 寫入 API 前註冊成功回應的通知器。\n    app.use("/api/projects", createRealtimeNotifier(\n      () => app.locals.publishProjectChanged,\n    ));\n\n    // ========================================\n    // M4 Member Management API`,
    ],
    [
      '  const server = createApp({\n    database: db,\n  }).listen(port, "127.0.0.1", () => {',
      '  const runtimeApp = createApp({ database: db });\n  const server = runtimeApp.listen(port, "127.0.0.1", () => {',
    ],
    [
      '  attachRealtime(server, db);',
      '  const realtimeHub = attachRealtime(server, db);\n  runtimeApp.locals.publishProjectChanged = realtimeHub.publishProjectChanged;',
    ],
  ],
  "server/task-routes.js": [
    [
      '    const task = tasks.create(req.actorId, projectId, taskBody(req.body));',
      '    const task = tasks.create(req.actorId, projectId, taskBody(req.body));\n    // M7-B: Repository 成功 COMMIT 後註記，僅於 HTTP 2xx finish 推播。\n    res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "created", resourceId: task.id, version: task.version };',
    ],
    [
      '    res.json({\n      task: updated,\n    });',
      '    res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "updated", resourceId: updated.id, version: updated.version };\n    res.json({\n      task: updated,\n    });',
    ],
    [
      '    tasks.delete(req.actorId, projectId, taskId, version);',
      '    tasks.delete(req.actorId, projectId, taskId, version);\n    res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "deleted", resourceId: taskId };',
    ],
  ],
  "server/task-order-routes.js": [
    [
      '      res.status(200).json(result);',
      '      // 無實際位置變化的排序不製造虛假通知。\n      if (result.changedTaskIds.length > 0) {\n        res.locals.taskflowRealtimeChange = { projectId, resource: "task", action: "moved", resourceId: taskId, version: result.task.version };\n      }\n      res.status(200).json(result);',
    ],
  ],
  "server/member-routes.js": [
    [
      '    res.status(201).json(created);',
      '    res.locals.taskflowRealtimeChange = { projectId, resource: "member", action: "created", resourceId: created.member.userId, version: created.version };\n    res.status(201).json(created);',
    ],
    [
      '    res.json(updated);',
      '    res.locals.taskflowRealtimeChange = { projectId, resource: "member", action: "updated", resourceId: updated.member.userId, version: updated.version };\n    res.json(updated);',
    ],
    [
      '    members.remove(req.actorId, projectId, userId, version);\n    res.status(204).end();',
      '    const removed = members.remove(req.actorId, projectId, userId, version);\n    res.locals.taskflowRealtimeChange = { projectId, resource: "member", action: "deleted", resourceId: userId, version: removed.version };\n    res.status(204).end();',
    ],
  ],
  "server/project-routes.js": [
    [
      '    const created = repository.create(req.actorId, parseCreate(req.body));',
      '    const created = repository.create(req.actorId, parseCreate(req.body));\n    res.locals.taskflowRealtimeChange = { projectId: created.id, resource: "project", action: "created", resourceId: created.id, version: created.version };',
    ],
    [
      '    const updated = repository.update(req.actorId, id, version, patch);',
      '    const updated = repository.update(req.actorId, id, version, patch);\n    res.locals.taskflowRealtimeChange = { projectId: id, resource: "project", action: "updated", resourceId: id, version: updated.version };',
    ],
    [
      '    repository.delete(req.actorId, id, version);',
      '    repository.delete(req.actorId, id, version);\n    res.locals.taskflowRealtimeChange = { projectId: id, resource: "project", action: "deleted", resourceId: id };',
    ],
  ],
};

function countOf(haystack, needle) {
  return haystack.split(needle).length - 1;
}
function transform(source, replacements, fileName) {
  let updated = source.replace(/\r\n/g, "\n");
  for (const [before, after] of replacements) {
    const hits = countOf(updated, before);
    if (hits !== 1) throw new Error(`${fileName} 找不到唯一修改位置（${hits} 處）：${before.slice(0, 90)}`);
    updated = updated.replace(before, after);
  }
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  return updated.replace(/\n/g, eol);
}

if (!fs.existsSync(path.join(root, "server", "realtime-notifier.js"))) {
  throw new Error("缺少 server/realtime-notifier.js，請先解壓縮 M7-B 新檔案。");
}

const planned = [];
for (const [relative, replacements] of Object.entries(steps)) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, "utf8");
  const isPatched = relative === "server/server.js"
    ? source.includes(marker)
    : source.includes("res.locals.taskflowRealtimeChange");
  if (isPatched) {
    // 部分套用不能自動略過，避免 M7-B 功能缺漏。
    if (replacements.every(([, after]) => source.replace(/\r\n/g, "\n").includes(after))) {
      console.log(`[已整合] ${relative}`);
      continue;
    }
    throw new Error(`${relative} 看似部分整合，請檢查檔案；沒有寫入。`);
  }
  const updated = transform(source, replacements, relative);
  if (updated === source) throw new Error(`${relative} 沒有任何修改，拒絕繼續。`);
  planned.push({ file, relative, source, updated });
}

if (dryRun) {
  for (const p of planned) console.log(`[預覽] ${p.relative}`);
  console.log("預覽完成，尚未寫入任何檔案。");
  process.exit(0);
}

if (!planned.length) {
  console.log("M7-B 已整合，沒有重複修改。");
  process.exit(0);
}

// 避免中途某個檔案驗證失敗後，只修改到一半。
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M7B-backup-"));
for (const p of planned) {
  const target = path.join(backupDir, p.relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(p.file, target);
}
for (const p of planned) {
  fs.writeFileSync(p.file, p.updated, "utf8");
  console.log(`[更新] ${p.relative}`);
}
console.log("M7-B 後端推播整合完成。原始檔案備份：", backupDir);
console.log("下一步：node --test tests/realtime-notifier.test.js，再執行 npm test / Edge E2E。");
