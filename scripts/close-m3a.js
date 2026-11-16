"use strict";

// TaskFlow M3-A 文件更新工具
// 適用基準：M2-C Commit 878dfec
// 先測試，再核對文件，最後才寫入。
// 保留原有開發紀錄，不清空歷史文件。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

const files = [
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md",
  "docs/PROJECT_PLAN.md",
  "docs/TESTING.md",
];

const requiredCode = [
  "server/auth-schema.sql",
  "server/auth-foundation.js",
  "tests/auth-foundation.test.js",
];

const docs = new Map();
const originals = new Map();

// 1. 檢查 M3-A 程式檔案
for (const file of requiredCode) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`缺少 M3-A 檔案：${file}`);
  }
}

// 2. 確認全部自動化測試通過
console.log("執行 M3-A 完整回歸測試...");

const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error) {
  throw result.error;
}

const output = `${result.stdout || ""}\n${result.stderr || ""}`;

if (
  result.status !== 0 ||
  !/^# tests 42\r?$/m.test(output) ||
  !/^# pass 42\r?$/m.test(output) ||
  !/^# fail 0\r?$/m.test(output)
) {
  console.error(output);
  throw new Error("完整測試未達 42/42 PASS，停止更新文件。");
}

console.log("測試確認：42 passed，0 failed。");

// 3. 讀取原始文件
for (const file of files) {
  const original = fs.readFileSync(path.join(root, file), "utf8");

  originals.set(file, original);

  docs.set(file, original.replace(/\r\n/g, "\n"));
}

// 精確取代，避免修改錯誤段落。
function replaceOnce(file, before, after) {
  let text = docs.get(file);

  if (text.includes(after)) {
    return;
  }

  if (!text.includes(before)) {
    throw new Error(`${file} 找不到預期原文，停止更新。`);
  }

  text = text.replace(before, after);
  docs.set(file, text);
}

// 指定位置插入新章節。
function insertBefore(file, marker, heading, body) {
  let text = docs.get(file);

  if (text.includes(heading)) {
    return;
  }

  const index = text.indexOf(marker);

  if (index < 0) {
    throw new Error(`${file} 找不到章節位置：${marker}`);
  }

  text = text.slice(0, index) + body.trim() + "\n\n" + text.slice(index);

  docs.set(file, text);
}

// 累積式新增日誌。
function appendOnce(file, heading, body) {
  let text = docs.get(file);

  if (text.includes(heading)) {
    return;
  }

  text = text.trimEnd() + "\n\n---\n\n" + body.trim() + "\n";

  docs.set(file, text);
}

// ====================================
// README.md
// ====================================

replaceOnce(
  "README.md",
  "- M2-C：完成 33/33 回歸測試，待本批次 GitHub 同步。",
  "- M2-C：33/33 PASS，已於 Commit 878dfec 同步 GitHub。",
);

replaceOnce(
  "README.md",
  "- M3～M10：尚未開始。",
  "- M3-A：Authentication Foundation 核心測試 9/9 PASS，待本批次 GitHub 同步。\n- M3-B～M10：尚未開始。",
);

replaceOnce(
  "README.md",
  "M2-C 核心測試完成，待本批次 GitHub 同步。",
  "M2-C 已於 Commit 878dfec 同步 GitHub，M2 正式結案。",
);

