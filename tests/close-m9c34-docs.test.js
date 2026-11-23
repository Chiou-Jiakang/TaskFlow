"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {START, END, DOCS, SECTIONS, planDoc, run} = require("../scripts/close-m9c34-docs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tf-m9c34-test-"));
  fs.writeFileSync(path.join(root,"package.json"), JSON.stringify({name:"taskflow"}));
  for (const f of ["public/style.css", "public/index.html", "e2e/task-consistency.e2e.js"]) {
    fs.mkdirSync(path.dirname(path.join(root,f)), {recursive:true});
    fs.writeFileSync(path.join(root,f), "fixture");
  }
  for (const rel of DOCS) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive:true});
    const first = rel === "CHANGELOG.md" ? "# TaskFlow Changelog\r\n\r\n## [Unreleased]\r\n\r\n" : "# TaskFlow Historical notes\r\n\r\n";
    const previous = "<!-- TASKFLOW-M9C2-DOCS-2026-11-23 -->\r\n歷史內容必須保留\r\n<!-- /TASKFLOW-M9C2-DOCS-2026-11-23 -->\r\n";
    fs.writeFileSync(path.join(root, rel), "\ufeff" + first + previous, "utf8");
  }
  return root;
}

test("M9-C3/C4 六份文件增量寫入，保留原有內容、BOM 與 CRLF", t => {
  const root=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const before=DOCS.map(f=>fs.readFileSync(path.join(root,f),"utf8"));
  const out=run(root); assert.equal(out.written,6); assert.ok(out.backup);
  for (let i=0;i<DOCS.length;i++) {
    const rel=DOCS[i], text=fs.readFileSync(path.join(root,rel),"utf8");
    assert.ok(text.startsWith("\ufeff"));
    assert.match(text,/歷史內容必須保留/);
    assert.equal(text.split(START).length-1,1);
    assert.equal(text.split(END).length-1,1);
    assert.ok(text.includes(SECTIONS[rel].trim().split("\n")[0]));
    assert.ok(text.indexOf(START) < text.indexOf("TASKFLOW-M9C2-DOCS"));
    assert.ok(text.includes("\r\n"));
    assert.equal(fs.readFileSync(path.join(out.backup,rel),"utf8"),before[i]);
  }
});

test("Dry run、verify 與重複套用均不覆蓋文件", t => {
  const root=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const f=path.join(root,"README.md"), before=fs.readFileSync(f,"utf8");
  assert.equal(run(root,{dryRun:true}).written,0);
  assert.equal(fs.readFileSync(f,"utf8"),before);
  assert.throws(()=>run(root,{verify:true}),/未更新/);
  assert.equal(run(root).written,6);
  const done=fs.readFileSync(f,"utf8");
  assert.equal(run(root,{verify:true}).written,0);
  assert.equal(run(root).written,0);
  assert.equal(run(root,{dryRun:true}).written,0);
  assert.equal(fs.readFileSync(f,"utf8"),done);
});

test("損壞、重複與被人工更改的標記會安全拒絕", () => {
  const original="# TaskFlow\n<!-- TASKFLOW-M9C2-DOCS-2026-11-23 -->\nOld\n<!-- /TASKFLOW-M9C2-DOCS-2026-11-23 -->\n";
  assert.throws(()=>planDoc("README.md",original+START),/標記/);
  const applied=planDoc("README.md",original).result;
  assert.throws(()=>planDoc("README.md",applied.replace("M9-C3 暫緩驗收", "M9-C3 人工變更")),/人工審核/);
  assert.throws(()=>planDoc("README.md",original.replace("<!-- /TASKFLOW-M9C2-DOCS-2026-11-23 -->","")),/M9-C2/);
  assert.throws(()=>planDoc("private.txt", original),/白名單/);
});

test("非預期的專案根目錄或缺少資產不得寫入", t => {
  const root=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.rmSync(path.join(root,"public/style.css"));
  assert.throws(()=>run(root),/缺少必要基準檔案/);
  assert.equal(fs.readFileSync(path.join(root,"README.md"),"utf8").includes(START),false);
});

test("所有文件明示未驗證風險，不宣稱正式發布", () => {
  for (const rel of DOCS) {
    assert.match(SECTIONS[rel],/Deferred \/ Not Verified|暫緩|未驗證|未實測/);
    assert.match(SECTIONS[rel],/M10|v1\.0\.0/);
  }
  assert.match(SECTIONS["docs/PROJECT_PLAN.md"],/\[ \] Git|Commit／Push|Git Commit／Push/);
});
