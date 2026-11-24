#!/usr/bin/env node
"use strict";
// TaskFlow M10-A5a six-doc closeout.  Dry-run default; apply backs up; verify read-only.
// Does not touch data/, server/, public/, package.json, Git, or network.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PROJECT = path.resolve(__dirname,"..");
const FILES = ["README.md","CHANGELOG.md","docs/ARCHITECTURE.md","docs/DEVELOPMENT_LOG.md","docs/PROJECT_PLAN.md","docs/TESTING.md"];
const START = "<!-- TASKFLOW-M10A5A-DOCS-2026-11-24 -->";
const END = "<!-- /TASKFLOW-M10A5A-DOCS-2026-11-24 -->";
const BLOCKS = {
  "README.md": "## 最新產品化進度｜M10-A5a 基礎 CSP 與瀏覽器權限政策（2026-11-24）\n\n> 此節記錄 M10-A5a 的本機驗收快照。以下舊章節為當時的歷史紀錄；TaskFlow **v1.0.0 尚未發布**。\n\n- **Git 基準：** M10-A4 已於 Commit `712b432` Push 至 `origin/main`，本機與 GitHub 完整 SHA 核對相同。\n- **本次實作：** `server/server.js` 加入 `Content-Security-Policy`（僅 `base-uri 'self'`、`object-src 'none'`、`frame-ancestors 'none'`、`form-action 'self'`）與 `Permissions-Policy`（`camera=(), microphone=(), geolocation=()`）。保留 M10-A4 安全標頭及 API `no-store`。\n- **相容性策略：** 目前沒有強制設定 `script-src`、`style-src`、`connect-src` 或 HSTS；不能將這套 CSP 基線寫成完整 CSP 及 HTTPS 安全驗收。既有 Session、CSRF、RBAC、Socket.IO、REST、SQLite 未因本次修改變更。\n- **驗收（使用者本機終端截圖）：** `node --test tests/security-policy.test.js` **5/5 PASS**；`npm test` **336/336 PASS**；所有 `e2e/*.e2e.js` 依序執行 **110/110 PASS**，各組均 0 fail／skipped／cancelled。專項 Node 5 項已計入完整 Node 336 項，不重複加總。\n- **界線：** 自動化 Edge 回歸通過表示既定情境沒有觀察到功能回歸，不代表已涵蓋所有 CSP 違規、公開 HTTPS、登入防暴力破解、滲透測試或手機／無障礙驗收。\n- **Git 狀態：** M10-A5a 此節建立時尚未 Commit／Push；須另行精準暫存，並比對本機及遠端 SHA。\n\n---",
  "CHANGELOG.md": "### M10-A5a — 2026-11-24｜Baseline CSP & Browser Permissions Policy\n\n#### Added\n\n- `server/server.js`：新增有限範圍 `Content-Security-Policy`，含 `base-uri 'self'`、`object-src 'none'`、`frame-ancestors 'none'`、`form-action 'self'`。\n- 加入 `Permissions-Policy: camera=(), microphone=(), geolocation=()`，限制非必要瀏覽器功能。\n- 加入 `scripts/apply-m10a5a.js` 及 `tests/security-policy.test.js`；新增 M10-A5a 文件增量工具與文件工具測試。\n\n#### Verified\n\n- CSP／Permissions-Policy 專項 **5/5 PASS**、`npm test` **336/336 PASS**、全套 Edge E2E **110/110 PASS**；皆未出現 fail／cancelled／skipped。專項 Node 測試已包含在 336 項之中。\n- 更新工具 `--verify` 與重複 `--dry-run` 可辨識 M10-A5a 標頭已存在，未重複修改產品程式碼。\n\n#### Remaining / Unreleased\n\n- 未實施完整 `script-src`、`style-src`、`connect-src` 限制；公開 HTTPS／HSTS、登入防濫用及 Session 正式環境驗證、SQLite 備份還原和部署／Release 尚待後續階段。\n- 既有 M9-C3 行動版／無障礙驗收維持 Deferred / Not Verified。此段新增時尚未 M10-A5a Git Commit／Push；`v1.0.0` 尚未發布。\n\n---",
  "docs/ARCHITECTURE.md": "## M10-A5a｜CSP 基線及 Permissions-Policy（2026-11-24）\n\n> 本階段僅擴充共用 Express 回應 Middleware，沒有修改應用授權流程、資料庫或前端任務狀態資料流。\n\n- **位置：** `server/server.js` 的 `createApp()` 共用 Middleware；沿用 M10-A4 的 `nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy` 及 `/api` `Cache-Control: no-store`。\n- **CSP 基線：** `base-uri 'self'` 限制 Base URL；`object-src 'none'` 禁止 Object 類型載入；`frame-ancestors 'none'` 限制嵌入；`form-action 'self'` 約束表單提交。`frame-ancestors` 在 HTTP 回應中設定，不以 HTML meta 取代。\n- **Permissions-Policy：** `camera=(), microphone=(), geolocation=()`，不對未使用的敏感瀏覽器能力授權。\n- **相容界線：** 尚未定義 `default-src`、`script-src`、`style-src`、`connect-src` 等完整資源來源政策，故不會因本節新增而封鎖既有頁面腳本、樣式或 Socket.IO 連線；其餘來源政策需另案分析並在正式部署環境驗證。\n- **驗收方式：** `tests/security-policy.test.js` 以隔離 HTTP 應用檢查安全標頭及 API 行為；完整 Node 336/336、Microsoft Edge E2E 110/110 PASS 代表既定路徑正常，不能替代正式 CSP report-only／違規監測或 TLS 測試。\n- **後續安全階段：** 登入防濫用、Session／Cookie、HTTPS／HSTS、可信代理、秘密管理和完整 CSP 相容性檢查仍為發版門檻。\n\n---",
  "docs/DEVELOPMENT_LOG.md": "## M10-A5a｜基礎 CSP／Permissions-Policy 開發及驗收（2026-11-24）\n\n### 本次實作\n\n1. 承接已 GitHub 結案的 M10-A4 Commit `712b432`；下載並解壓 `TaskFlow-M10A5a-Security-Policy-Kit`，兩個必要 JS 檔案的 `Test-Path` 均為 True。\n2. `scripts/apply-m10a5a.js` 通過 `node --check`，`--dry-run` 顯示僅更新 `server/server.js`。執行 `--apply` 後備份原檔，再以 `--verify` 核對完整標記並確認重複 `--dry-run` 不再寫入。\n3. 新增 CSP 四個基礎指令與 Permissions-Policy 三項停用權限；未改動 Task REST Payload、Socket.IO、Session／CSRF、SQLite Schema 或 Git 既有歷史。\n4. 使用者本機執行 `node --test tests/security-policy.test.js` 5/5 PASS、`npm test` 336/336 PASS，隨後全體 Edge E2E 110/110 PASS；fail、skipped、cancelled 均 0。\n\n### 工程結論及限制\n\n- **已驗證：** 基礎政策標頭及目前既定的 Node／Edge 回歸情境。\n- **未驗證：** 完整 CSP 來源限制、正式 HTTPS／HSTS、反暴力破解／代理部署、秘密管理與資料庫備份還原。Edge E2E 不等於全面 CSP 安全稽核。\n- **文件／Git：** 本節建立時尚未執行 M10-A5a Commit／Push；須精準暫存本次程式、測試、六份文件與文件工具，再檢查 SHA。\n- **產品化後續：** M10-A5b 身分與 Session 防護、M10-A5c 部署安全前置檢查，接著 M10-B 備份復原與正式 Release Gate。M9-C3 手機／無障礙維持 Deferred / Not Verified。\n\n---",
  "docs/PROJECT_PLAN.md": "## M10-A5a｜安全政策子階段驗收與發布待辦（2026-11-24）\n\n> 以下為最新階段快照；下方歷史區塊的「尚未開始」和「待 Git」僅表示當時狀態。`v1.0.0` 尚未發布。\n\n| 工作項目 | 當前狀態 | 依據／限制 |\n| --- | --- | --- |\n| M10-A4 HTTP 基礎安全標頭 | **GitHub 已結案** | Commit `712b432`、本機與遠端 SHA 相同 |\n| M10-A5a CSP 基礎四指令 | **實作及既定測試通過** | `base-uri`、`object-src`、`frame-ancestors`、`form-action` |\n| M10-A5a Permissions-Policy | **實作及既定測試通過** | camera／microphone／geolocation 停用 |\n| M10-A5a Node 專項 | **5/5 PASS** | `tests/security-policy.test.js`，包含於完整 Node 測試 |\n| 完整 Node 回歸 | **336/336 PASS** | `npm test`；0 fail／skipped／cancelled |\n| 完整 Edge E2E | **110/110 PASS** | 所有 `e2e/*.e2e.js` 依序執行 |\n| M10-A5a 六份文件及 Git | **結案中** | 增量工具、精準 staging、Commit／Push、遠端 SHA 核對 |\n| M10-A5b／A5c | **尚未驗證** | 登入／Session、完整 CSP、HTTPS／HSTS、正式代理環境 |\n| M10-B～Release | **尚未完成** | 備份、還原、部署及 v1.0.0 Release |\n\n### M10-A5a 結案檢核\n\n- [x] 安全基線增量套用、`--verify`、冪等 `--dry-run` 通過。\n- [x] Node 安全專項 5/5、完整 Node 336/336、全體 Edge E2E 110/110 PASS。\n- [ ] 六份文件增量紀錄及工具測試通過。\n- [ ] 精準 Git 暫存、`git diff --cached --check` 與差異審查。\n- [ ] Commit／Push 成功，`HEAD` 與 `origin/main` 完整 SHA 一致。\n\n> 未驗證項目不可勾選通過；不得將此階段寫成完整 CSP 或正式環境安全結案。\n\n---",
  "docs/TESTING.md": "## M10-A5a｜基礎 CSP／Permissions-Policy 自動化驗收（2026-11-24）\n\n> 依使用者本機 PowerShell 截圖記錄，並保留過往歷史結果；測試通過數量不是程式碼覆蓋率，也不能取代正式安全稽核。\n\n| 範圍 | 實際結果 | 證據／限制 |\n| --- | --- | --- |\n| `node --check scripts/apply-m10a5a.js` | **PASS** | 無語法錯誤輸出 |\n| `scripts/apply-m10a5a.js --apply/--verify/--dry-run` | **PASS** | 只修改 `server/server.js`、保留備份、再次執行跳過 |\n| `node --check server/server.js` | **PASS** | 增量更新後可正常解析 |\n| `node --test tests/security-policy.test.js` | **5/5 PASS** | 首頁 CSP／Permissions、Health 200／no-store、未知 API 404／政策、本機 HSTS 行為 |\n| `npm test` | **336/336 PASS** | fail 0／cancelled 0／skipped 0 |\n| 全體 Edge E2E | **110/110 PASS** | 以 `node --test --test-concurrency=1` 依序執行所有 `*.e2e.js` |\n| 公網 TLS／HSTS、全面 CSP 驗證 | **NOT RUN** | 當前僅基礎 CSP，尚未設定完整來源限制 |\n| M9-C3 手機／鍵盤／無障礙 | **Deferred / Not Verified** | 延續已知保留事項 |\n\n### 重現指令\n\n```powershell\nnode --test .\\tests\\security-policy.test.js\nnpm test\n$e2eFiles = @(Get-ChildItem .\\e2e -Filter \"*.e2e.js\" -File | Sort-Object Name | ForEach-Object { $_.FullName })\nnode --test --test-concurrency=1 $e2eFiles\n```\n\n- 5/5 Node 專項**包含在** 336/336 完整 Node 中，不能重複算成 341；Node 336 與 Edge 110 為兩組測試計數。\n- 全部 Edge 綠燈表示既定瀏覽器互動測試通過，並未直接證明所有 CSP 資源違規、正式 HTTPS、Session 生產環境、滲透測試或可用性符合標準。\n- M10-A5a 文件工具相關測試需完成後補充本節以外的執行證據，不預先宣告已通過或 Git Push 已完成。\n\n---"
};

