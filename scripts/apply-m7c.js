"use strict";

// M7-C：保守、可重跑的整合工具。先檢查全部原始檔與錨點，再一次備份及寫入。
// 只修改 public 下既有的四份檔案；不觸碰 SQLite、M7-A/B 的 server 檔。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const MARK = "M7-C-BEGIN";

const edits = {
  "public/index.html": [[
    '    <script src="/task-board.js" defer></script>',
    `    <!-- ${MARK}: 安全的同源 Socket.IO Client 與同步協調器 -->\n    <script src="/socket.io/socket.io.js" defer></script>\n    <script src="/task-realtime.js" defer></script>\n    <script src="/task-board.js" defer></script>`,
  ]],
  "public/dashboard-auth.js": [
    [
      'function goToLogin() {\n  currentCsrfToken = null;',
      'function goToLogin() {\n  window.TaskRealtime?.stop();\n  currentCsrfToken = null;',
    ],
    [
      'projectForm.addEventListener("submit", async (event) => {',
      '// M7-C-BEGIN：成員／專案變動後重讀真正的 REST 清單，不相信 WebSocket 傳入的內容。\nwindow.TaskFlowDashboard = { reloadProjects: loadProjects };\n\nprojectForm.addEventListener("submit", async (event) => {',
    ],
  ],
  "public/task-board.js": [
    [
      '    editingId: null,\n    busy: false,',
      '    editingId: null,\n    // M7-C：保留進入編輯時的版本，避免背景刷新後以新版本覆寫舊表單。\n    editingVersion: null,\n    busy: false,',
    ],
    [
      '      render();\n    }\n  }\n\n  function resetForm() {',
      '      render();\n      queueMicrotask(() => window.TaskRealtime?.flushPending());\n    }\n  }\n\n  function resetForm() {',
    ],
    [
      '  function resetForm() {\n    state.editingId = null;\n    form.reset();',
      '  function resetForm() {\n    state.editingId = null;\n    state.editingVersion = null;\n    form.reset();\n    queueMicrotask(() => window.TaskRealtime?.flushPending());',
    ],
    [
      '      card.addEventListener("dragend", endDrag);',
      '      card.addEventListener("dragend", () => {\n        endDrag();\n        queueMicrotask(() => window.TaskRealtime?.flushPending());\n      });',
    ],
    [
      '  async function refresh() {\n    const currentId = selector.value;',
      '  async function refresh() {\n    const currentId = selector.value;\n    // 訂閱變更由 M7-A 校驗成員資格，Socket 本身無法修改資料。\n    window.TaskRealtime?.setProject(currentId);',
    ],
    [
      '    state.editingId = task.id;\n    el("task-title").value = task.title;',
      '    state.editingId = task.id;\n    state.editingVersion = task.version;\n    el("task-title").value = task.title;',
    ],
    [
      '      version: editing?.version,\n    };\n    mutate(',
      '      version: state.editingVersion ?? editing?.version,\n    };\n    mutate(',
    ],
    [
      '  window.TaskBoard = {\n    openSession(user, csrfToken) {',
      `  // ${MARK}: 忙碌／編輯／拖曳期間，暫不執行會重建卡片的遠端刷新。\n  function canRealtimeSync() {\n    return Boolean(state.csrf && !state.busy && !state.dragging && state.editingId === null);\n  }\n\n  window.TaskBoard = {\n    realtimeSync(update) {\n      if (!canRealtimeSync() || Number(selector.value) !== update?.projectId) return false;\n      if (update.refreshProjects) {\n        if (typeof window.TaskFlowDashboard?.reloadProjects !== "function") return false;\n        void window.TaskFlowDashboard.reloadProjects().catch((error) => {\n          notice(error.message || "專案資料同步失敗，請重新整理。", true);\n        });\n      } else {\n        void refresh();\n      }\n      return true;\n    },\n    realtimeRevoked(projectId) {\n      if (Number(selector.value) !== projectId) return;\n      ++state.requestId;\n      state.project = null;\n      state.members = [];\n      state.tasks = [];\n      selector.value = "";\n      resetForm();\n      render();\n      notice("你已失去此專案的存取權，正在重新讀取專案清單。", true);\n    },\n    openSession(user, csrfToken) {`,
    ],
    [
      '      state.csrf = csrfToken;\n      emptyBoard();',
      '      state.csrf = csrfToken;\n      emptyBoard();\n      window.TaskRealtime?.start();',
    ],
  ],
  "public/task-board.css": [[
    '/* M6-C：沿用既有深色 TaskFlow 視覺，擴充實際拖放排序。 */',
    `/* ${MARK}: Socket.IO 連線狀態，純文字呈現；不帶入未經信任的 HTML。 */\n#task-realtime-status {\n  display: inline-block;\n  color: #c4d1ea;\n  font-size: 12px;\n  line-height: 1.5;\n}\n#task-realtime-status[data-kind="success"] { color: #9be6ba; }\n#task-realtime-status[data-kind="warning"] { color: #ffce94; }\n\n/* M6-C：沿用既有深色 TaskFlow 視覺，擴充實際拖放排序。 */`,
  ]],
};

