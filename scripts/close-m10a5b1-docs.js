"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--verify") ? "verify" : "dry-run";
const marker = "<!-- TASKFLOW-M10A5B1-2026-11-24 -->";
const docs = [
  ["README.md", `### M10-A5b-1｜Authentication 防濫用與 Session 清理\n\n- 註冊依用戶端 IP 限制：15 分鐘最多 10 次嘗試，超限回傳 HTTP 429。\n- 登入維持 15 分鐘最多 10 次失敗限制，並預留並行驗證名額，避免同步發起的登入請求繞過原本的失敗計數。\n- 啟動時清除過期 Session，後續有已驗證的 API 流量時，最多每小時檢查一次。\n- 沒有變更 SQLite Schema、Cookie 格式、CSRF 流程及正式任務 API。\n- 限制：本階段使用單一 Node.js 行程記憶體，重新啟動後限流會重置；正式多節點部署須改用共享限流儲存。\n- 驗收：\`node --test tests/auth-abuse-guard.test.js tests/auth-abuse-api.test.js\`、\`npm test\`、\`node --test --test-concurrency=1 e2e/*.e2e.js\`。\n`],
  ["CHANGELOG.md", `### M10-A5b-1｜Authentication Abuse Protection & Session Lifecycle (2026-11-24)\n\n#### Added\n- 新增 \`server/auth-abuse-guard.js\`：註冊 IP 限流、登入失敗與並行請求名額控管，以及記憶體上限。\n- 新增 \`tests/auth-abuse-guard.test.js\` 與 \`tests/auth-abuse-api.test.js\`：驗證限流邊界、並行保護及過期 Session 回收。\n- 新增啟動及按需 Session 清理機制，保留所有未過期 Session。\n\n#### Security / Compatibility\n- 維持原本 10 次失敗／15 分鐘的登入防護規則，成功登入仍清除失敗計數。\n- 不變更 Cookie、CSRF、現有 SQLite 表結構與 API 成功回應格式。\n- 正式多節點部署前仍需共享式限流與 HTTPS/反向代理驗收。\n`],
  ["docs/ARCHITECTURE.md", `### M10-A5b-1｜Auth Abuse Guard 與 Session Lifecycle\n\n- \`server/auth-routes.js\` 建立 per-app \`createAbuseGuard()\`。\n- Registration：IP 固定視窗（10 次／15 分鐘），在執行昂貴的 scrypt 前同步計數。\n- Login：原本失敗限制改為 \`failure + inFlight\` 的同步預留名額；成功後清除失敗，錯誤時釋放名額。\n- 記憶體限制：各策略最多 10,000 個 IP key，過期項目機會式清理，滿額時拒絕新來源。\n- Session：初始化及已驗證流量中每小時最多呼叫一次 \`pruneExpiredSessions()\`；不建立持續運作的 Timer。\n- Scope：單 Node 行程、本機 MVP；跨程序共用限流及代理部署設定保留後續階段。\n`],
  ["docs/DEVELOPMENT_LOG.md", `### 2026-11-24｜M10-A5b-1：登入／註冊防濫用與 Session 回收\n\n- 依據既有 \`auth-routes.js\` 的 10 次失敗登入限制，補上併發預留名額；增加註冊 10 次／15 分鐘限制。\n- 整合過期 Session 清理，保留現有 \`auth_sessions\` 表及未過期資料。\n- 新增防濫用單元與 HTTP 整合測試；單次套用腳本提供預覽／套用／驗證及原檔備份。\n- 本階段無須重建 SQLite；\`npm test\` 與 Edge 回歸請在本機確認後，再進行 Git Commit／Push。\n`],
  ["docs/PROJECT_PLAN.md", `### M10-A5b-1｜Authentication Abuse Protection & Session Lifecycle\n\n**範圍：** 註冊限流、並發登入限制、過期 Session 定期機會式清理、單元與 API 整合回歸。\n\n**驗收條件：** 新增測試、原本 \`npm test\`、Edge E2E 均 PASS；無正式資料庫重建；六份文件完成更新；GitHub 同步。\n\n**剩餘工作：** 多行程／反向代理限流策略、HTTPS 與 Cookie 驗收、資料備份／還原演練、正式部署、v1.0.0 Release。\n`],
  ["docs/TESTING.md", `### M10-A5b-1｜驗收指令及涵蓋範圍\n\n1. \`node --check server/auth-routes.js\` 與 \`node --check server/auth-abuse-guard.js\`。\n2. \`node --test tests/auth-abuse-guard.test.js tests/auth-abuse-api.test.js\`：限流視窗、10 次失敗、並發保護、錯誤釋放、容量上限、HTTP 429、Session 啟動清理。\n3. \`npm test\`：驗證既有 Auth/Project/Task API 回歸。\n4. \`node --test --test-concurrency=1 e2e/*.e2e.js\`：Edge 瀏覽器多階段回歸（需本機 Edge）。\n5. \`git diff --check\`、\`git status --short\`。\n\n**注意：** 本文件只列測試方法，不預先聲稱測試已通過；以本機終端機最後的 pass/fail 實際紀錄為準。\n`],
];

const files = docs.map(([name, content]) => {
  const full = path.join(process.cwd(), name);
  if (!fs.existsSync(full)) throw new Error(`缺少 ${name}，停止`);
  const bytes = fs.readFileSync(full);
  const text = bytes.toString("utf8");
  const normalized = text.replace(/\r\n/g, "\n");
  return { name, full, bytes, normalized, eol: text.includes("\r\n") ? "\r\n" : "\n", content };
});

for (const file of files) {
  if (mode === "verify") {
    if (!file.normalized.includes(marker) || !file.normalized.includes("M10-A5b-1")) {
      throw new Error(`${file.name} 未完成文件同步`);
    }
    console.log(`[PASS] ${file.name}`);
  } else if (file.normalized.includes(marker)) {
    console.log(`[SKIP] ${file.name} 已存在`);
  } else if (mode === "dry-run") {
    console.log(`[PREVIEW] ${file.name} 將增量更新`);
  }
}

if (mode === "apply") {
  const needsUpdate = files.filter((file) => !file.normalized.includes(marker));
  if (needsUpdate.length) {
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M10A5b1-docs-"));
    for (const file of needsUpdate) {
      const relative = file.name.replace(/[\\/]/g, "__");
      fs.writeFileSync(path.join(backupDir, relative + ".bak"), file.bytes);
    }
    for (const file of needsUpdate) {
      const markerBlock = `${marker}\n\n${file.content.trimEnd()}\n`;
      let revised;
      if (file.name === "CHANGELOG.md") {
        const anchor = "## [Unreleased]";
        if (!file.normalized.includes(anchor)) throw new Error("CHANGELOG.md 缺少 Unreleased 標題");
        revised = file.normalized.replace(anchor, `${anchor}\n\n${markerBlock}`);
      } else {
        revised = file.normalized.trimEnd() + "\n\n" + markerBlock;
      }
      fs.writeFileSync(file.full, file.eol === "\r\n" ? revised.replace(/\n/g, "\r\n") : revised);
      console.log(`[UPDATED] ${file.name}`);
    }
    console.log(`[BACKUP] ${backupDir}`);
  }
}
