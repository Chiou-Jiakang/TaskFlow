"use strict";

// TaskFlow M3-C1：集中更新六份核心文件。
// 執行測試失敗時不修改文件。
// 不自動執行 Git Commit 或 Push。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = process.cwd();
const date = "2026-11-16";

const required = [
  "public/auth.html",
  "public/auth.css",
  "public/auth.js",
  "public/dashboard-auth.js",
  "public/index.html",
  "tests/frontend-auth.test.js",
];

for (const name of required) {
  if (!fs.existsSync(path.join(root, name))) {
    console.error(`缺少檔案：${name}`);
    process.exit(1);
  }
}

console.log("執行 M3-C1 完整回歸測試…");

const result = spawnSync(process.execPath, ["--test"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});

if (result.error) throw result.error;

const report = `${result.stdout || ""}\n${result.stderr || ""}`;

function count(key) {
  const pattern = new RegExp(
    `(?:^|\\n)[^\\S\\r\\n]*(?:ℹ|#)?\\s*${key}\\s+(\\d+)`,
    "g",
  );
  const matches = [...report.matchAll(pattern)];
  return matches.length ? Number(matches.at(-1)[1]) : NaN;
}

const tests = count("tests");
const passed = count("pass");
const failed = count("fail");

console.log(`自動化驗收：${passed}/${tests} PASS；失敗 ${failed}`);

if (result.status !== 0 || tests !== 59 || passed !== 59 || failed !== 0) {
  console.error("測試結果不符合預期，停止更新文件。");
  console.error(report.slice(-3500));
  process.exit(1);
}

const updates = [
  {
    file: "README.md",
    marker: "## M3-C1｜前端身分驗證（2026-11-16）",
    content: `## M3-C1｜前端身分驗證（${date}）

- 完成登入與註冊頁面：\`public/auth.html\`、\`auth.css\`、\`auth.js\`。
- Dashboard 新增 Session 驗證與登出：\`public/dashboard-auth.js\`。
- \`public/index.html\` 串接登入者名稱、SQLite 專案列表及建立專案 API。
- 保留 M1 六張 Kanban 示範卡片，尚未連接正式任務資料表。
- 自動化測試：M3-C1 6/6 PASS；全專案 59/59 PASS，0 failed。
- 使用者回報註冊、登入、建立專案、重新整理及登出等瀏覽器流程通過。
- 本階段 Git Commit／Push 待完成。
- 正式 HTTPS、跨瀏覽器及 E2E 自動化仍待驗證。
`,
  },
  {
    file: "CHANGELOG.md",
    marker: "### M3-C1 — 2026-11-16",
    content: `### M3-C1 — ${date}｜Authentication Frontend

#### Added

- 新增註冊／登入 UI、表單驗證、錯誤與成功提示。
- 新增 Dashboard Session 檢查、登出流程及登入者名稱顯示。
- 新增 SQLite 專案列表及建立專案的前端 API 串接。
- 新增 \`tests/frontend-auth.test.js\` 前端 Smoke Tests。

#### Verified

- M3-C1 6/6 PASS。
- 全部回歸 59/59 PASS，0 failed。
- 使用者回報主要瀏覽器操作流程通過。

#### Notes

- M1 Kanban 仍為示範資料，正式任務 CRUD 留待 M5。
- 尚未完成正式 HTTPS、跨瀏覽器與自動化瀏覽器 E2E 驗收。
`,
  },
  {
    file: "docs/ARCHITECTURE.md",
    marker: "## M3-C1｜前端身分驗證整合（2026-11-16）",
    content: `## M3-C1｜前端身分驗證整合（${date}）

### Frontend

- \`/auth.html\` 提供註冊與登入表單。
- \`auth.js\` 呼叫註冊、登入 API。
- \`dashboard-auth.js\` 呼叫 \`GET /api/auth/me\`。
- 登入成功後導向 Dashboard。
- Dashboard 顯示登入者名稱、專案清單及登出功能。

### Authentication

- Session 由後端管理，瀏覽器使用 HttpOnly Cookie。
- 前端不將 Session Token 儲存至 localStorage。
- 專案寫入請求帶入 \`X-TaskFlow-CSRF\`。
- 真正的身分與權限檢查由 Express 後端執行。

### Database Integration

- \`GET /api/projects\` 取得使用者專案列表。
- \`POST /api/projects\` 建立正式 SQLite 專案。
- 原 M1 Kanban 任務卡片仍使用展示資料。

### Verification

- M3-C1 Smoke Tests：6/6 PASS。
- 全專案 Regression Tests：59/59 PASS。
- 前端導頁不是授權邊界，資料安全仍由 API 驗證。
`,
  },
  {
    file: "docs/DEVELOPMENT_LOG.md",
    marker: "## 2026-11-16｜M3-C1 前端身分驗證",
    content: `## ${date}｜M3-C1 前端身分驗證

### 一、開發內容

1. 新增 \`public/auth.html\`。
2. 新增 \`public/auth.css\`。
3. 新增 \`public/auth.js\`。
4. 新增 \`public/dashboard-auth.js\`。
5. 更新 \`public/index.html\`。
6. 新增 \`tests/frontend-auth.test.js\`。
7. 保留原有 Kanban 展示結構，加入真實專案資料串接。

### 二、技術決策

- 沿用 M3-B Authentication API，不重新設計後端。
- Session Cookie 由瀏覽器管理。
- 使用 CSRF Token 保護需要驗證的資料寫入。
- 前端顯示與後端權限檢查分離。
- 不修改正式 SQLite Schema。

### 三、自動化測試

- 前端 Smoke Tests：6/6 PASS。
- 全專案回歸測試：59/59 PASS。
- Fail：0。
- Skipped：0。

### 四、實際操作驗收

- 登入與註冊表單正常呈現。
- Dashboard 正常載入。
- 真實專案資料可以顯示。
- 使用者回報其餘帳號與專案操作測試通過。

### 五、問題與處理

- 執行第二個 npm run dev 時出現 EADDRINUSE。
- 本機 Port 3000 已有程序監聽。
- 使用 curl 健康檢查取得 HTTP 200。
- 不因 Port 占用重新修改正常運作的 API。
- 保留既有 SQLite 資料。

### 六、後續工作

- 完成 M3-C1 文件集中更新。
- 執行 Git Commit 與 Push。
- 核對本機與遠端 Commit SHA。
- 後續進行 M3-C2 進階驗收及 M4 成員管理。
`,
  },
  {
    file: "docs/PROJECT_PLAN.md",
    marker: "## M3-C1｜前端身分驗證驗收（2026-11-16）",
    content: `## M3-C1｜前端身分驗證驗收（${date}）

### 已完成

- 註冊與登入頁面。
- Dashboard Session 驗證。
- 登出介面。
- 登入者名稱顯示。
- SQLite 專案列表與建立專案。
- 前端 Smoke Tests：6/6 PASS。
- 完整回歸測試：59/59 PASS。
- 使用者回報主要瀏覽器操作驗收通過。

### 尚待完成

- 本次 Git Commit、Push 與 SHA 比對。
- 正式任務 CRUD、完整成員權限及 WebSocket。
- 正式 HTTPS、跨瀏覽器及瀏覽器 E2E 自動化測試。

### 下一階段

- M3-C2：額外介面與端對端驗收。
- M4：專案成員管理與 RBAC。
- M5：正式任務 CRUD。
`,
  },
  {
    file: "docs/TESTING.md",
    marker: "## M3-C1｜前端驗收紀錄（2026-11-16）",
    content: `## M3-C1｜前端驗收紀錄（${date}）

### 自動化測試

- \`node --test tests/frontend-auth.test.js\`：6/6 PASS。
- \`npm test\`：59/59 PASS。
- Failed：0。
- Skipped：0。
- Cancelled：0。

以上測試包含靜態資源、API 串接及匿名資料限制，
但不等於自動化瀏覽器 E2E 測試。

### 瀏覽器操作

- 註冊表單切換與顯示：PASS，已提供畫面。
- 註冊、登入、建立專案、Session 持續性與登出：使用者回報 PASS。
- Dashboard SQLite 專案列表與展示 Kanban：已提供畫面。

### 環境問題

- 曾出現 EADDRINUSE 127.0.0.1:3000。
- 既有 HTTP 健康檢查仍回傳 200 OK。

### 尚未驗證

- 正式 HTTPS。
- 跨瀏覽器相容性。
- 自動化瀏覽器 E2E。
- 完整正式部署安全測試。

### 結論

M3-C1 既定自動化測試 59/59 PASS。
主要瀏覽器操作依使用者回報通過。
不以此推論產品所有功能及安全性均已完成。
`,
  },
];

