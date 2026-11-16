"use strict";

// TaskFlow M3-B 集中式文件更新工具
// 用法：node .\scripts\close-m3b.js
// 只更新六份 Markdown；不修改資料庫、不自動 Commit / Push。

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const BASE = "1f94ce7b18b7b38bda7e09f040912d3240f404b7";
const DOCS = [
  "README.md",
  "CHANGELOG.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md",
  "docs/PROJECT_PLAN.md",
  "docs/TESTING.md",
];
const SOURCES = [
  "server/server.js",
  "server/init-db.js",
  "server/auth-routes.js",
  "tests/auth-api.test.js",
  "scripts/accept-m3b.js",
];

function git(...args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0)
    throw new Error(`Git 檢查失敗：${r.stderr || args.join(" ")}`);
  return r.stdout.trim();
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
for (const file of [...DOCS, ...SOURCES]) {
  assert(fs.existsSync(path.join(ROOT, file)), `缺少檔案：${file}`);
}
assert(
  git("rev-parse", "HEAD") === BASE,
  "目前 HEAD 不是 M3-A 基準版本 1f94ce7；請先檢查 Git 狀態。 ",
);
assert(
  git("rev-parse", "origin/main") === BASE,
  "origin/main 與 M3-A 基準版本不符，先檢查是否有人更新 Repository。",
);

console.log("檢查 M1～M3-B 自動化測試...");
const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});
if (
  r.status !== 0 ||
  !/^# tests 53\s*$/m.test(r.stdout || "") ||
  !/^# pass 53\s*$/m.test(r.stdout || "") ||
  !/^# fail 0\s*$/m.test(r.stdout || "")
) {
  console.error(r.stdout || "", r.stderr || "");
  throw new Error("未確認 53/53 PASS，文件不更新。");
}
console.log("回歸測試：53 passed，0 failed。");
console.log(
  "22/22 正式 HTTP 驗收：依先前終端機實測紀錄登載，不再建立測試帳號。",
);

// 先完成所有文件的記憶體變更；有任何預期原文不符，就不寫檔。
const originals = new Map();
const texts = new Map();
for (const file of DOCS) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf8");
  originals.set(file, content);
  texts.set(file, content.replace(/\r\n/g, "\n"));
}
function replace(file, before, after) {
  const text = texts.get(file);
  assert(
    text.includes(before),
    `${file} 找不到預期文字：${before.slice(0, 70)}`,
  );
  assert(
    text.indexOf(before) === text.lastIndexOf(before),
    `${file} 原文出現多次，停止以防誤改。`,
  );
  texts.set(file, text.replace(before, after));
}
function prependSection(file, anchor, heading, section) {
  const text = texts.get(file);
  assert(!text.includes(heading), `${file} 已含 M3-B 章節，避免重複寫入。`);
  assert(text.includes(anchor), `${file} 缺少章節定位文字：${anchor}`);
  texts.set(file, text.replace(anchor, section.trim() + "\n\n" + anchor));
}
function appendSection(file, heading, section) {
  const text = texts.get(file);
  assert(!text.includes(heading), `${file} 已含 M3-B 章節，避免重複寫入。`);
  texts.set(file, text.trimEnd() + "\n\n---\n\n" + section.trim() + "\n");
}

