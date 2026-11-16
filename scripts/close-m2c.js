"use strict";

// M2-C 文件結案工具。
// 保留原有歷史，不清空 Markdown。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

const expected = [
  "README.md",
  "CHANGELOG.md",
  "docs/DEVELOPMENT_LOG.md",
  "docs/TESTING.md",
  "docs/ARCHITECTURE.md",
  "docs/PROJECT_PLAN.md",
];

if (!fs.existsSync(path.join(root, "server", "schema.sql"))) {
  throw new Error("找不到 server/schema.sql，請確認專案位置。");
}

// 先跑測試，不允許失敗版本寫入正式文件。
console.log("正在執行 M2-C 最終自動化測試...");

const testResult = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap"],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  },
);

if (testResult.error) {
  throw testResult.error;
}

const output = `${testResult.stdout || ""}\n` + `${testResult.stderr || ""}`;

const passed =
  /^# tests 33\r?$/m.test(output) &&
  /^# pass 33\r?$/m.test(output) &&
  /^# fail 0\r?$/m.test(output);

if (testResult.status !== 0 || !passed) {
  console.error(output);

  throw new Error("測試未達 33/33 PASS，文件不會修改。");
}

console.log("確認：33 passed，0 failed。");

// 將文件先讀到記憶體。
// 驗證更新內容後，再進行檔案寫入。
const original = new Map();
const updated = new Map();

for (const name of expected) {
  const value = fs.readFileSync(path.join(root, name), "utf8");

  original.set(name, {
    value,
    eol: value.includes("\r\n") ? "\r\n" : "\n",
  });

  updated.set(name, value.replace(/\r\n/g, "\n"));
}

function replaceExact(text, before, after, filename) {
  if (text.includes(after)) {
    return text;
  }

  if (!text.includes(before)) {
    throw new Error(`${filename} 找不到預期內容，已停止。`);
  }

  return text.replace(before, after);
}

function replaceSection(text, start, end, replacement, filename) {
  if (text.includes(replacement.trimEnd())) {
    return text;
  }

  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);

  if (a < 0 || b <= a) {
    throw new Error(`${filename} 章節結構不符合預期。`);
  }

  return text.slice(0, a) + replacement.trimEnd() + "\n\n" + text.slice(b);
}

function appendOnce(text, title, content) {
  if (text.includes(title)) {
    return text;
  }

  return text.trimEnd() + "\n\n---\n\n" + content.trim() + "\n";
}

// ====================================
// 1. README.md
// ====================================

let content = updated.get("README.md");

content = replaceExact(
  content,
  "- M2-B：文件更新與 GitHub 提交待完成。",
  "- M2-B：已於 Commit a20aa36 同步 GitHub。",
  "README.md",
);

content = replaceExact(
  content,
  "- M2-C：資料持久化與整合驗收尚未開始。",
  "- M2-C：完成 33/33 回歸測試，待本批次 GitHub 同步。",
  "README.md",
);

content = replaceExact(
  content,
  `### M2-B 尚待完成

- 本階段文件更新
- Git Commit 與 GitHub Push
- 遠端版本一致性確認`,
  `### M2-B 版本紀錄

- 核心程式、測試與文件已於 Commit a20aa36 推送至 GitHub。`,
  "README.md",
);

content = replaceSection(
  content,
  "## 下一階段｜M2-C 整合驗收",
  "## 開發方式與版本管理",
  `## M2-C｜最終驗收（33/33）

M2-C 已完成 SQLite 與 HTTP 整合測試。

### 已完成驗證

- SQLite 持久化及關閉後重新開啟
- Transaction Rollback
- 外鍵、唯一性及狀態約束
- WAL 與資料庫完整性
- HTTP 專案建立及修改後重新開啟
- HTTP 刪除後資料持久化
- HTTP 400、404、413 邊界條件
- 未登入使用者冒用身分防護
- 兩個獨立 Worker 競爭相同 version

### 自動化測試

- M1：4/4 PASS
- M2-A：6/6 PASS
- M2-B：11/11 PASS
- M2-C：12/12 PASS
- 全部測試：33/33 PASS
- 失敗數：0

### 安全性

所有 M2-C 新增測試使用記憶體或
系統暫存 SQLite，不修改正式資料庫。

### 後續限制

尚未完成正式使用者登入、完整 RBAC、
任務 CRUD、Socket.IO 與公開部署。

M2-C 核心測試完成，待本批次 GitHub 同步。`,
  "README.md",
);