insertBefore(
  "README.md",
  "## 開發方式與版本管理",
  "## M3-A｜Authentication Foundation",
  `
## M3-A｜Authentication Foundation

M3-A 已完成使用者身分驗證資料層的核心實作。

### 新增模組

- server/auth-schema.sql
- server/auth-foundation.js
- tests/auth-foundation.test.js

### 已實作功能

- Email 格式驗證與正規化
- 帳號註冊資料存取
- 重複 Email 防護
- scrypt 密碼雜湊與隨機 Salt
- 密碼比對與安全使用者資料回傳
- Session Token 產生與 SHA-256 雜湊儲存
- Session 到期與撤銷
- 過期 Session 清理
- 使用者刪除後 Session 連動清除
- SQLite Session 持久化

### 資料庫

M3-A 新增 auth_sessions 資料表。

目前透過獨立的 auth-schema.sql 初始化。
尚未整合至正式網站資料庫初始化流程。

### 測試結果

- M3-A：9/9 PASS
- M1～M2-C：33/33 PASS
- 完整回歸測試：42/42 PASS
- Fail：0
- Skipped：0

### 目前限制

- 尚未建立正式註冊及登入 HTTP API
- 尚未整合 Session Cookie
- 尚未將 Project API 接到正式登入身分
- 尚未建立前端登入與註冊頁面

以上功能將在後續 M3-B、M3-C 完成。

M3-A 核心程式及測試完成，
文件與 GitHub 同步待本批次提交。
`,
);

// ====================================
// CHANGELOG.md
// ====================================

replaceOnce(
  "CHANGELOG.md",
  "- 文件與 GitHub 同步待本批次提交。",
  "- M2-C 已於 Commit 878dfec 完成 GitHub 同步。",
);

insertBefore(
  "CHANGELOG.md",
  "### M2-C — 2026-11-16",
  "### M3-A — 2026-11-16",
  `
### M3-A — 2026-11-16｜Authentication Foundation

#### Added

- 新增 auth_sessions 資料表及索引。
- 新增 Auth Repository。
- 新增帳號註冊與 Email 驗證。
- 新增 scrypt 密碼雜湊與驗證。
- 新增 Session 建立、查詢及撤銷功能。
- 新增 Session 過期清理。
- 新增 M3-A 自動化測試。

#### Security

- 使用隨機 Salt 與 scrypt。
- 不儲存明文密碼。
- Session Token 只儲存 SHA-256 雜湊。
- 回傳使用者資料不包含 password_hash。
- 保留外鍵及 Session 到期約束。

#### Testing

- M3-A：9/9 PASS。
- 完整回歸測試：42/42 PASS。
- Failed：0。
- Skipped：0。

#### Fixed

- 修正 auth-foundation.js 首行多餘字元
  引發的 JavaScript SyntaxError。
- 修正後重新執行語法檢查與完整測試。

#### Status

- M3-A 核心實作及測試完成。
- 文件與 GitHub 同步待本批次提交。
- 下一階段為 M3-B Authentication API。
`,
);

// ====================================
// DEVELOPMENT_LOG.md
// ====================================

appendOnce(
  "docs/DEVELOPMENT_LOG.md",
  "## 2026-11-16｜M3-A Authentication Foundation",
  `
## 2026-11-16｜M3-A Authentication Foundation

### 開發目標

建立 TaskFlow 正式登入系統的資料層基礎。

### 開發內容

1. 建立 auth_sessions 資料表。
2. 建立 Session 專用索引。
3. 實作 Email 正規化與驗證。
4. 實作安全密碼雜湊。
5. 實作密碼驗證。
6. 實作使用者註冊。
7. 實作使用者身分查詢。
8. 實作 Session 建立與撤銷。
9. 實作 Session 過期與清理。
10. 建立獨立自動化測試。

### 新增檔案

- server/auth-schema.sql
- server/auth-foundation.js
- tests/auth-foundation.test.js

### 技術決策

- 延用 Node.js 與 SQLite。
- 使用 Node.js 內建 crypto。
- 密碼使用非同步 scrypt。
- 每筆密碼使用隨機 Salt。
- Session 使用隨機 Token。
- 資料庫只儲存 Token 的 SHA-256 雜湊。
- 原本 M2 Repository 與 Router 暫不修改。
- auth-schema.sql 獨立管理 Session Schema。

### 問題及修正紀錄

首次執行 M3-A 測試時發生 SyntaxError。

錯誤位置：

server/auth-foundation.js 第 1 行。

原因：

複製程式碼時，多出不合法的星號字元。

處理方式：

- 移除多餘字元。
- 重新執行 node --check。
- 獨立執行 M3-A 測試。
- 重新執行完整回歸測試。

### 實際驗證

- M3-A 獨立測試：9/9 PASS。
- 原有 M1～M2-C：33/33 PASS。
- 全部測試：42/42 PASS。
- Failed：0。
- Skipped：0。

### M2 版本銜接

M2-C 已於 Commit 878dfec 完成 GitHub 同步。
本階段沒有重新修改已結案的 M2 程式。

### 尚未完成

- M3-B Authentication HTTP API
- 正式 Session Cookie
- CSRF 防護
- 登入限速
- 正式資料庫初始化整合
- 前端註冊與登入介面
- Project API 正式登入身分整合

### GitHub

M3-A 文件及程式將於本批次一併提交。

### 下一階段

M3-B：註冊、登入、登出、使用者資料 API。
`,
);