function updateFile(entry) {
  const location = path.join(root, entry.file);

  if (!fs.existsSync(location)) {
    throw new Error(`缺少文件：${entry.file}`);
  }

  const original = fs.readFileSync(location, "utf8");

  if (original.includes(entry.marker)) {
    console.log(`略過已更新：${entry.file}`);
    return;
  }

  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let next = original;

  // CHANGELOG 最新紀錄放在 Unreleased 最上方。
  if (entry.file === "CHANGELOG.md") {
    const anchor = "## [Unreleased]";

    if (!next.includes(anchor)) {
      throw new Error("CHANGELOG 缺少 Unreleased 區段");
    }

    next = next.replace(anchor, `${anchor}\n\n${entry.content.trim()}\n`);
  } else {
    next = next.replace(/\s*$/, "");
    next += "\n\n" + entry.content.trim() + "\n";
  }

  // 更新 README 頂部的目前進度。
  if (entry.file === "README.md") {
    next = next.replace(
      "- M3-C～M10：尚未開始。",
      "- M3-C1：前端登入與註冊、Dashboard Session 串接已完成；M3-C2 待進行。\n- M4～M10：尚未開始。",
    );
  }

  // 更新 PROJECT_PLAN 的最新里程碑狀態。
  if (entry.file === "docs/PROJECT_PLAN.md") {
    next = next.replace(
      /^\| M3\s*\|[^\n]+$/m,
      "| M3   | 使用者註冊與登入         | M3-C1 驗收完成，M3-C2 待進行 |",
    );

    next = next.replace(
      "- M3-B 文件與程式集中版本管理；依 GitHub main 最新提交核對",
      "- M3-C1：驗收通過，待文件與 GitHub 同步",
    );
  }

  if (eol === "\r\n") {
    next = next.replace(/\r?\n/g, "\r\n");
  }

  fs.writeFileSync(location, next, "utf8");
  console.log(`已更新：${entry.file}`);
}

for (const entry of updates) {
  updateFile(entry);
}

console.log("M3-C1 六份文件已完成集中更新。");
console.log("尚未 Git Commit／Push，請先執行 Git Diff 檢查。");
