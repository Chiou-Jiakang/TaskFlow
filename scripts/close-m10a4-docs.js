#!/usr/bin/env node
"use strict";

// TaskFlow M10-A4: safely append an incremental snapshot to six Markdown files.
// Usage: node scripts/close-m10a4-docs.js [--dry-run | --apply | --verify]
// - dry-run is the default and does not write files
// - apply backs up originals and only inserts absent sections
// - verify compares the exact inserted sections and does not write files

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PROJECT = path.resolve(__dirname, "..");
const DATE = "2026-11-24";
const ID = `TASKFLOW-M10A4-DOCS-${DATE}`;
const START = `<!-- ${ID} -->`;
const END = `<!-- /${ID} -->`;
const FILES = [
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md",
  "docs/PROJECT_PLAN.md",
  "docs/TESTING.md",
];

const BLOCKS = {
  "README.md": `## 最新產品化進度｜M10-A4 HTTP 安全標頭（${DATE}）

> 此節為 M10-A4 的本機驗收快照。以下更早里程碑段落保留為歷史紀錄；TaskFlow **v1.0.0 尚未發布**。

- **後端變更：** 在 \`server/server.js\` 的 Express Middleware 新增 \`X-Content-Type-Options: nosniff\`、\`X-Frame-Options: DENY\`、\`Referrer-Policy: strict-origin-when-cross-origin\`；\`/api\` 與 \`/api/*\` 回應加上 \`Cache-Control: no-store\`。
- **HTTP 實測：** 首頁回傳 200；未登入的 \`/api/projects\` 回傳 401，並確認 API 回應具有三項安全標頭及 \`Cache-Control: no-store\`。首頁沿用原本的靜態資產快取行為。
- **測試：** 新增 \`tests/security-headers.test.js\`，專項 4/4 PASS；更新 \`package.json\` 的 \`npm test\` 為 \`node --test --test-concurrency=1\`，使用者本機完整 Node 回歸 331/331 PASS，fail／skipped／cancelled 均 0。
- **限制：** 原本並行模式曾出現測試檔案層級失敗；循序執行可通過，但**尚未定位並行失敗根因**，不可宣稱已修復並行相容性問題。
- **發布門檻：** CSP／Socket.IO 相容性、部署環境、HTTPS／HSTS、登入防濫用、備份與還原，以及 M9-C3 已暫緩的行動版／無障礙驗證仍未完成。此節不是 production-ready 宣告。
- **Git 狀態：** 本節建立時尚未執行 M10-A4 Commit／Push；以後續實際 Git 輸出為準。

---`,

  "CHANGELOG.md": `### M10-A4 — ${DATE}｜HTTP Security Headers & Test Stability

#### Added

- \`server/server.js\`：新增 \`X-Content-Type-Options: nosniff\`、\`X-Frame-Options: DENY\`、\`Referrer-Policy: strict-origin-when-cross-origin\`。
- \`/api\` 及其子路徑回應新增 \`Cache-Control: no-store\`，降低 API 回應被快取的風險。
- \`tests/security-headers.test.js\`：驗證首頁基本標頭、健康檢查 API 防快取及未知 API 的 404／防快取；專項 **4/4 PASS**。

#### Changed / Verified

- \`package.json\` 的 \`scripts.test\` 改為 \`node --test --test-concurrency=1\`；本機 \`npm test\` **331/331 PASS**（0 fail／skipped／cancelled）。
- HTTP 實測確認首頁 200、未登入 \`/api/projects\` 401；API 防快取與安全標頭生效。
- 舊的並行執行曾出現測試檔層級失敗；目前採循序執行穩定化，**尚未證實或修正並行失敗根因**。

#### Unreleased / Remaining

- 尚未完成 CSP／Socket.IO 相容性、HTTPS／HSTS、登入防濫用、資料庫備份／復原與部署驗收；M9-C3 響應式／無障礙仍為 Deferred / Not Verified。
- 本段新增時 M10-A4 Git Commit／Push 尚待進行，\`v1.0.0\` 尚未發布。

---`,

  "docs/ARCHITECTURE.md": `## M10-A4｜Express HTTP 安全標頭 Middleware（${DATE}）

> 在既有 TaskFlow Express 應用中增加回應標頭，不改動 Session、CSRF、RBAC、Socket.IO 或 SQLite 業務資料流。

- **全站回應：** \`X-Content-Type-Options: nosniff\` 降低 MIME 嗅探；\`X-Frame-Options: DENY\` 拒絕被嵌入 frame；\`Referrer-Policy: strict-origin-when-cross-origin\` 限制跨來源 Referrer 資訊。
- **API 回應：** 路徑為 \`/api\` 或以 \`/api/\` 開頭時設 \`Cache-Control: no-store\`，包含未登入的 401 與其他 API 狀態回應；首頁靜態資產快取策略不在本階段調整。
- **元件位置：** 共用 Middleware 在 \`server/server.js\` 的 \`createApp()\` 中註冊；在路由處理前執行，不依賴外部安全標頭套件。
- **測試方法：** \`tests/security-headers.test.js\` 使用 \`createApp()\` 建立臨時 HTTP 伺服器及隨機 Port，檢查回應標頭，不需初始化正式 SQLite。
- **尚未覆蓋：** CSP（含 Socket.IO \`connect-src\`）、HTTPS／HSTS、正式部署代理設定、登入速率限制、完整威脅模型與公開服務的滲透測試。上述內容仍屬 M10 待辦，不應由這三項標頭推論整站已達正式部署安全要求。

---`,

  "docs/DEVELOPMENT_LOG.md": `## M10-A4｜HTTP 安全標頭與測試環境穩定化（${DATE}）

### 實作與問題排查

- 在 \`server/server.js\` 的 Express Middleware 新增三項基礎安全標頭，並對 \`/api\` 路徑設定 \`Cache-Control: no-store\`，未更動其他業務 API 或 SQLite Schema。
- 一度遇到 \`EADDRINUSE\`：Port 3000 上已有 \`node server/server.js\` 程序，導致新版服務未成功啟動。辨識並停止舊程序後重新啟動，新版 HTTP 標頭由 \`curl.exe\` 驗證正常。
- \`tests/security-headers.test.js\` 首次只有檔案層級 PASS，之後改為具備三個子測試及外層測試的真正專項驗收，結果 4/4 PASS。
- 原始 \`npm test\` 並行執行出現 328 tests／327 pass／1 fail（失敗定位於安全標頭測試檔案層級）；使用 \`node --test --test-concurrency=1\` 得 331/331 PASS；將此執行模式寫入 \`package.json\`，正式 \`npm test\` 再次 331/331 PASS。

### 工程判定與限制

- **已驗證：** 三項安全標頭、API \`no-store\`、未登入 401、專項 4/4 PASS、循序 Node 331/331 PASS。
- **未證實：** 並行測試失敗的根本原因；不把循序成功誤寫成已修復並行相容性。
- **未執行：** 此輪完整 Microsoft Edge E2E、HTTPS／CSP、登入防濫用及備份還原驗收。M9-C3 行動版／無障礙維持 Deferred / Not Verified。
- **接續：** 完成六份文件增量更新、精確 Git 暫存／Commit／Push 後，進行剩餘安全檢查和 M10-B～D 發布準備。\`v1.0.0\` 尚未正式 Release。

---`,

  "docs/PROJECT_PLAN.md": `## M10-A4｜安全標頭階段結案進度（${DATE}）

> 本區僅更新 M10-A4 目前確認的工程結果；下方舊表格是歷史狀態快照。

| 項目 | 目前狀態 | 依據／後續 |
| --- | --- | --- |
| HTTP 基礎安全標頭 | **已驗證** | \`nosniff\`、\`DENY\`、\`Referrer-Policy\` 已於 HTTP 回應確認 |
| API \`Cache-Control: no-store\` | **已驗證** | 未登入 API 401 與 API 防快取回應正常 |
| 安全標頭專項測試 | **4/4 PASS** | \`tests/security-headers.test.js\` |
| Node 回歸（循序） | **331/331 PASS** | \`npm test\` 已設 \`--test-concurrency=1\`；0 fail／skipped／cancelled |
| 並行測試根因 | **Unresolved** | 並行執行曾有檔案層級失敗；改循序只是穩定化策略 |
| M10-A4 文件與 Git | **待本次結案** | 六份增量文件、staged diff、Commit／Push、SHA 核對 |
| M10 其他安全項目 | **Not Verified** | CSP／Socket.IO、HTTPS／HSTS、登入防濫用等 |
| M10-B～D | **尚未結案** | 備份還原、部署驗收、\`v1.0.0\` Release |

### M10-A4 結案檢核

- [x] 本機 HTTP 標頭驗證通過。
- [x] 安全標頭專項 4/4 PASS；循序 Node 331/331 PASS。
- [x] \`package.json\` 以 \`node --test --test-concurrency=1\` 作為目前測試策略。
- [ ] 六份文件完成增量更新，工具 \`--verify\` 與重跑 \`--dry-run\` 通過。
- [ ] 精準暫存程式、測試、文件與結案腳本，排除暫存 TXT、SQLite／金鑰。
- [ ] 審核 staged 差異，Commit／Push 並比對本機 HEAD 和遠端完整 SHA。

> 本文件**不預先勾選**尚未實際發生的 Git 操作；也不宣稱已完成 M10 全部安全驗收或正式 Release。

---`,

  "docs/TESTING.md": `## M10-A4｜HTTP 安全標頭與 Node 回歸（${DATE}）

> 本節依 2026-11-23～24 使用者本機終端截圖記錄；下方歷史測試結果保留不更動。測試通過率不等於程式碼覆蓋率，也不是全面安全保證。

| 測試或實測 | 結果 | 備註 |
| --- | --- | --- |
| \`node --check server/server.js\` | **PASS** | JS 語法通過 |
| \`node --test tests/security-headers.test.js\` | **4/4 PASS** | 三個具體案例與外層測試；0 fail |
| 首頁 \`GET /\` | **200** | 已見安全標頭；首頁不套用 API \`no-store\` 規則 |
| 匿名 \`GET /api/projects\` | **401** | \`nosniff\`、\`DENY\`、Referrer-Policy、\`Cache-Control: no-store\` |
| 原始並行 \`npm test\` | **328 total／327 pass／1 fail** | 安全標頭測試檔案層級失敗；尚未定位根因 |
| \`node --test --test-concurrency=1\` | **331/331 PASS** | 0 fail、0 skipped、0 cancelled |
| 更新後正式 \`npm test\` | **331/331 PASS** | 以 package.json 設定的循序方式執行 |
| M10-A4 全部 Edge E2E | **Not Re-run** | 前一輪 M9-C2 Edge 110/110 屬歷史快照，不是本輪執行 |

### 可重現指令（Windows PowerShell）

\`\`\`powershell
node --check .\\server\\server.js
node --test .\\tests\\security-headers.test.js
npm test
curl.exe -sS -D - -o NUL http://127.0.0.1:3000/
curl.exe -sS -D - -o NUL http://127.0.0.1:3000/api/projects
\`\`\`

### 尚未解除的驗證風險

- 並行測試不穩定原因未定位；循序測試通過不證明可安全恢復平行執行。
- CSP／Socket.IO 相容性、公開 HTTPS／HSTS、登入防濫用、備份／還原及正式部署未於 M10-A4 驗收。
- M9-C3 響應式、鍵盤與無障礙仍標示 **Deferred / Not Verified**。

---`,
};