// ====================================
// ARCHITECTURE.md
// ====================================

appendOnce(
  "docs/ARCHITECTURE.md",
  "## 十五、M3-A Authentication Foundation",
  `
## 十五、M3-A Authentication Foundation

### 模組

server/auth-schema.sql

- auth_sessions 資料表
- 使用者外鍵
- Token Hash 主鍵
- Session 到期時間
- 查詢索引

server/auth-foundation.js

- AuthError
- initializeAuthSchema
- hashPassword
- verifyPassword
- createAuthRepository

tests/auth-foundation.test.js

- 帳號與密碼驗證
- Session 生命週期
- SQLite 持久化
- 資料完整性

### 密碼儲存

使用 scrypt 與隨機 Salt。

密碼不以明文形式儲存。

使用 timingSafeEqual 比對衍生金鑰。

### Session 資料

auth_sessions：

- token_hash：TEXT，Primary Key
- user_id：INTEGER，Foreign Key
- created_at：INTEGER
- expires_at：INTEGER

User 與 Session 為一對多關係。

刪除 User 時會連動清除相關 Session。

### Session 流程

1. 伺服器產生安全隨機 Token。
2. 計算 Token 的 SHA-256 雜湊。
3. 資料庫只保存雜湊。
4. 使用雜湊查詢有效 Session。
5. 到期或登出時使 Session 失效。

### M3-A 架構限制

目前只有 Authentication Repository。

正式 HTTP API、Cookie、CSRF 防護與
Project API 登入身分整合尚未實作。

auth_sessions 尚未加入正式 db:init 流程。

### 測試

M3-A：9/9 PASS。

完整回歸測試：42/42 PASS。
`,
);

// ====================================
// TESTING.md
// ====================================

replaceOnce(
  "docs/TESTING.md",
  "## 最新驗收總結",
  "## M2-C 驗收總結（歷史紀錄）",
);

replaceOnce(
  "docs/TESTING.md",
  "| M2-C | 12/12 PASS | 待本批次提交 |",
  "| M2-C | 12/12 PASS | 878dfec 已同步 |",
);

replaceOnce(
  "docs/TESTING.md",
  "| 總計 | **33/33 PASS** | 待最終 Push |",
  "| 總計 | **33/33 PASS** | 878dfec 已同步 |",
);

appendOnce(
  "docs/TESTING.md",
  "## M3-A 最新驗收總結",
  `
## M3-A 最新驗收總結

### 自動化測試結果

| 階段 | 測試數量 | 結果 |
|---|---:|---|
| M1 Express | 4 | PASS |
| M2-A SQLite | 6 | PASS |
| M2-B Project CRUD | 11 | PASS |
| M2-C Integration | 12 | PASS |
| M3-A Authentication | 9 | PASS |
| 總計 | **42** | **42/42 PASS** |

### M3-A 測試範圍

- Session Schema 重複初始化
- Email 正規化
- 密碼雜湊與安全回傳
- 重複 Email 拒絕
- 不同 Salt
- 正確與錯誤密碼驗證
- Session Token 雜湊
- Session 到期與清理
- Session 撤銷
- Session 跨資料庫重開
- 刪除使用者後 Session 連動清除

### 實際執行結果

- node --check：PASS
- M3-A：9/9 PASS
- npm test：42/42 PASS
- Failed：0
- Cancelled：0
- Skipped：0

### 尚待測試

- 正式註冊與登入 HTTP API
- Session Cookie 安全屬性
- CSRF 防護
- 登入限速
- 正式登入後的 Project CRUD
- 前端使用者操作流程
- 完整產品端對端驗收

以上測試通過不代表完整 M3 已完成。

### 版本狀態

M2-C：Commit 878dfec，已同步。

M3-A：核心測試通過，待本批次 GitHub 同步。
`,
);

