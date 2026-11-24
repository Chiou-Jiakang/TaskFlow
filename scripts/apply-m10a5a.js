"use strict";

// TaskFlow M10-A5a: additive CSP directives and browser Permissions-Policy.
// Supported modes: --dry-run (default), --apply, --verify.
// No database operations, no dependency installations, no Git actions.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repo = path.resolve(__dirname, "..");
const target = path.join(repo, "server", "server.js");
const anchor = '    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");';
const start = "    // TASKFLOW-M10A5A-HEADERS-BEGIN";
const end = "    // TASKFLOW-M10A5A-HEADERS-END";
const block = [
  start,
  "    // 只限制不影響現有外部 JS/CSS 與 Socket.IO 的 CSP 指令。",
  "    // script-src / connect-src 將在相容性驗收後獨立強化。",
  '    res.setHeader("Content-Security-Policy", "base-uri \'self\'; object-src \'none\'; frame-ancestors \'none\'; form-action \'self\'");',
  '    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");',
  end,
].join("\n");

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function abort(message) {
  console.error(`M10-A5a 安全中止：${message}`);
  process.exitCode = 1;
}

function main() {
  const mode = process.argv[2] || "--dry-run";
  if (!["--dry-run", "--apply", "--verify"].includes(mode) || process.argv.length > 3) {
    return abort("只接受 --dry-run、--apply 或 --verify。未修改檔案。");
  }
  if (!fs.existsSync(target)) return abort(`找不到 ${target}。未修改檔案。`);
  const raw = fs.readFileSync(target);
  const bom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const source = raw.toString("utf8").replace(/^\uFEFF/, "");
  const crlf = source.includes("\r\n");
  const normalized = source.replace(/\r\n/g, "\n");
  const present = normalized.includes(start) || normalized.includes(end);
  const validInstalled = count(normalized, start) === 1 &&
    count(normalized, end) === 1 && normalized.includes(block) &&
    count(normalized, 'res.setHeader("Content-Security-Policy"') === 1 &&
    count(normalized, 'res.setHeader("Permissions-Policy"') === 1;

  if (present) {
    if (!validInstalled) return abort("找到不完整或遭修改的 M10-A5a 標記；請人工檢查，不會覆蓋。");
    if (mode === "--verify") console.log("[驗證通過] M10-A5a 標頭區段正確，且各出現一次。");
    else console.log("[已存在，跳過] M10-A5a 標頭已安裝，沒有更動檔案。");
    return;
  }

  if (mode === "--verify") return abort("尚未套用 M10-A5a；請先預覽並 --apply。");
  if (count(normalized, anchor) !== 1 ||
      !normalized.includes('  app.disable("x-powered-by");') ||
      !normalized.includes('res.setHeader("X-Frame-Options", "DENY");')) {
    return abort("server.js 與預期版本不同，找不到唯一且完整的安全標頭錨點。未修改檔案。");
  }
  if (normalized.includes('"Content-Security-Policy"') || normalized.includes('"Permissions-Policy"')) {
    return abort("已有其他 CSP 或 Permissions-Policy 設定，避免重複覆蓋。未修改檔案。");
  }
  if (mode === "--dry-run") {
    console.log("[預覽] server/server.js：將新增 CSP 基礎指令及 Permissions-Policy。");
    console.log("不修改既有 JS/CSS 載入、Socket.IO、Session、CSRF、SQLite 或 Git。");
    console.log("Dry run 完成；未寫入檔案。");
    return;
  }
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M10A5a-"));
  const backup = path.join(backupDir, "server.js.bak");
  fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
  const next = normalized.replace(anchor, `${anchor}\n${block}`);
  const out = (bom ? "\uFEFF" : "") + (crlf ? next.replace(/\n/g, "\r\n") : next);
  fs.writeFileSync(target, out, "utf8");
  console.log("[已更新] server/server.js");
  console.log(`備份位置：${backup}`);
  console.log("下一步：node --check .\\server\\server.js；node .\\scripts\\apply-m10a5a.js --verify");
  console.log("尚未執行 Git Commit／Push，也未觸碰 SQLite。");
}
main();