function die(message) {
  console.error(`[ERROR] ${message}`);
  process.exitCode = 1;
}

function eolOf(source) {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function normalizeEol(s, eol) {
  return s.replace(/\r?\n/g, "\n").replace(/\n/g, eol);
}

function ensureLayout() {
  const pkgFile = path.join(PROJECT, "package.json");
  const serverFile = path.join(PROJECT, "server", "server.js");
  const testFile = path.join(PROJECT, "tests", "security-headers.test.js");
  for (const p of [pkgFile, serverFile, testFile, ...FILES.map(f => path.join(PROJECT, f))]) {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
      throw new Error(`必要檔案不存在：${p}`);
    }
  }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  if (pkg.name !== "taskflow") throw new Error("目前目錄不是預期的 TaskFlow 專案。");
  if (pkg.scripts?.test !== "node --test --test-concurrency=1") {
    throw new Error("package.json 尚未設定循序 npm test；請先完成前一階段。");
  }
  const serverText = fs.readFileSync(serverFile, "utf8");
  for (const expected of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "no-store"]) {
    if (!serverText.includes(expected)) throw new Error(`server.js 缺少 ${expected}，拒絕宣稱 M10-A4 已完成。`);
  }
  const testText = fs.readFileSync(testFile, "utf8");
  if (!/\btest\s*\(/.test(testText) || !testText.includes("M10-A4")) {
    throw new Error("安全標頭測試檔案似乎沒有註冊 M10-A4 測試。");
  }
}