// ====================================
// PROJECT_PLAN.md
// ====================================

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "| M2   | SQLite 與專案 CRUD API   | 進行中                 |",
  "| M2   | SQLite 與專案 CRUD API   | 已完成                 |",
);

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "| M3   | 使用者註冊與登入         | 未開始                 |",
  "| M3   | 使用者註冊與登入         | M3-A 核心測試完成      |",
);

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "#### 剩餘程序\n\n- 完成 Git Commit\n- Push 至 origin/main\n- 確認工作目錄乾淨\n- 確認本機與 GitHub 版本一致",
  "#### 版本紀錄\n\n- M2-C Commit：878dfec。\n- GitHub Push：已完成。\n- 本機與遠端版本：已驗證一致。",
);

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "M2-C 核心測試完成，\n待 GitHub 同步後正式結案 M2。",
  "M2-C 已於 Commit 878dfec 同步 GitHub，M2 正式結案。",
);

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "- M2-C GitHub 最終同步",
  "- M3-A 文件更新及 GitHub 同步",
);

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "- M2-C 自動化測試 33/33 PASS",
  "- M2-C 自動化測試 33/33 PASS，已同步 GitHub\n- M3-A 核心程式與測試 9/9 PASS\n- 完整回歸測試 42/42 PASS",
);

replaceOnce(
  "docs/PROJECT_PLAN.md",
  "M3：使用者註冊、登入與登出。",
  "M3-B：Authentication HTTP API 與 Session 整合。",
);

// 只修改 M3 章節的狀態，不影響 M4～M10。
{
  const file = "docs/PROJECT_PLAN.md";
  let text = docs.get(file);

  const start = text.indexOf("## 十、M3｜使用者註冊與登入");

  const end = text.indexOf("## 十一、M4｜成員管理與 RBAC", start);

  if (start < 0 || end < 0) {
    throw new Error("PROJECT_PLAN 的 M3 章節不存在。");
  }

  let section = text.slice(start, end);

  if (!section.includes("### M3-A 已完成")) {
    section = section.replace(
      "### 狀態\n\n尚未開始。",
      `### M3-A 已完成

- Authentication Foundation
- auth_sessions Schema
- scrypt 密碼雜湊
- 使用者帳號 Repository
- Session 建立、撤銷與過期
- Session 資料持久化
- M3-A 自動化測試 9/9 PASS
- 完整回歸測試 42/42 PASS

### 後續工作

- M3-B：註冊、登入、登出及 me API
- 正式 Cookie 與 Session 整合
- 登入安全防護與 API 測試
- M3-C：前端登入介面及整合驗收

### 狀態

M3-A 核心實作與測試完成，
待 GitHub 提交。
`,
    );
  }

  docs.set(file, text.slice(0, start) + section + text.slice(end));
}

// ====================================
// 寫入六份 Markdown 文件
// ====================================

for (const file of files) {
  const original = originals.get(file);
  const eol = original.includes("\r\n") ? "\r\n" : "\n";

  const next = docs.get(file).replace(/\n/g, eol);

  if (next !== original) {
    fs.writeFileSync(path.join(root, file), next, "utf8");
    console.log(`已更新：${file}`);
  } else {
    console.log(`無須更新：${file}`);
  }
}

console.log("");
console.log("M3-A 文件更新完成。");
console.log("請執行 git diff --check 及 git diff --stat。");
console.log("尚未自動執行 Git Commit 或 Push。");