// README：更新當前狀態；原有 M2、M3-A 歷史紀錄不刪除。
replace(
  "README.md",
  "- M3-A：Authentication Foundation 核心測試 9/9 PASS，待本批次 GitHub 同步。",
  "- M3-A：9/9 PASS，已於 Commit 1f94ce7 同步至 GitHub。",
);
replace(
  "README.md",
  "- M3-B～M10：尚未開始。",
  "- M3-B：Authentication HTTP API 完成，完整回歸測試 53/53、正式 HTTP 驗收 22/22 PASS。\n- M3-C～M10：尚未開始。",
);
replace(
  "README.md",
  "| Authentication          | 後端身分驗證（M3 規劃） |",
  "| Authentication          | Session Cookie 與 Auth API（M3-B） |",
);
replace("README.md", "## 專案目錄\n", "## 專案目錄（基礎結構示意）\n");
replace(
  "README.md",
  "目前仍屬開發階段，尚未完成正式使用者登入、真正的多人協作與即時同步。",
  "目前仍屬開發階段：後端註冊／登入／登出 API 已完成，前端登入介面、真正的多人協作與即時同步尚未完成。",
);
replace(
  "README.md",
  "目前已建立三張核心資料表：",
  "目前已建立四張主要資料表：",
);
replace(
  "README.md",
  "- project_members\n\n初始化指令",
  "- project_members\n- auth_sessions\n\n初始化指令",
);
replace(
  "README.md",
  "### 目前限制\n\n- 尚未建立正式註冊及登入 HTTP API",
  "### M3-A 當時限制\n\n- 尚未建立正式註冊及登入 HTTP API",
);
replace(
  "README.md",
  "M3-A 核心程式及測試完成，\n文件與 GitHub 同步待本批次提交。",
  "M3-A 已於 Commit 1f94ce7 完成文件及 GitHub 同步。（上方限制為 M3-A 當時狀態。）",
);
prependSection(
  "README.md",
  "## 開發方式與版本管理",
  "## M3-B｜Authentication HTTP API",
  `
## M3-B｜Authentication HTTP API

### 已完成（後端）

- POST /api/auth/register：註冊並檢查 Email 唯一性，註冊不自動登入。
- POST /api/auth/login：驗證密碼、建立 Session、設定 HttpOnly Cookie。
- GET /api/auth/me：讀取目前登入使用者與 CSRF Token。
- POST /api/auth/logout：驗證 CSRF、撤銷 Session、清除 Cookie。
- Project CRUD 已使用 Session 身分；修改資料要求 CSRF Token。
- 正式 db:init 現在初始化 users、projects、project_members、auth_sessions 四張資料表。
- 限制 JSON 請求大小、進行來源檢查、基本記憶體式登入失敗限速。

### 新增檔案

- server/auth-routes.js：Authentication Router、Cookie 與 CSRF 驗證。
- tests/auth-api.test.js：M3-B 自動化測試。
- scripts/accept-m3b.js：執行中 Server 的本機 HTTP 驗收腳本。

### 操作與測試

啟動：\`npm run db:init\`，接著 \`npm run dev\`。
自動化：\`npm test\`（53/53 PASS，0 failed）。
HTTP 驗收：另開終端機執行 \`node .\\scripts\\accept-m3b.js\`（22/22 PASS）。
驗收腳本會新增隨機測試帳號，成功時刪除測試專案並撤銷 Session；帳號仍保留於本機 SQLite。

### 尚未完成

- M3-C 前端註冊、登入、登出畫面，以及 Dashboard 與正式 API 串接。
- 完整 RBAC、任務管理、多人 Socket.IO 同步、正式部署稽核。
- 目前登入失敗限速僅為單一 Node.js 程序內的記憶體紀錄，不適用於多實例正式部署。
- 正式 HTTPS、反向代理、進階安全測試仍待執行。

M3-B 的程式及既定驗收已完成；版本狀態以 GitHub main 最新提交為準。
`,
);

// CHANGELOG：最新變更放在 M3-A 之前。
replace(
  "CHANGELOG.md",
  "- 文件與 GitHub 同步待本批次提交。",
  "- M3-A 已於 Commit 1f94ce7 完成文件與 GitHub 同步。",
);
prependSection(
  "CHANGELOG.md",
  "### M3-A — 2026-11-16｜Authentication Foundation",
  "### M3-B — 2026-11-16｜Authentication HTTP API",
  `
### M3-B — 2026-11-16｜Authentication HTTP API

#### Added

- 新增註冊、登入、登出及目前使用者查詢 API。
- 新增 Session Cookie（HttpOnly、SameSite=Strict；production 使用 Secure）。
- 新增 CSRF Token 驗證，保護受登入 Session 授權的寫入操作。
- 新增同來源請求檢查與 JSON 請求大小限制。
- 新增簡易的每 IP 登入失敗次數限制。
- 正式資料庫初始化加入 auth_sessions；Project CRUD 串接正式登入身分。
- 新增 M3-B 自動化測試及正式 HTTP 驗收腳本。

#### Verified

- M3-B：11/11 PASS；全專案：53/53 PASS，failed 0，skipped 0。
- 真實本機 Express Server：22/22 HTTP 驗收通過。
- 驗證 200、201、204、401、403、404、409 等預期狀態。
- SQLite 初始化成功建立四張主要資料表。

#### Notes

- 一度發生 \`fetch failed\`，經確認屬於本機 Server 監聽／終端機連線排查流程，調整後 HTTP 驗收全數通過。
- 本次 HTTP 測試留下隨機測試帳號，測試專案已刪除。
- 尚未加入前端登入介面，亦未完成正式部署級安全稽核。
- 程式與文件在同一批次提交；以 GitHub main Commit 作為最終版本紀錄。
`,
);