function readPlan(file) {
  const full = path.join(PROJECT, file);
  const original = fs.readFileSync(full);
  const withBom = original[0] === 0xef && original[1] === 0xbb && original[2] === 0xbf;
  const text = original.toString("utf8");
  const clean = withBom ? text.slice(1) : text;
  const eol = eolOf(clean);
  const hasStart = clean.includes(START);
  const hasEnd = clean.includes(END);
  if (hasStart !== hasEnd) throw new Error(`${file} 的 M10-A4 標記不完整，拒絕覆寫。`);
  if (clean.split(START).length !== (hasStart ? 2 : 1) || clean.split(END).length !== (hasEnd ? 2 : 1)) {
    throw new Error(`${file} 的 M10-A4 標記重複，拒絕覆寫。`);
  }
  const expected = normalizeEol(`${START}\n\n${BLOCKS[file]}\n\n${END}`, eol);
  if (hasStart) {
    const startAt = clean.indexOf(START);
    const endAt = clean.indexOf(END) + END.length;
    const existing = clean.slice(startAt, endAt);
    if (existing !== expected) throw new Error(`${file} 已有 M10-A4 標記，但內容和預期不同；拒絕自動覆寫。`);
    return { file, full, original, next: null, action: "已存在，跳過" };
  }
  const header = /^# [^\r\n]+\r?\n/.exec(clean);
  if (!header) throw new Error(`${file} 缺少預期的頂層 # 標題，拒絕修改。`);
  let insertAt;
  if (file === "CHANGELOG.md") {
    const unreleased = /^## \[Unreleased\]\r?\n/m.exec(clean);
    if (!unreleased) throw new Error("CHANGELOG.md 缺少 [Unreleased] 標題，拒絕修改。");
    insertAt = unreleased.index + unreleased[0].length;
  } else {
    insertAt = header[0].length;
  }
  const snippet = `${eol}${expected}${eol}${eol}`;
  const nextClean = clean.slice(0, insertAt) + snippet + clean.slice(insertAt);
  const next = Buffer.from(`${withBom ? "\ufeff" : ""}${nextClean}`, "utf8");
  return { file, full, original, next, action: "需增量更新" };
}