function onceReplace(source, before, after, file) {
  const hits = source.split(before).length - 1;
  if (hits !== 1) {
    throw new Error(`${file}: 找不到唯一的修改錨點（找到 ${hits} 處）：${before.slice(0, 85)}`);
  }
  return source.replace(before, after);
}
function transform(source, steps, file) {
  let normalized = source.replace(/\r\n/g, "\n");
  for (const [before, after] of steps) normalized = onceReplace(normalized, before, after, file);
  return source.includes("\r\n") ? normalized.replace(/\n/g, "\r\n") : normalized;
}

if (!fs.existsSync(path.join(root, "public", "task-realtime.js"))) {
  throw new Error("請先放入 public/task-realtime.js 再執行整合。");
}
for (const prerequisite of ["server/realtime-hub.js", "server/realtime-notifier.js"]) {
  if (!fs.existsSync(path.join(root, prerequisite))) {
    throw new Error(`缺少 M7-A/B 前置檔案：${prerequisite}`);
  }
}
const plan = [];
for (const [relative, steps] of Object.entries(edits)) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`缺少原有檔案：${relative}`);
  const original = fs.readFileSync(file, "utf8");
  if (original.includes(MARK)) {
    // 再次執行時只報告已整合；拒絕不完整的標記檔。
    if (relative === "public/task-board.js" &&
      (!original.includes("realtimeRevoked(projectId)") ||
       !original.includes("state.editingVersion ?? editing?.version"))) {
      throw new Error(`${relative} 的 M7-C 修改不完整，已停止。`);
    }
    console.log(`[已整合] ${relative}`);
    continue;
  }
  const modified = transform(original, steps, relative);
  plan.push({ relative, file, original, modified });
}
if (dryRun) {
  for (const item of plan) console.log(`[預覽] ${item.relative}`);
  console.log("預覽完成；尚未修改任何檔案。");
  process.exit(0);
}
if (!plan.length) {
  console.log("M7-C 已整合，未重複改寫。");
  process.exit(0);
}
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M7C-backup-"));
for (const { relative, file } of plan) {
  const dest = path.join(backupDir, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}
try {
  for (const { file, modified, relative } of plan) {
    fs.writeFileSync(file, modified, "utf8");
    console.log(`[更新] ${relative}`);
  }
} catch (error) {
  // 寫入階段出錯則立即以暫存備份還原；不碰其他歷史資料。
  for (const { relative, file } of plan) fs.copyFileSync(path.join(backupDir, relative), file);
  throw error;
}
console.log("M7-C 前端整合完成。備份：", backupDir);
console.log("尚未 Commit／Push，請執行 M7-C 專項測試與整體回歸。");
