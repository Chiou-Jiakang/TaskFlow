"use strict";

// TaskFlow M7 安全文件結案器。
// 保留舊文件所有內容；只新增一段具唯一標記的 M7 結案紀錄。
// 不會執行 git add/commit/push，不會觸及 SQLite 或 .env。
// 先用 --dry-run；全部 M7-D 驗收成功後才可加 --acceptance-passed 執行。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const root = path.resolve(__dirname, "..");
const MARK = "TASKFLOW-M7-CLOSEOUT-2026-11-19";
const dryRun = process.argv.includes("--dry-run");
const approved = process.argv.includes("--acceptance-passed");
const sections = {
  "README.md": `## M7｜Socket.IO 多人即時協作（2026-11-19）

- **M7-A**：Socket.IO Session Cookie 驗證、Origin 同源檢查、專案 Room 存取控制與撤權再驗證。
- **M7-B**：成功完成 REST／SQLite 寫入後發佈資源異動事件；失敗回應不推播，事件不傳送私人任務內容。
- **M7-C**：前端協調器訂閱 Room、自動重抓 REST、離線重連補抓、切換專案隔離、編輯／拖曳中延後刷新。
- **M7-D**：新增 Microsoft Edge 多帳號整合驗收，覆蓋兩個專案事件隔離、同版本平行寫入 200／409、跨欄排序持久化、Member 權限、撤銷成員與登出後的事件隔離。

### 驗收命令（M7 結案前須已實際全數通過）

\`\`\`powershell
npm test
npm run test:e2e:all
node --test .\\e2e\\realtime-sync.e2e.js
node --test .\\e2e\\realtime-resilience.e2e.js
git diff --check
\`\`\`

M7-D E2E 使用 \`:memory:\` SQLite、隨機 Loopback Port 與測試帳號，不讀寫正式 \`data/taskflow.db\`。以上為驗收範圍，不代表正式 HTTPS、效能、跨瀏覽器或完整安全審核已完成。M8～M10 及正式 GitHub Release 仍待後續進行。`,
  "CHANGELOG.md": `### M7 — 2026-11-19｜Realtime collaboration / Socket.IO

#### Added

- Session 驗證及同源保護的 Socket.IO 專案 Room。
- Task、Member、Project 與 Move REST 成功寫入後的資源異動推播。
- 瀏覽器即時同步、斷線重訂閱與 REST 補抓；切換專案與編輯中延後刷新。
- M7-D Edge 協作韌性 E2E：平行 409 衝突、跨專案隔離、Member 撤權及 Session 登出保護。

#### Verified

- M7-A、M7-B、M7-C 專項測試及完整既有回歸已依本機執行結果通過。
- M7-D 須於正式結案前實際執行 \`e2e/realtime-resilience.e2e.js\`，並核對 0 failed、0 skipped。
- GitHub push／乾淨工作樹以實際 Commit SHA 和 \`origin/main\` 比對為準，不在本文件預填結果。

#### Remaining

- M8 通知／協作互動、M9 搜尋統計、M10 部署／安全／效能、正式 Release。`,
  "docs/ARCHITECTURE.md": `## M7｜Socket.IO 即時事件與資料一致性（2026-11-19）

### 資料流

1. 瀏覽器透過 HttpOnly Session Cookie 與同源 WebSocket 建立 Socket.IO 連線。
2. \`server/realtime-hub.js\` 驗證 Session、Origin 與 \`project_members\`，只允許訂閱有權限的 \`project:<id>\` Room。
3. Task／Member／Project／Move Repository 成功完成 SQLite 寫入後，路由標註 \`res.locals.taskflowRealtimeChange\`。
4. \`server/realtime-notifier.js\` 只在成功 HTTP finish 後呼叫 \`publishProjectChanged()\`；非 2xx 不通知。
5. Hub 再查詢 Session 與成員資格；非成員離開 Room 並收到 \`project:access-revoked\`，有效成員只收到資源異動 metadata。
6. \`public/task-realtime.js\` 協調 \`public/task-board.js\` 重新讀取受權限保護的 REST API，不接受 Socket 內容直接覆寫 SQLite 資料。

### 故障與競爭策略

- Socket.IO 通知是「重新取得資料」提示，不是可靠佇列或資料庫事務；斷線重連後重新加入 Room 並透過 REST 補抓。
- M6 樂觀鎖 version 仍由 Repository 驗證，過期修改回傳 409；不允許 Socket.IO 越過 CSRF/RBAC 改寫資料。
- 前端編輯／拖曳或 REST 寫入中，暫緩外部刷新，避免局部狀態被不當覆蓋。
- Socket 發送前再次驗證成員及 Session，可降低長連線持有過期權限的風險。
- 不包含跨程序訊息中介、耐久事件佇列、正式反向代理與多節點 Socket.IO Adapter；這些仍待部署階段評估。`,
  "docs/DEVELOPMENT_LOG.md": `## 2026-11-19｜M7 即時協作開發與故障修復紀錄

### M7-A

- 新增 \`server/realtime-hub.js\` 與相關測試；採同源、Session、專案 Room 限權。Socket 不直接修改資料。

### M7-B

- 新增 \`server/realtime-notifier.js\` 與增量整合工具，將 Task、Move、Member、Project 寫入事件接到成功 HTTP 回應。
- 初次 REST 整合測試因測試身分注入略過 \`auth_sessions\` 初始化，且清理 hook 註冊過晚而卡住。修正測試初始化與關閉流程後，M7-B 專項 9/9、Node.js 195/195、既有 Edge 52/52 通過。

### M7-C

- 新增 \`public/task-realtime.js\`、增量前端整合工具及 Edge 雙使用者同步測試。
- 完成離線重連補抓、即時更新、角色限制、專案訂閱管理、編輯／拖曳保護。
- 先前本機回歸：Node.js 206/206、既有 Edge 52/52、M7-C 新增 Edge 6/6，0 failed。

### M7-D

- 新增 \`e2e/realtime-resilience.e2e.js\`，驗證平行版本衝突、Room 隔離、原子跨欄排序、撤權清除與登出後推播拒絕。
- 使用記憶體資料庫與四個獨立 Edge BrowserContext，避免接觸真實使用者資料。
- 正式結案條件：M7-D、M7-C、原有全套 Node.js／Edge、Git 檢查全部通過；具體通過計數以本機測試輸出為準。

### Git 歷史

- 保留 M0～M6 原始紀錄；M7 Commit SHA 應於實際 commit/push 後核對，**不在產生文件時假設已完成**。`,
  "docs/PROJECT_PLAN.md": `## M7｜即時協作完成範圍與後續規劃（2026-11-19）

| 子階段 | 核心交付 | 結案證據 |
| --- | --- | --- |
| M7-A | Socket.IO、Session／Origin／Room 權限 | M7-A 專項及完整回歸 |
| M7-B | 成功 REST 寫入才觸發通知 | M7-B 專項及完整回歸 |
| M7-C | 前端即時同步、重連補抓 | Node／Edge 專項與回歸 |
| M7-D | 多帳號併發、409、隔離、排序、撤權及登出 | \`realtime-resilience.e2e.js\` 和回歸結果 |

### 結案檢查

- [x] M7-A～M7-C 既定功能與專項驗收。
- [ ] M7-D 本機測試與全部回歸重新驗證 0 fail。
- [ ] 六份文件保存歷史、比對修改內容。
- [ ] 確認不提交正式 SQLite、\`.env\`、密鑰、暫存日誌及備份。
- [ ] 完成 Git Commit／Push，確認 HEAD 與 origin/main 一致且工作樹乾淨。

以上待辦需用實際終端機結果核對，文件產生器不會自動假定完成。

### 尚未完成

M8 通知／留言及協作延伸、M9 統計／搜尋、M10 部署及安全壓力驗收，正式 v1.0.0 Release 另需審核。`,
  "docs/TESTING.md": `## 2026-11-19｜M7 Socket.IO 與多使用者即時同步驗收

### 已知在前一輪通過的測試

| 範圍 | 截圖證據 |
| --- | --- |
| M7-A Socket Session／Room | 15/15 PASS |
| M7-B REST 通知器 | 9/9 PASS |
| M7-C 同步協調器 | 11/11 PASS |
| 完整 Node.js（當時） | 206/206 PASS |
| 原有 Edge E2E（當時） | 52/52 PASS |
| M7-C 新增 Edge E2E | 6/6 PASS |

上方為 M7-D 開始之前已確認的歷史執行結果，不能視為執行了本次 M7-D 測試。

### M7-D 新增驗收

\`e2e/realtime-resilience.e2e.js\`：四組獨立 Session、兩專案隔離、Owner 新增同步、Member 狀態同步、Owner/Admin 平行樂觀鎖 200/409、API 跨專案限制、原子跨欄排序持久化、成員撤權後停止接收、登出 Session 失效與頁面錯誤檢查。

### 執行命令

\`\`\`powershell
node --check .\\e2e\\realtime-resilience.e2e.js
npm test
npm run test:e2e:all
node --test .\\e2e\\realtime-sync.e2e.js
node --test .\\e2e\\realtime-resilience.e2e.js
git diff --check
\`\`\`

- 必須從本機的 M7-D 終端輸出核對實際 pass/fail；本文不預填尚未執行的結果。
- 新增測試採 \`:memory:\` SQLite、隨機本機 Port 與 \`example.test\` 帳號，無正式資料寫入。
- 單一瀏覽器 Edge 測試不能推導其他瀏覽器、HTTPS／反向代理、多節點部署、壓力或完整資安均已驗收。
- Git Commit／Push 並非自動執行，須核對 \`git status -sb\`、\`HEAD\`、\`origin/main\`。`,
};