function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--dry-run", "--apply", "--verify"]);
  if (args.some(a => !allowed.has(a)) || args.length > 1) {
    throw new Error("用法：node scripts/close-m10a4-docs.js [--dry-run | --apply | --verify]");
  }
  const mode = args[0] || "--dry-run";
  ensureLayout();
  // Preflight every file BEFORE making any changes.
  const plans = FILES.map(readPlan);
  if (mode === "--verify") {
    if (plans.some(p => p.next !== null)) {
      throw new Error("至少一份文件尚未加入 M10-A4 紀錄，無法通過 --verify。");
    }
    plans.forEach(p => console.log(`[已核對] ${p.file}`));
    console.log("M10-A4 六份文件標記與內容驗證通過；沒有寫入檔案。");
    return;
  }
  if (mode === "--dry-run") {
    plans.forEach(p => console.log(`[預覽] ${p.file}: ${p.action}`));
    console.log("Dry run 完成；沒有寫入檔案。");
    return;
  }
  const pending = plans.filter(p => p.next !== null);
  if (pending.length === 0) {
    console.log("M10-A4 六份文件已存在完整紀錄；跳過，無檔案改動。");
    return;
  }
  const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M10A4-docs-"));
  const written = [];
  try {
    // Keep all six original documents, even those previously updated.
    for (const p of plans) {
      const destination = path.join(backupDir, p.file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(p.full, destination);
    }
    for (const p of pending) {
      fs.writeFileSync(p.full, p.next);
      written.push(p);
      console.log(`[已更新] ${p.file}`);
    }
  } catch (error) {
    for (const p of written) fs.writeFileSync(p.full, p.original);
    throw new Error(`套用過程失敗，已嘗試復原已寫入檔案：${error.message}`);
  }
  console.log(`原始六份文件備份：${backupDir}`);
  console.log(`M10-A4 文件新增完成（本次寫入 ${pending.length} 份）；尚未 Git Commit／Push。`);
}

try {
  main();
} catch (error) {
  die(error.message);
}