// ARCHITECTURE：更新目前已建立的資料表；補充新版架構，舊章節保留作歷史快照。
replace(
  "docs/ARCHITECTURE.md",
  "### 已建立資料表\n\n- users\n- projects\n- project_members",
  "### 已建立資料表\n\n- users\n- projects\n- project_members\n- auth_sessions",
);
replace(
  "docs/ARCHITECTURE.md",
  "### 未來仍須實作\n\n- 安全密碼雜湊",
  "### M2-B 時點尚未實作（歷史狀態）\n\n- 安全密碼雜湊",
);
appendSection(
  "docs/ARCHITECTURE.md",
  "## 十六、M3-B Authentication HTTP API",
  `
## 十六、M3-B Authentication HTTP API

### 模組責任

- \`server/auth-foundation.js\`：使用者、scrypt、Session Repository。
- \`server/auth-schema.sql\`：auth_sessions Schema 與索引。
- \`server/auth-routes.js\`：register/login/me/logout、Cookie、CSRF、來源驗證與限速。
- \`server/server.js\`：掛載 Authentication Router、Project Router、統一錯誤處理。
- \`server/init-db.js\`：初始化 M2 核心表及 auth_sessions。
- \`tests/auth-api.test.js\`：隔離的 HTTP 自動化測試。
- \`scripts/accept-m3b.js\`：連到本機正式 Server 的驗收工具。

### 正式請求流程

Client → Express JSON 與來源檢查 → Auth Router → Auth Repository → SQLite。
登入成功後以 HttpOnly、SameSite=Strict Cookie 保存 Session Token；資料庫只存雜湊。
GET /api/auth/me 以 Session 查出安全使用者資料及 CSRF Token。
Project Router 在正式模式透過 Session 取得 userId，寫入時檢查 X-TaskFlow-CSRF。
既有 M2 自動化測試仍可透過 createApp 的可信任測試身分注入進行隔離驗證。

### 安全邊界

- 登入錯誤時回傳一致的帳號／密碼錯誤訊息。
- 變更資料需通過 Session 與 CSRF；不接受客戶端 user_id 直接指定權限。
- 跨來源請求拒絕、JSON 大小限制、Session 撤銷及到期。
- 登入失敗記憶體計數僅適用單程序本機 MVP；跨程序或反向代理部署須重新設計。
- production Cookie 啟用 Secure，但 HTTPS、反向代理設定與安全稽核尚未實際驗證。

### 後續限制

M3-C 前端登入介面、完整 RBAC、任務 CRUD 與 WebSocket 尚未完成。
歷史章節提及「登入尚未開發」或「auth_sessions 尚未整合」是該階段的紀錄；以本章為目前後端實作狀態。
`,
);