updated.set("README.md", content);

// ====================================
// 2. CHANGELOG.md
// ====================================

content = updated.get("CHANGELOG.md");

const release = `### M2-C — 2026-11-16｜最終整合驗收

#### Added

- 新增 tests/integration.test.js。
- 新增 tests/final-acceptance.test.js。
- 加入 HTTP 持久化與異常輸入測試。
- 加入未登入身分冒用測試。
- 加入雙 Worker 並發版本衝突測試。

#### Testing

- M2-C：12/12 PASS。
- M1～M2-C：33/33 PASS。
- 測試失敗數：0。
- 使用獨立暫存 SQLite。

#### Status

- M2-C 核心測試已完成。
- 文件與 GitHub 同步待本批次提交。
- 下一階段為 M3 Authentication。

`;

content = replaceExact(
  content,
  "## [Unreleased]\n\n",
  "## [Unreleased]\n\n" + release,
  "CHANGELOG.md",
);

content = replaceExact(
  content,
  "- 本階段文件與 GitHub 提交待完成。",
  "- M2-B 已於 Commit a20aa36 完成同步。",
  "CHANGELOG.md",
);

updated.set("CHANGELOG.md", content);

// ====================================
// 3. DEVELOPMENT_LOG.md
// ====================================

content = updated.get("docs/DEVELOPMENT_LOG.md");

const development = `## 2026-11-16｜M2-C 最終整合驗收

### 開發目標

驗證 SQLite 資料持久化、交易一致性、
Project CRUD API 與並發版本衝突處理。

### 新增測試檔案

- tests/integration.test.js
- tests/final-acceptance.test.js

### 主要驗證內容

1. SQLite 資料庫重新開啟後資料保留。
2. Transaction 失敗後完整回滾。
3. 外鍵、唯一性及狀態約束持續有效。
4. WAL 與資料庫完整性檢查。
5. HTTP 建立、修改及重啟持久化。
6. HTTP 刪除及重啟後資料一致性。
7. HTTP 無效輸入與錯誤回應。
8. 未登入使用者無法冒用 Owner。
9. 兩個 Worker 並發更新相同 version。

### 自動化測試

- M1 Express：4/4 PASS
- M2-A SQLite：6/6 PASS
- M2-B Project CRUD：11/11 PASS
- M2-C Integration：12/12 PASS
- 全部測試：33/33 PASS
- Fail：0

### 資料安全

測試使用系統暫存 SQLite。
沒有修改正式 data/taskflow.db。

### 技術決策

- 保留現有 Repository 與 Router。
- 不重寫已通過驗證的資料庫模組。
- 使用獨立 Worker Threads 驗證競爭更新。
- 以 version 防止舊版本覆蓋新版本。
- 避免加入超出 M2 範圍的新產品功能。

### 尚未完成

- 正式 Authentication
- 完整 RBAC
- Task CRUD
- Drag & Drop
- Socket.IO
- 壓力與正式部署測試

### GitHub

M2-B 已完成提交：a20aa36。

M2-C 測試及文件將於本批次一次 Commit、
Push 並驗證遠端同步。

### 下一階段

M3：使用者註冊、登入、登出與 Session。
`;

content = appendOnce(content, "## 2026-11-16｜M2-C 最終整合驗收", development);

updated.set("docs/DEVELOPMENT_LOG.md", content);

// ====================================
// 4. ARCHITECTURE.md
// ====================================

content = updated.get("docs/ARCHITECTURE.md");

const architecture = `## 十四、M2-C 整合驗收架構

### 測試模組

tests/integration.test.js

- SQLite 檔案持久化
- Transaction Rollback
- 外鍵與完整性約束
- WAL
- 兩連線版本衝突

tests/final-acceptance.test.js

- HTTP 持久化
- HTTP 異常輸入
- 未登入身分限制
- Worker Threads 並發更新

### 測試資料隔離

所有新測試使用記憶體或系統暫存 SQLite。

測試結束後關閉資料庫並清理暫存檔案。

正式 data/taskflow.db 不作為測試目標。

### 資料一致性

Project Repository 使用 Transaction 保護修改。

更新依賴 id 與 version 條件。

兩個 Worker 使用相同舊版本競爭時，
只允許其中一筆更新成功。

### 後續架構

M3 導入正式 Authentication。

M4 完成 RBAC。

M5～M7 擴充 Task CRUD、Kanban 及 WebSocket。
`;

