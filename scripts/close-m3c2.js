"use strict";

// TaskFlow M3-C2 結案工具
// 驗證測試、累積更新文件，不自動 Commit / Push。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const day = "2026-11-16";

function checkFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`缺少檔案：${rel}`);
  }
}

[
  "e2e/auth-flow.e2e.js",
  "public/auth.html",
  "public/dashboard-auth.js",
  "package.json",
  "package-lock.json",
].forEach(checkFile);

function runTests(name, args, expected) {
  console.log(`正在驗證：${name}`);

  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 150000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const output = `${run.stdout || ""}\n${run.stderr || ""}`;

  const read = (word) => {
    const regex = new RegExp(`(?:^|\\s)${word}\\s+\\d+\\s*$`);

    const line = output.split(/\r?\n/).findLast((s) => regex.test(s));

    return line ? Number(line.match(/(\d+)\s*$/)[1]) : NaN;
  };

  const tests = read("tests");
  const passed = read("pass");
  const failed = read("fail");

  if (
    run.error ||
    run.status !== 0 ||
    tests !== expected ||
    passed !== expected ||
    failed !== 0
  ) {
    console.error(output.slice(-5000));
    throw new Error(`${name} 未達預期`);
  }

  console.log(`${name}：${passed}/${tests} PASS，0 FAIL`);
}

// 先重新執行測試，失敗時不修改文件。
runTests("既有回歸測試", ["--test"], 59);

runTests("Microsoft Edge E2E", ["--test", "e2e/auth-flow.e2e.js"], 8);

