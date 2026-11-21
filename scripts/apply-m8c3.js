"use strict";
// TaskFlow M8-C3: make surgical, reversible additions. Never overwrite SQLite.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(a => a !== '--dry-run')) throw new Error('僅支援 --dry-run');
const dryRun = args.includes('--dry-run');
const MARK = 'M8-C3-BEGIN';
function edit(s, before, after, name) {
  const first = s.indexOf(before);
  if (first < 0 || s.indexOf(before, first + before.length) !== -1) {
    throw new Error(name + ' 修改位置不存在或不唯一；已停止，沒有寫入。');
  }
  return s.slice(0, first) + after + s.slice(first + before.length);
}
const changes = {
  'server/realtime-notifier.js': s => edit(s,
    'new Set(["task", "member", "project"])',
    `/* ${MARK} */ new Set(["task", "member", "project", "comment"])`, 'notifier 資源驗證'),
  'server/realtime-hub.js': s => edit(s,
    '!["task", "member", "project"].includes(change.resource)',
    `/* ${MARK} */ !["task", "member", "project", "comment"].includes(change.resource)`, 'hub Room 事件驗證'),
  'server/collaboration-routes.js': s => {
    s = edit(s,
      '    // M8-C will add Socket.IO events; M8-B intentionally does not alter M7\'s event protocol.',
      `    // ${MARK}: 資料庫已 COMMIT 後，交由 M7-B 的 response-finish notifier 發佈 ID 事件。\n` +
      '    res.locals.taskflowRealtimeChange = { projectId, resource: "comment", action: "created", resourceId: comment.id, version: comment.version };',
      'comment create 成功通知');
    s = edit(s,
      '    res.json({ comment });\n  });\n\n  // DELETE /api/projects',
      `    // ${MARK}: 更新成功才標記通知，不帶留言正文。\n` +
      '    res.locals.taskflowRealtimeChange = { projectId, resource: "comment", action: "updated", resourceId: comment.id, version: comment.version };\n' +
      '    res.json({ comment });\n  });\n\n  // DELETE /api/projects', 'comment patch 成功通知');
    s = edit(s,
      '    repository.deleteComment(req.actorId, projectId, taskId, commentId, version);\n    res.status(204).end();',
      '    repository.deleteComment(req.actorId, projectId, taskId, commentId, version);\n' +
      `    // ${MARK}: 204 成功才標記刪除通知。\n` +
      '    res.locals.taskflowRealtimeChange = { projectId, resource: "comment", action: "deleted", resourceId: commentId };\n' +
      '    res.status(204).end();', 'comment delete 成功通知');
    return s;
  },
  'public/task-realtime.js': s => {
    s = edit(s, 'new Set(["task", "member", "project"])',
      `/* ${MARK} */ new Set(["task", "member", "project", "comment"])`, 'client 接受 comment');
    s = edit(s,
      '    if (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version <= 0)) return false;\n    return true;',
      '    if (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version <= 0)) return false;\n' +
      '    if (Object.keys(payload).some(key => ![\"projectId\", \"resource\", \"action\", \"resourceId\", \"version\", \"at\"].includes(key))) return false;\n' +
      '    return true;', 'client 嚴格事件欄位');
    s = edit(s,
      '    onExpired = () => {}, reportError = () => {}, delay = 100,',
      `    onExpired = () => {}, reportError = () => {},\n    /* ${MARK} */ onCollaborationChange = () => {}, onRoomJoined = () => {}, delay = 100,`, '協調器 callbacks');
    s = edit(s,
      '        joinedProject = projectId;\n        status("即時同步中", "success");',
      `        joinedProject = projectId;\n        status("即時同步中", "success");\n        // ${MARK}: Room 重連成功時，從 REST 補抓斷線期間的留言與活動。\n        try { onRoomJoined(projectId); } catch (error) { reportError(error); }`, 'reconnect REST 補抓');
    s = edit(s,
      '        queueChange(payload.projectId, payload.resource !== "task");',
      `        // ${MARK}: 留言變更不需要重載整個 Kanban；只有已開啟的面板會重新從 REST 查詢。\n` +
      '        if (payload.resource === "comment") {\n' +
      '          try { onCollaborationChange({ projectId: payload.projectId, resource: "comment", action: payload.action }); }\n' +
      '          catch (error) { reportError(error); }\n' +
      '          return;\n' +
      '        }\n' +
      '        queueChange(payload.projectId, payload.resource !== "task");', 'Socket comment event dispatch');
    s = edit(s,
      '    onChange: (update) => root.TaskBoard?.realtimeSync(update) ?? false,',
      '    onChange: (update) => root.TaskBoard?.realtimeSync(update) ?? false,\n' +
      `    // ${MARK}: 僅傳遞已驗證的專案 ID；留言正文一律由 REST 授權讀取。\n` +
      '    onCollaborationChange: (update) => {\n' +
      '      root.TaskComments?.realtimeChanged(update.projectId);\n' +
      '      root.TaskActivity?.realtimeChanged(update.projectId);\n' +
      '    },\n' +
      '    onRoomJoined: (projectId) => {\n' +
      '      root.TaskComments?.realtimeChanged(projectId);\n' +
      '      root.TaskActivity?.realtimeChanged(projectId);\n' +
      '    },', 'wire UI callbacks');
    return s;
  },
  'public/task-comments.js': s => {
    s = edit(s, '  let focusOrigin = null;',
      `  let focusOrigin = null;\n  // ${MARK}: 未完成讀取／寫入期間的 Socket 更新必須保留，不能直接丟棄。\n` +
      '  let remoteDirty = false;\n  let remoteTimer = null;\n' +
      '  function flushRemote() {\n' +
      '    if (!remoteDirty || remoteTimer !== null || !current || busy || loading) return;\n' +
      '    remoteTimer = root.setTimeout(() => {\n' +
      '      remoteTimer = null;\n' +
      '      if (!remoteDirty || !current || busy || loading) return;\n' +
      '      remoteDirty = false;\n' +
      '      void reload({ preserveDraft: true });\n' +
      '    }, 90);\n' +
      '  }\n', 'comments pending refresh');
    s = edit(s,
      '      if (started === sequence) { loading = false; render(); }',
      '      if (started === sequence) { loading = false; render(); flushRemote(); }', 'comments load finally');
    s = edit(s,
      '      if (started === sequence) { busy = false; render(); }',
      '      if (started === sequence) { busy = false; render(); flushRemote(); }', 'comments mutate finally');
    s = edit(s,
      '  function close() {\n    sequence++;',
      '  function close() {\n' +
      '    remoteDirty = false;\n' +
      '    if (remoteTimer !== null) root.clearTimeout(remoteTimer);\n' +
      '    remoteTimer = null;\n' +
      '    sequence++;', 'comments close');
    s = edit(s,
      '  root.TaskComments = { open, close, projectChanged, revoke };',
      `  // ${MARK}: 僅刷新目前開啟且屬於同一專案的留言面板。\n` +
      '  function realtimeChanged(projectId) {\n' +
      '    if (!current || current.projectId !== Number(projectId) || overlay.hidden) return;\n' +
      '    remoteDirty = true;\n' +
      '    flushRemote();\n' +
      '  }\n' +
      '  root.TaskComments = { open, close, projectChanged, revoke, realtimeChanged };', 'comments exports');
    return s;
  },
  'public/task-activity.js': s => {
    s = edit(s,
      '  let previousFocus = null;',
      `  let previousFocus = null;\n  // ${MARK}: 正在分頁讀取時收到事件先記錄，讀取完成後再補抓。\n` +
      '  let remoteDirty = false;\n  let remoteTimer = null;\n' +
      '  function flushRemote() {\n' +
      '    if (!remoteDirty || remoteTimer !== null || !currentProject || loading) return;\n' +
      '    remoteTimer = root.setTimeout(() => {\n' +
      '      remoteTimer = null;\n' +
      '      if (!remoteDirty || !currentProject || loading) return;\n' +
      '      remoteDirty = false;\n' +
      '      void reload();\n' +
      '    }, 90);\n' +
      '  }\n', 'activity pending refresh');
    s = edit(s,
      '        loading = false;\n        render();',
      '        loading = false;\n        render();\n        flushRemote();', 'activity read finally');
    s = edit(s,
      '  function close() {\n    sequence++;',
      '  function close() {\n' +
      '    remoteDirty = false;\n' +
      '    if (remoteTimer !== null) root.clearTimeout(remoteTimer);\n' +
      '    remoteTimer = null;\n' +
      '    sequence++;', 'activity close');
    s = edit(s,
      '  root.TaskActivity = { open, close, projectChanged, revoke };',
      `  // ${MARK}: 只刷新目前開啟的相同專案時間軸。\n` +
      '  function realtimeChanged(projectId) {\n' +
      '    if (!currentProject || currentProject !== Number(projectId) || overlay.hidden) return;\n' +
      '    remoteDirty = true;\n' +
      '    flushRemote();\n' +
      '  }\n' +
      '  root.TaskActivity = { open, close, projectChanged, revoke, realtimeChanged };', 'activity exports');
    return s;
  },
};
const required = ['server/realtime-notifier.js','server/realtime-hub.js','server/collaboration-routes.js',
  'public/task-realtime.js','public/task-comments.js','public/task-activity.js'];