// DEVELOPMENT_LOG：只追加，不修改 860 行歷史紀錄。
appendSection(
  "docs/DEVELOPMENT_LOG.md",
  "## 2026-11-16｜M3-B Authentication HTTP API",
  `
## 2026-11-16｜M3-B Authentication HTTP API

### 開發範圍

1. 建立 \`server/auth-routes.js\`，提供四個正式身分驗證 API。
2. 調整 \`server/server.js\`，將正式 Project CRUD 與 Session 身分串接。
3. 調整 \`server/init-db.js\`，初始化第四張 auth_sessions 資料表。
4. 建立 \`tests/auth-api.test.js\`，在隔離的 SQLite 中驗證 API 與安全邊界。
5. 建立 \`scripts/accept-m3b.js\`，連線正式本機 Server 驗收完整流程。

### 重要技術設計

- 延用 M3-A 帳號與 Session Repository，不重寫密碼雜湊與 Token 實作。
- 使用 HttpOnly、SameSite=Strict 的 Session Cookie；正式 HTTPS 情境加上 Secure。
- 寫入專案與登出時檢查 CSRF Token；註冊、登入執行來源驗證。
- 使用者身分由後端 Session 解析，避免將客戶端 user_id 當作授權依據。
- 延用原有 createApp 測試注入接口，保留 M2 測試相容性。
- 以記憶體 Map 實作本機基本登入失敗限速，尚非正式多節點設計。

### 實際驗收結果

- M3-B 獨立自動化測試：11/11 PASS。
- M1～M3-B 全部回歸測試：53/53 PASS，0 failed，0 skipped。
- 正式 \`npm run db:init\`：四張主要 SQLite 資料表初始化成功。
- \`curl.exe -i http://127.0.0.1:3000/api/health\`：HTTP 200。
- 正式本機 HTTP 整合驗收：22/22 PASS。
- 驗證註冊、重複 Email、登入、Cookie、CSRF、專案 CRUD、版本衝突、登出撤銷 Session。

### 問題與排除過程

- 驗收腳本首次執行顯示 \`fetch failed\`，沒有任何 PASS 檢查點。
- 一度未查得 Port 3000 監聽狀態，PowerShell 排查命令亦混入多餘反斜線，造成 CommandNotFoundException。
- 調整為兩個終端機：一個持續執行 \`npm run dev\`，另一個發送 curl 及 Node.js 驗收請求。
- 後續健康檢查 HTTP 200、22/22 PASS，確認連線問題已排除；沒有為此重寫 Auth API。

### 測試資料處理

- 自動化測試使用隔離資料庫。
- 正式 HTTP 驗收會在 data/taskflow.db 中新增隨機測試帳號。
- 驗收成功時測試專案已刪除、Session 已撤銷；測試帳號仍存在，需視後續資料清理政策處理。
- 不重新初始化或刪除正式 SQLite，避免造成使用者資料遺失。

### 版本與後續工作

- 上一階段 M3-A：Commit 1f94ce7，已同步 GitHub。
- 本次 M3-B 程式、測試與六份文件集中提交；實際提交 SHA 以 Git 記錄為準。
- M3-C：前端登入／註冊／登出、錯誤提示、Session 狀態管理與 Project UI 串接。
- 正式部署、完整 RBAC、Socket.IO、進階安全稽核留待後續 Milestone。
`,
);

// PROJECT_PLAN：只更新當前進度與 M3 區段，不修改未來里程碑內容。
replace(
  "docs/PROJECT_PLAN.md",
  "| M3   | 使用者註冊與登入         | M3-A 核心測試完成      |",
  "| M3   | 使用者註冊與登入         | M3-B 後端驗收完成      |",
);
replace(
  "docs/PROJECT_PLAN.md",
  "- M3-B：註冊、登入、登出及 me API",
  "- M3-C：前端註冊、登入、登出及 Session 狀態整合",
);
replace(
  "docs/PROJECT_PLAN.md",
  "M3-A 核心實作與測試完成，\n待 GitHub 提交。",
  "M3-A 已於 Commit 1f94ce7 同步 GitHub。\nM3-B 後端功能已通過 53/53 自動化與 22/22 正式 HTTP 驗收；M3-C 尚未開始。",
);
prependSection(
  "docs/PROJECT_PLAN.md",
  "### 後續工作",
  "### M3-B 已完成（後端功能及驗收）",
  `
### M3-B 已完成（後端功能及驗收）

- 正式註冊、登入、登出、目前使用者 API。
- Session Cookie、CSRF、來源驗證與簡易登入限速。
- Project CRUD 已整合真實登入身分。
- 正式資料庫初始化新增 auth_sessions。
- 自動化測試：M3-B 11/11；全專案 53/53 PASS。
- 本機 Server 22 項正式 HTTP 操作驗收全部通過。
- 版本提交以 GitHub main 最新 Commit 為準。

`,
);
replace(
  "docs/PROJECT_PLAN.md",
  "- M3-A 核心程式與測試 9/9 PASS\n- 完整回歸測試 42/42 PASS",
  "- M3-A 9/9 PASS，Commit 1f94ce7 已同步\n- M3-B 11/11 PASS；完整回歸測試 53/53 PASS\n- M3-B 正式本機 HTTP 驗收 22/22 PASS",
);
replace(
  "docs/PROJECT_PLAN.md",
  "- M3-A 文件更新及 GitHub 同步",
  "- M3-B 文件與程式集中版本管理；依 GitHub main 最新提交核對",
);
replace(
  "docs/PROJECT_PLAN.md",
  "M3-B：Authentication HTTP API 與 Session 整合。",
  "M3-C：前端註冊、登入、登出與 Session 整合。",
);