// 六份文件的本次新增紀錄。
const sections = [
  {
    file: "README.md",
    heading: `## M3-C2｜Edge 瀏覽器端對端驗收（${day}）`,
    text: [
      "- 使用 `playwright-core` 操作已安裝的 Microsoft Edge。",
      "- `npm run test:e2e`：8/8 PASS（七個子測試及一個父測試）。",
      "- `npm test`：59/59 PASS，0 failed。",
      "- E2E 涵蓋匿名跳轉、註冊、登入、Cookie、Session 隔離、專案建立、重新整理及登出。",
      "- 測試使用獨立記憶體 SQLite 與隨機 Port。",
      "- 不會清除正式 `data/taskflow.db`。",
      "- 正式 HTTPS、其他瀏覽器及部署級安全驗收仍待完成。",
      "- M3-C2 GitHub 提交狀態以 Git 實際紀錄為準。",
    ],
  },
  {
    file: "CHANGELOG.md",
    heading: `### M3-C2 — ${day}｜Edge Browser E2E`,
    text: [
      "#### Added",
      "- 新增 `playwright-core` 開發相依。",
      "- 新增 `test:e2e` npm script。",
      "- 新增 `e2e/auth-flow.e2e.js`。",
      "- 建立 Microsoft Edge 真實瀏覽器驗收流程。",
      "",
      "#### Verified",
      "- E2E：8/8 PASS。",
      "- Node.js Regression：59/59 PASS。",
      "- 兩組測試皆 0 failed。",
      "- 測試資料庫與正式 SQLite 隔離。",
      "",
      "#### Remaining",
      "- 正式 HTTPS、跨瀏覽器及部署安全驗證。",
      "- 完整多人協作、RBAC 與任務 CRUD。",
    ],
  },
  {
    file: "docs/ARCHITECTURE.md",
    heading: `## M3-C2｜瀏覽器 E2E 測試架構（${day}）`,
    text: [
      "### Testing Architecture",
      "- Browser：Microsoft Edge，透過 Playwright Core 啟動。",
      "- Runner：Node.js 內建 Test Runner。",
      "- Entry：`e2e/auth-flow.e2e.js`。",
      "- Command：`npm run test:e2e`。",
      "",
      "### Isolation",
      "- 使用 `createApp({ database: db })` 啟動獨立 Express。",
      '- 使用 `openDatabase(":memory:")` 建立隔離 SQLite。',
      "- 使用系統分配 Port，避免占用 3000。",
      "- 以不同 BrowserContext 驗證 Session 隔離。",
      "- 測試結束後關閉 Browser、Server 與 Database。",
      "",
      "### Security Boundary",
      "- HttpOnly Session Cookie 由瀏覽器管理。",
      "- 後端負責驗證身分、CSRF 與專案權限。",
      "- 前端導向登入頁不等於後端授權驗證。",
      "- M3-C2 已通過 8/8 E2E，尚非正式部署安全稽核。",
    ],
  },
  {
    file: "docs/DEVELOPMENT_LOG.md",
    heading: `## ${day}｜M3-C2 真實瀏覽器端對端驗收`,
    text: [
      "### 一、開發內容",
      "1. 安裝 Playwright Core。",
      "2. 設定 `test:e2e` npm script。",
      "3. 新增 `e2e/auth-flow.e2e.js`。",
      "4. 建立 Edge 自動化瀏覽器測試。",
      "5. 採用隔離 SQLite、隨機 Port 與 BrowserContext。",
      "",
      "### 二、測試結果",
      "- Edge E2E：8/8 PASS。",
      "- Node.js Regression：59/59 PASS。",
      "- Failed：0。",
      "- Skipped：0。",
      "",
      "### 三、問題紀錄",
      "- 曾發生 Port 3000 重複占用。",
      "- 新測試改用隨機 Port，避免干擾開發 Server。",
      "- Git 曾顯示 LF/CRLF 警告，非測試錯誤。",
      "",
      "### 四、版本管理",
      "- M3-C1 已於 Commit `32361a6` 同步 GitHub。",
      "- 本次 M3-C2 Commit／Push 需依實際 Git 結果確認。",
      "",
      "### 五、後續工作",
      "- 完成 M3-C2 GitHub 同步與 SHA 驗證。",
      "- 進入 M4 成員管理及 RBAC 權限開發。",
    ],
  },
  {
    file: "docs/PROJECT_PLAN.md",
    heading: `## M3-C2｜正式 E2E 驗收結果（${day}）`,
    text: [
      "### 已完成",
      "- M3-C1：前端 Authentication。",
      "- M3-C1 GitHub Commit：`32361a6`。",
      "- M3-C2 Microsoft Edge E2E：8/8 PASS。",
      "- M1～M3-C1 Regression：59/59 PASS。",
      "- 真實瀏覽器登入、Session、專案建立及登出驗證。",
      "",
      "### 版本控制",
      "- M3-C2 將於功能驗收後集中 Commit／Push。",
      "- GitHub 最終狀態以同步後 SHA 檢查為準。",
      "",
      "### 下一階段：M4",
      "- 專案成員邀請。",
      "- 成員列表及角色管理。",
      "- Owner、Admin、Member 權限矩陣。",
      "- 成員管理 API 與權限自動化測試。",
      "",
      "### 後續限制",
      "- 正式 HTTPS、其他瀏覽器、即時同步及部署驗收尚未完成。",
    ],
  },
  {
    file: "docs/TESTING.md",
    heading: `## M3-C2｜Microsoft Edge E2E（${day}）`,
    text: [
      "### 測試結果",
      "- `npm run test:e2e`：8/8 PASS。",
      "- `npm test`：59/59 PASS。",
      "- Failed：0。",
      "- Skipped：0。",
      "",
      "### 測試範圍",
      "- 匿名使用者導向登入頁。",
      "- 註冊表單正常送出。",
      "- 錯誤密碼拒絕、正確密碼登入。",
      "- HttpOnly Cookie 驗證。",
      "- 不同 BrowserContext 的 Session 隔離。",
      "- 專案建立與重新整理後保留。",
      "- 登出後私人專案 API 回應 401。",
      "- 已測試流程無未處理 JavaScript Page Error。",
      "",
      "### 測試環境",
      "- Microsoft Edge headless。",
      "- Node.js Test Runner。",
      "- SQLite in-memory database。",
      "- 隨機 HTTP Port。",
      "",
      "### 尚未驗證",
      "- 正式 HTTPS。",
      "- Edge 以外的其他瀏覽器。",
      "- 完整部署安全性。",
      "- 多人即時同步。",
      "",
      "### 結論",
      "M3-C2 既定瀏覽器測試 8/8 PASS。",
      "既有回歸測試 59/59 PASS。",
      "以上結果僅代表已執行的測試範圍。",
    ],
  },
];

