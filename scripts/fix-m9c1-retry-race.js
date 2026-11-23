"use strict";
// TaskFlow M9-C2 regression stabilization: test-only isolation for M9-C1 retry.
// Does not modify application code, SQLite, or Git history.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const target = path.resolve(process.cwd(), "e2e", "task-ux.e2e.js");
const mode = process.argv[2] ?? "--apply";
if (!["--apply", "--dry-run", "--verify"].includes(mode)) {
  console.error("用法：node fix-m9c1-retry-race.js [--dry-run|--apply|--verify]");
  process.exit(2);
}

const TAG_BEGIN = "// TASKFLOW-M9C2-RETRY-ISOLATION-BEGIN";
const TAG_END = "// TASKFLOW-M9C2-RETRY-ISOLATION-END";
const exactTestStart = '  await t.test("failed task read exposes retry without stale data, retry recovers", async () => {\n';
const initialAnchor = '    // A deterministic HTTP 503 is a genuine failed REST read.';
const restoreAnchor = '    await page.unrouteAll({ behavior: "wait" });\n  });\n\n  await t.test("filter-empty does not masquerade as project-empty", async () => {';

function countOccurrences(s, needle) { return s.split(needle).length - 1; }
function requireOnce(s, needle, what) {
  if (countOccurrences(s, needle) !== 1) {
    throw new Error(`${what} 的定位點應恰好出現一次；實際 ${countOccurrences(s, needle)} 次，停止避免誤改。`);
  }
}

try {
  if (!fs.existsSync(target)) throw new Error(`找不到測試檔：${target}`);
  const original = fs.readFileSync(target, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let content = original.replace(/\r\n/g, "\n");
  const hasBegin = content.includes(TAG_BEGIN);
  const hasEnd = content.includes(TAG_END);
  if (hasBegin !== hasEnd) throw new Error("找到不完整的 M9-C2 修正標記，為保護原始檔案已停止。");
  if (hasBegin && hasEnd) {
    requireOnce(content, TAG_BEGIN, "修正起點");
    requireOnce(content, TAG_END, "修正終點");
    console.log(`[${mode === "--verify" ? "核對" : "略過"}] 已有完整 M9-C2 修正：${target}`);
    process.exit(0);
  }
  if (mode === "--verify") throw new Error("尚未套用 M9-C2 重試競態修正。");
  requireOnce(content, exactTestStart, "M9-C1 重試案例");
  const start = content.indexOf(exactTestStart);
  const next = content.indexOf('  await t.test("filter-empty does not masquerade as project-empty", async () => {', start);
  if (next < 0) throw new Error("找不到重試案例結尾；為保護原始測試已停止。");
  const prefix = content.slice(0, start);
  let section = content.slice(start, next);
  const suffix = content.slice(next);
  requireOnce(section, initialAnchor, "讀取失敗模擬");
  requireOnce(section, '    await page.unrouteAll({ behavior: "wait" });\n  });\n\n', "路由還原");

  const isolate = `    ${TAG_BEGIN}\n` +
`    // This test isolates the REST retry UX from asynchronous Socket.IO revalidation.\n` +
`    // M7-D and M9-C2 cover realtime propagation independently.\n` +
`    await page.evaluate(() => {\n` +
`      if (typeof window.TaskRealtime?.stop !== "function") {\n` +
`        throw new Error("TaskRealtime.stop 未就緒，無法隔離重試測試");\n` +
`      }\n` +
`      window.TaskRealtime.stop();\n` +
`    });\n` +
`    // Drain any refresh that was already in progress before installing the 503 route.\n` +
`    await page.waitForFunction(() => {\n` +
`      const refresh = document.getElementById("task-refresh");\n` +
`      const board = document.querySelector(".board-section");\n` +
`      return Boolean(refresh && !refresh.disabled && board?.getAttribute("aria-busy") === "false");\n` +
`    });\n` +
`    ${TAG_END}\n\n`;
  section = section.replace(initialAnchor, isolate + initialAnchor);
  section = section.replace(
    '    await page.unrouteAll({ behavior: "wait" });\n  });\n\n',
    '    await page.unrouteAll({ behavior: "wait" });\n' +
    '    // Restore Socket.IO after the controlled REST failure/recovery scenario.\n' +
    '    await page.evaluate(() => {\n' +
    '      window.TaskRealtime?.start();\n' +
    '      window.TaskRealtime?.setProject(document.getElementById("task-project-select")?.value);\n' +
    '    });\n' +
    '  });\n\n'
  );
  content = prefix + section + suffix;
  if (!content.includes(TAG_BEGIN) || !content.includes(TAG_END)) throw new Error("修正內容檢查失敗。");
  if (mode === "--dry-run") {
    console.log(`[預覽] ${target} 將新增 Socket.IO 測試隔離與還原，不會修改正式功能。`);
    process.exit(0);
  }
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9C2-retry-"));
  const backup = path.join(backupDir, "task-ux.e2e.js.bak");
  fs.copyFileSync(target, backup);
  fs.writeFileSync(target, content.replace(/\n/g, eol), "utf8");
  console.log(`[已更新] ${target}`);
  console.log(`原始檔備份：${backup}`);
  console.log("下一步：node --check .\\e2e\\task-ux.e2e.js");
} catch (err) {
  console.error(`安全中止：${err.message}`);
  process.exitCode = 1;
}