// TESTING：保留 42/42 的 M3-A 歷史報告，追加現在的 53/53 和 22/22。
replace(
  "docs/TESTING.md",
  "## M3-A 最新驗收總結",
  "## M3-A 驗收總結（歷史紀錄）",
);
replace(
  "docs/TESTING.md",
  "M3-A：核心測試通過，待本批次 GitHub 同步。",
  "M3-A：9/9 PASS，已於 Commit 1f94ce7 同步 GitHub。",
);
appendSection(
  "docs/TESTING.md",
  "## M3-B 最新驗收總結｜2026-11-16",
  `
## M3-B 最新驗收總結｜2026-11-16

### 自動化測試（node:test）

| 階段 | 測試數 | 結果 |
|---|---:|---|
| M1 Express | 4 | PASS |
| M2-A SQLite | 6 | PASS |
| M2-B Project CRUD | 11 | PASS |
| M2-C SQLite/HTTP Integration | 12 | PASS |
| M3-A Authentication Foundation | 9 | PASS |
| M3-B Authentication HTTP API | 11 | PASS |
| **總計** | **53** | **53/53 PASS** |

- Failed：0；Skipped：0；Cancelled：0。
- M3-B 單獨執行：11/11 PASS。
- 上表是自動化測試數量；不要把 22 個 HTTP 驗收點加進 53，兩者為不同驗證流程。

### 正式本機 HTTP 操作驗收（accept-m3b.js）

- 22/22 PASS，0 failed。
- Health：200；匿名 me / projects：401。
- 註冊：201；重複 Email：409；錯誤密碼：401；跨來源：403。
- 登入：200；HttpOnly / SameSite=Strict Cookie 與 CSRF Token 驗證通過。
- 取得使用者、專案列表：200；無 CSRF 寫入：403。
- 專案建立 201、修改 200、舊版本 409、刪除 204、刪除後 404。
- 無 CSRF 登出 403；合法登出 204；撤銷 Session 後 me / projects 401。
- 正式 \`npm run db:init\` 成功，存在 auth_sessions、users、projects、project_members 四張主要資料表。
- \`curl.exe\` 正式健康檢查：HTTP 200。

### 故障紀錄

首次連線曾出現 fetch failed；後續維持 npm run dev 運作並從獨立終端機測試後，22/22 PASS。
此錯誤沒有在後續實測中重現；不能據此宣稱所有部署網路問題已獲驗證。

### 測試資料及安全限制

- 22 項 HTTP 驗收直接使用正式本機資料庫，不是記憶體資料庫。
- 隨機測試帳號仍保留；測試專案已刪除、Session 已撤銷。
- 目前完成的是本機受測流程；前端登入、正式 HTTPS、反向代理、多程序限速及完整安全稽核仍未驗收。
- M3-A GitHub 提交：1f94ce7；M3-B 版本以 GitHub main 最新提交為準。

### 結論

M3-B 後端核心功能 53/53 自動化、22/22 真實 HTTP 驗收通過；M3-C 前端整合尚未開始。
`,
);

// 文件結構／錨點已全部確認，才開始寫入。
for (const file of DOCS) {
  const original = originals.get(file);
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const content = texts.get(file).replace(/\n/g, eol);
  fs.writeFileSync(path.join(ROOT, file), content, "utf8");
  console.log(
    `已更新 ${file}: ${original.split(/\r?\n/).length} → ${content.split(/\r?\n/).length} 行`,
  );
}
console.log("M3-B 六份文件集中更新完成。尚未 Git Commit／Push。");
console.log(
  "下一步：git diff --check；git diff --stat；人工確認後 git add 與 git commit。",
);