function count(text,needle){return text.split(needle).length-1;}
function normalize(text,eol){return text.replace(/\r?\n/g,"\n").replace(/\n/g,eol);}
function planContent(file,buffer){
  if(!Object.prototype.hasOwnProperty.call(BLOCKS,file)) throw new Error("未知文件："+file);
  const original=Buffer.from(buffer);
  const hasBom=original.length>=3&&original[0]===239&&original[1]===187&&original[2]===191;
  const raw=original.toString("utf8");
  const text=hasBom?raw.slice(1):raw;
  const eol=text.includes("\r\n")?"\r\n":"\n";
  if(count(text,START)>1||count(text,END)>1) throw new Error(file+" 有重複文件標記，拒絕覆寫");
  if(count(text,START)!==count(text,END)) throw new Error(file+" 文件標記不完整，拒絕覆寫");
  const expected=normalize(START+"\n\n"+BLOCKS[file]+"\n\n"+END,eol);
  if(text.includes(START)){
    const a=text.indexOf(START),b=text.indexOf(END)+END.length;
    if(text.slice(a,b)!==expected) throw new Error(file+" 標記內容遭修改，拒絕覆寫");
    return {changed:false,original,next:original};
  }
  const header=/^# [^\r\n]+\r?\n/.exec(text);
  if(!header) throw new Error(file+" 無預期頂層 Markdown 標題，拒絕覆寫");
  let pos=header[0].length;
  if(file==="CHANGELOG.md"){
    const unreleased=/^## \[Unreleased\]\r?\n/m.exec(text);
    if(!unreleased) throw new Error("CHANGELOG.md 缺少 Unreleased，拒絕覆寫");
    pos=unreleased.index+unreleased[0].length;
  }
  const updated=text.slice(0,pos)+eol+expected+eol+eol+text.slice(pos);
  return {changed:true,original,next:Buffer.from((hasBom?"\ufeff":"")+updated,"utf8")};
}
function checkRepo(repo){
  const pkgFile=path.join(repo,"package.json");
  if(!fs.existsSync(pkgFile))throw new Error("package.json 不存在");
  const pkg=JSON.parse(fs.readFileSync(pkgFile,"utf8"));
  if(pkg.name!=="taskflow") throw new Error("不是 TaskFlow 專案");
  for(const name of [...FILES,"server/server.js","scripts/apply-m10a5a.js","tests/security-policy.test.js"]){
    const full=path.join(repo,name);
    if(!fs.existsSync(full)||!fs.statSync(full).isFile()) throw new Error("必要檔案不存在："+name);
  }
  const server=fs.readFileSync(path.join(repo,"server/server.js"),"utf8");
  for(const header of ["Content-Security-Policy","Permissions-Policy","TASKFLOW-M10A5A-HEADERS-BEGIN","TASKFLOW-M10A5A-HEADERS-END"]){
    if(!server.includes(header)) throw new Error("M10-A5a 安全設定尚未就緒："+header);
  }
}
function closeDocs(repo,mode,logger=console.log){
  checkRepo(repo);
  const plans=FILES.map(file=>{
    const full=path.join(repo,file);
    return {file,full,...planContent(file,fs.readFileSync(full))};
  });
  if(mode==="--verify"){
    if(plans.some(p=>p.changed))throw new Error("尚有文件未加入 M10-A5a 紀錄，驗證失敗");
    for(const p of plans)logger("[已核對] "+p.file);
    logger("M10-A5a 六份文件標記與內容驗證通過；未寫入檔案。");return;
  }
  if(mode==="--dry-run"){
    for(const p of plans)logger("[預覽] "+p.file+": "+(p.changed?"需要增量更新":"已存在，跳過"));
    logger("Dry run 完成；未寫入檔案。");return;
  }
  const pending=plans.filter(p=>p.changed);
  if(!pending.length){logger("M10-A5a 六份文件均已存在；跳過，未寫入檔案。");return;}
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),"TaskFlow-M10A5a-docs-"));
  const touched=[];
  try{
    for(const p of plans){const dest=path.join(backup,p.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(p.full,dest,fs.constants.COPYFILE_EXCL);}
    for(const p of pending){fs.writeFileSync(p.full,p.next);touched.push(p);logger("[已更新] "+p.file);}
  }catch(err){for(const p of touched)fs.writeFileSync(p.full,p.original);throw new Error("更新失敗，已嘗試復原："+err.message);}
  logger("原始六份文件備份："+backup);
  logger("M10-A5a 文件更新完成（本次寫入 "+pending.length+" 份）；尚未 Git Commit/Push。");
}
if(require.main===module){
  try{
    const mode=process.argv[2]||"--dry-run";
    if(!["--dry-run","--apply","--verify"].includes(mode)||process.argv.length>3)throw new Error("請使用 --dry-run／--apply／--verify");
    closeDocs(PROJECT,mode);
  }catch(err){console.error("M10-A5a 文件工具安全中止："+err.message);process.exitCode=1;}
}
module.exports={FILES,BLOCKS,START,END,planContent,closeDocs};