content = appendOnce(content, "## 十四、M2-C 整合驗收架構", architecture);

updated.set("docs/ARCHITECTURE.md", content);

// ====================================
// 5. TESTING.md
// ====================================

content = updated.get("docs/TESTING.md");

const testing = `## 最新驗收總結

| 階段 | 測試結果 | GitHub |
|---|---|---|
| M0 | 初始化驗證完成 | 已同步 |
| M1 | 4/4 PASS | 已同步 |
| M2-A | 6/6 PASS | 已同步 |
| M2-B | 11/11 PASS | a20aa36 已同步 |
| M2-C | 12/12 PASS | 待本批次提交 |
| 總計 | **33/33 PASS** | 待最終 Push |

### M2-C 實際驗收

- integration.test.js：7/7 PASS
- final-acceptance.test.js：5/5 PASS
- SQLite 持久化：PASS
- Transaction Rollback：PASS
- 資料庫外鍵及完整性：PASS
- HTTP 重開後資料持久化：PASS
- HTTP 400、404、413：PASS
- 未登入冒用身分限制：PASS
- 兩個 Worker 版本競爭：PASS
- 完整回歸測試：33/33 PASS
- Fail：0

### 尚待驗證

- 正式登入流程
- 完整 RBAC 權限矩陣
- 多人即時同步
- 正式環境負載測試
- 完整產品端對端驗收

以上 PASS 僅代表本階段已執行的測試範圍。
`;

if (!content.includes("### M2-C 實際驗收")) {
  const position = content.indexOf("## 最新驗收總結");

  if (position < 0) {
    throw new Error("TESTING.md 找不到最新驗收總結。");
  }

  content = content.slice(0, position) + testing;
}

updated.set("docs/TESTING.md", content);

// ====================================
// 6. PROJECT_PLAN.md
// ====================================

content = updated.get("docs/PROJECT_PLAN.md");

content = replaceExact(
  content,
  `- 集中更新核心文件
- Git Commit
- GitHub Push
- 遠端版本一致性驗證`,
  `- 已於 Commit a20aa36 完成文件、
  Git Commit、Push 及版本一致性驗證。`,
  "docs/PROJECT_PLAN.md",
);

content = replaceExact(
  content,
  "文件整理與 GitHub 同步進行中。",
  "M2-B 已於 Commit a20aa36 完成 GitHub 同步。",
  "docs/PROJECT_PLAN.md",
);

const m2c = `### M2-C｜資料持久化與整合驗收

#### 已完成

- SQLite 持久化與重新開啟驗證
- Transaction Rollback
- 外鍵、WAL 與資料完整性測試
- Project HTTP API 持久化驗收
- HTTP 異常輸入與身分限制
- 雙 Worker 並發版本衝突
- M1～M2-C 回歸測試 33/33 PASS

#### 剩餘程序

- 完成 Git Commit
- Push 至 origin/main
- 確認工作目錄乾淨
- 確認本機與 GitHub 版本一致

#### 目前狀態

M2-C 核心測試完成，
待 GitHub 同步後正式結案 M2。
`;

content = replaceSection(
  content,
  "### M2-C｜資料持久化與整合驗收",
  "### M2 整體結案條件",
  m2c,
  "docs/PROJECT_PLAN.md",
);

const summary = `## 十八、目前開發總結

### 已完成

- M0 專案初始化
- M1 網站核心介面
- M2-A SQLite Schema
- M2-B Project CRUD API
- M2-C 自動化測試 33/33 PASS

### 正在處理

- M2-C GitHub 最終同步

### 下一階段

M3：使用者註冊、登入與登出。

### 最終目標

TaskFlow v1.0.0 多人專案管理平台。
`;

const position = content.indexOf("## 十八、目前開發總結");

if (position < 0) {
  throw new Error("PROJECT_PLAN.md 找不到目前開發總結。");
}

if (!content.includes("- M2-C 自動化測試 33/33 PASS")) {
  content = content.slice(0, position) + summary;
}

updated.set("docs/PROJECT_PLAN.md", content);

// ====================================
// 7. 寫入六份文件
// ====================================

for (const name of expected) {
  const { value, eol } = original.get(name);

  const next = updated.get(name).replace(/\n/g, eol);

  if (next !== value) {
    fs.writeFileSync(path.join(root, name), next, "utf8");
  }

  console.log(`已完成：${name}`);
}

console.log("M2-C 文件更新完成，請檢查 Git diff。");