const plans = [];
for (const [relative, body] of Object.entries(sections)) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new Error(`缺少舊文件：${relative}`);
  const current = fs.readFileSync(file, "utf8");
  const start = `<!-- ${MARK} -->`;
  const end = `<!-- /${MARK} -->`;
  const hasStart = current.includes(start);
  const hasEnd = current.includes(end);
  if (hasStart !== hasEnd) throw new Error(`${relative} M7 標記不完整，停止修改`);
  if (hasStart) {
    console.log(`[已更新，跳過] ${relative}`);
    continue;
  }
  // 不取代之前章節，也不會覆寫舊的 M5/M6 驗收紀錄。
  const newline = current.includes("\r\n") ? "\r\n" : "\n";
  const block = `${start}\n\n${body.trim()}\n\n${end}`.replace(/\n/g, newline);
  const next = `${current}${current.endsWith(newline) ? newline : newline + newline}${block}${newline}`;
  plans.push({ relative, file, next });
}
if (dryRun) {
  for (const p of plans) console.log(`[預覽] ${p.relative}`);
  console.log("預覽完成，尚未修改任何文件。");
  process.exit(0);
}
if (!approved) {
  console.error("已拒絕寫入：M7-D 實際測試全部通過後，才可使用 --acceptance-passed。");
  process.exitCode = 2;
} else if (!plans.length) {
  console.log("六份 M7 文件均已結案；沒有重複新增。 ");
} else {
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M7-docs-"));
  for (const p of plans) {
    const dest = path.join(backup, p.relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(p.file, dest);
  }
  try {
    for (const p of plans) {
      fs.writeFileSync(p.file, p.next, "utf8");
      console.log(`[更新] ${p.relative}`);
    }
    console.log(`已備份六份原始文件至：${backup}`);
    console.log("尚未 Commit／Push，請檢查 git diff --check / git diff --stat。 ");
  } catch (error) {
    for (const p of plans) fs.copyFileSync(path.join(backup, p.relative), p.file);
    throw error;
  }
}