// 檢查所有文件，先在記憶體中準備更新內容。
const changes = [];

for (const entry of sections) {
  checkFile(entry.file);

  const full = path.join(root, entry.file);
  const original = fs.readFileSync(full, "utf8");

  // 避免重複執行時再次追加同一段紀錄。
  if (original.includes(entry.heading)) {
    console.log(`略過已更新：${entry.file}`);
    continue;
  }

  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let content = original.replace(/\r\n/g, "\n").replace(/\s*$/, "");

  // 修正 README 的目前狀態，保留其他歷史內容。
  if (entry.file === "README.md") {
    content = content.replace(
      "- M3-C1：前端登入與註冊、Dashboard Session 串接已完成；M3-C2 待進行。",
      "- M3-C1：前端 Authentication 已完成，Commit `32361a6` 已同步。\n- M3-C2：Edge E2E 8/8 PASS；既有回歸測試 59/59 PASS。",
    );

    content = content.replace(
      "目前仍屬開發階段：後端註冊／登入／登出 API 已完成，前端登入介面、真正的多人協作與即時同步尚未完成。",
      "目前仍屬開發階段：帳號驗證、前端登入及 SQLite 專案建立已完成；完整 RBAC、任務管理與多人同步仍待實作。",
    );

    content = content.replace(
      "- 本階段 Git Commit／Push 待完成。",
      "- M3-C1 已於 Commit `32361a6` 完成 GitHub 同步。",
    );

    content = content.replace(
      "- 正式 HTTPS、跨瀏覽器及 E2E 自動化仍待驗證。",
      "- M3-C2 已通過 Edge E2E；正式 HTTPS、其他瀏覽器與部署安全仍待驗證。",
    );
  }

  // 修正 PROJECT_PLAN 的最新進度。
  if (entry.file === "docs/PROJECT_PLAN.md") {
    content = content.replace(
      /^\| M3\s*\|[^\n]*$/m,
      "| M3   | 使用者註冊與登入 | M3-C2 E2E 8/8 PASS；M4 未開始 |",
    );

    content = content.replace(
      "### 正在處理\n\n- M3-C1：驗收通過，待文件與 GitHub 同步",
      "### 最近驗收\n\n- M3-C1：已於 Commit `32361a6` 同步 GitHub。\n- M3-C2：Edge E2E 8/8、既有回歸 59/59 PASS。",
    );

    content = content.replace(
      "### 下一階段\n\nM3-C：前端註冊、登入、登出與 Session 整合。",
      "### 下一階段\n\nM4：專案成員管理與 RBAC 權限開發。",
    );

    content = content.replace(
      "### 尚待完成\n\n- 本次 Git Commit、Push 與 SHA 比對。",
      "### M3-C1 版本管理\n\n- GitHub Commit `32361a6` 已同步，SHA 比對一致。\n\n### 尚待完成",
    );

    content = content.replace(
      "- 正式 HTTPS、跨瀏覽器及瀏覽器 E2E 自動化測試。",
      "- 正式 HTTPS、其他瀏覽器及部署級安全驗收。",
    );
  }

  const added = [entry.heading, "", ...entry.text].join("\n");

  if (entry.file === "CHANGELOG.md") {
    const marker = "## [Unreleased]";

    if (!content.includes(marker)) {
      throw new Error("CHANGELOG 找不到 Unreleased 區段");
    }

    // 最新變更放在 Unreleased 最上方。
    content = content.replace(marker, `${marker}\n\n${added}`);
  } else {
    // 開發日誌等文件採追加方式，不刪除歷史。
    content += `\n\n${added}`;
  }

  content = content.replace(/\n/g, eol) + eol;

  changes.push({
    full,
    file: entry.file,
    content,
  });
}

// 所有文件都檢查後，才開始寫入。
for (const change of changes) {
  fs.writeFileSync(change.full, change.content, "utf8");

  console.log(`已更新：${change.file}`);
}

console.log(`完成：${changes.length} 份文件更新。`);
console.log("尚未 Git Commit／Push。");
console.log("請先執行 Git Diff 檢查。");