const plan = required.map(rel => {
  const file = path.join(base, rel);
  if (!fs.existsSync(file)) throw new Error('缺少必要檔案 ' + rel + '，沒有寫入。');
  const previous = fs.readFileSync(file, 'utf8');
  const normalized = previous.replace(/\r\n/g,'\n');
  // M8-C3 idempotence: require all of the true signals on each file.
  const completedChecks = {
    'server/realtime-notifier.js': ['"comment"'],
    'server/realtime-hub.js': ['"comment"'],
    'server/collaboration-routes.js': ['resource: "comment", action: "created"','resource: "comment", action: "updated"','resource: "comment", action: "deleted"'],
    'public/task-realtime.js': ['onCollaborationChange','onRoomJoined','root.TaskActivity?.realtimeChanged'],
    'public/task-comments.js': ['function realtimeChanged(projectId)','flushRemote();','root.TaskComments = { open, close, projectChanged, revoke, realtimeChanged }'],
    'public/task-activity.js': ['function realtimeChanged(projectId)','flushRemote();','root.TaskActivity = { open, close, projectChanged, revoke, realtimeChanged }'],
  }[rel];
  if (normalized.includes(MARK)) {
    if (!completedChecks.every(check => normalized.includes(check))) throw new Error(rel + ' 已部分套用 M8-C3，請檢查後再試。');
    return { rel,file,previous,updated: previous,changed:false };
  }
  const nextLF = changes[rel](normalized);
  if (!nextLF.includes(MARK) || nextLF === normalized) throw new Error('修改異常：' + rel);
  const updated = previous.includes('\r\n') ? nextLF.replace(/\n/g,'\r\n') : nextLF;
  return {rel,file,previous,updated,changed:updated!==previous};
});
for (const p of plan) console.log(`[${p.changed ? (dryRun ? '預覽' : '準備') : '已整合，跳過'}] ${p.rel}`);
if (dryRun) { console.log('預覽完成；未修改任何檔案。'); process.exit(0); }
const changed = plan.filter(p => p.changed);
if (!changed.length) { console.log('M8-C3 已整合，無需重複修改。'); process.exit(0); }
const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'TaskFlow-M8C3-backup-'));
for (const p of changed) { const out=path.join(backup,p.rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(p.file,out); }
const written = [];
try { for (const p of changed) { fs.writeFileSync(p.file,p.updated,'utf8');written.push(p); console.log('[更新] '+p.rel); } }
catch(err) { for (const p of written) fs.copyFileSync(path.join(backup,p.rel),p.file); throw err; }
console.log('M8-C3 整合完成，原始檔案備份：'+backup);
console.log('請執行單元測試、Edge E2E、完整回歸；尚未 Commit/Push。');
