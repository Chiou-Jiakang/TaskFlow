"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const root = process.cwd();
const target = path.join(root, "server", "auth-routes.js");
const marker = "// TASKFLOW-M10A5B1-BEGIN";
const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--verify") ? "verify" : "dry-run";

function replaceOnce(source, oldText, newText, description) {
  const index = source.indexOf(oldText);
  if (index < 0 || source.indexOf(oldText, index + oldText.length) !== -1) {
    throw new Error(`無法唯一定位 ${description}；停止，不覆蓋檔案`);
  }
  return source.slice(0, index) + newText + source.slice(index + oldText.length);
}

function patch(source) {
  if (source.includes(marker)) return source;
  let code = source;
  code = replaceOnce(code,
    'const WINDOW = 15 * 60 * 1000;',
    '// TASKFLOW-M10A5B1-BEGIN\nconst { createAbuseGuard, createSessionSweeper } = require("./auth-abuse-guard");\n// TASKFLOW-M10A5B1-END',
    "安全工具匯入");
  code = replaceOnce(code,
    '  // 本機 MVP 的基本登入失敗計數\n  const failures = new Map();',
    '  const abuse = createAbuseGuard();\n  const sweepExpiredSessions = createSessionSweeper(() => repo.pruneExpiredSessions());\n  // 啟動時清除過期 Session；不修改未過期 Session。\n  sweepExpiredSessions(true);',
    "原有登入限制狀態");
  code = replaceOnce(code,
    '  function session(req) {\n    if (req.taskflowSession !== undefined) {',
    '  function session(req) {\n    sweepExpiredSessions();\n    if (req.taskflowSession !== undefined) {',
    "Session 查詢");
  code = replaceOnce(code,
    '    exactFields(req.body, ["email", "password", "displayName"]);\n\n    const user = await repo.register(req.body);',
    '    exactFields(req.body, ["email", "password", "displayName"]);\n\n    if (!abuse.allowRegistration(req.ip || req.socket.remoteAddress || "unknown")) {\n      return res.status(429).json({\n        error: "TOO_MANY_ATTEMPTS",\n        message: "註冊嘗試過多，請稍後再試。",\n      });\n    }\n\n    const user = await repo.register(req.body);',
    "註冊防濫用");
  const start = '    const key = req.ip || req.socket.remoteAddress || "unknown";';
  const end = '    if (!user) {';
  const a = code.indexOf(start), b = code.indexOf(end, a);
  if (a < 0 || b < 0 || code.indexOf(start, a + 1) !== -1) {
    throw new Error("登入處理錨點不匹配；停止，不覆蓋檔案");
  }
  code = code.slice(0, a) +
    '    const key = req.ip || req.socket.remoteAddress || "unknown";\n' +
    '    const attempt = abuse.beginLogin(key);\n' +
    '    if (!attempt) {\n' +
    '      return res.status(429).json({\n' +
    '        error: "TOO_MANY_ATTEMPTS",\n' +
    '        message: "登入嘗試過多，請稍後再試。",\n' +
    '      });\n' +
    '    }\n\n' +
    '    let user;\n' +
    '    try {\n' +
    '      user = await repo.authenticate(req.body);\n' +
    '    } catch (err) {\n' +
    '      attempt.cancel();\n' +
    '      throw err;\n' +
    '    }\n\n' + code.slice(b);
  const failureStart = '    if (!user) {\n      const latest = failures.get(key);\n\n      failures.set(key, {\n        count: (latest?.count ?? 0) + 1,\n        until: latest?.until ?? time + WINDOW,\n      });';
  code = replaceOnce(code, failureStart,
    '    if (!user) {\n      attempt.failure();',
    "失敗登入計數");
  code = replaceOnce(code,
    '    // 成功登入後清除失敗計數\n    failures.delete(key);',
    '    // 成功登入後清除失敗計數\n    attempt.success();',
    "成功登入計數重置");
  return code;
}

if (!fs.existsSync(target)) throw new Error("請在 C:\\Projects\\TaskFlow 專案根目錄執行");
const original = fs.readFileSync(target);
const lineEnding = original.includes(Buffer.from("\r\n")) ? "\r\n" : "\n";
const text = original.toString("utf8").replace(/\r\n/g, "\n");
const proposed = patch(text);
if (mode === "verify") {
  if (!text.includes(marker)) throw new Error("M10-A5b-1 尚未套用");
  if (text !== proposed) throw new Error("M10-A5b-1 內容不一致");
  console.log("[PASS] M10-A5b-1 錨點存在；整合檔案未被再次修改");
} else if (mode === "dry-run") {
  console.log(text === proposed ? "[SKIP] 已套用，無須修改" : "[PREVIEW] 將更新 server/auth-routes.js；尚未寫入");
} else if (text === proposed) {
  console.log("[SKIP] 已套用，無須修改");
} else {
  // Use a temp backup outside the repository; preserve original bytes.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M10A5b1-"));
  const backup = path.join(directory, "auth-routes.js.bak");
  fs.writeFileSync(backup, original);
  fs.writeFileSync(target, lineEnding === "\r\n" ? proposed.replace(/\n/g, "\r\n") : proposed);
  console.log(`[UPDATED] server/auth-routes.js\n[BACKUP] ${backup}`);
  console.log("下一步：node --check .\\server\\auth-routes.js");
}
