"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {DOCS, START, END, SECTIONS, planDoc, apply} = require("../scripts/close-m9c1-docs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "taskflow-m9c1-test-"));
  fs.writeFileSync(path.join(root,"package.json"), '{"name":"taskflow"}', "utf8");
  const required = ["public/task-board.js", "public/task-ux.css", "scripts/apply-m9c1.js", "tests/apply-m9c1.test.js", "e2e/task-ux.e2e.js"];
  for (const file of required) {
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
    fs.writeFileSync(path.join(root,file),"fixture", "utf8");
  }
  for (const rel of DOCS) {
    fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});
    let content = rel === "CHANGELOG.md" ? "# TaskFlow Changelog\r\n\r\n## [Unreleased]\r\n\r\n" : "# TaskFlow Project\r\n\r\n";
    content += "<!-- TASKFLOW-M9B-DOCS-2026-11-23 -->\r\nold history content\r\n<!-- /TASKFLOW-M9B-DOCS-2026-11-23 -->\r\n";
    fs.writeFileSync(path.join(root,rel),content,"utf8");
  }
  return root;
}

test("M9-C1 inserts sections in six documents with original history preserved", t => {
  const root = fixture(); t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const before = DOCS.map(x=>fs.readFileSync(path.join(root,x),"utf8"));
  const out=apply(root); assert.equal(out.written,6); assert.ok(out.backup);
  for(let i=0;i<DOCS.length;i++) {
    const cur=fs.readFileSync(path.join(root,DOCS[i]),"utf8");
    assert.match(cur,/old history content/);
    assert.equal(cur.split(START).length-1,1);
    assert.equal(cur.split(END).length-1,1);
    assert.ok(cur.includes(SECTIONS[DOCS[i]].trim().split("\n")[0]));
    assert.equal(cur.includes("\r\n"),true, "preserve Windows EOL");
    assert.equal(fs.readFileSync(path.join(out.backup,DOCS[i]),"utf8"),before[i]);
  }
  const changelog=fs.readFileSync(path.join(root,"CHANGELOG.md"),"utf8");
  assert.ok(changelog.indexOf("## [Unreleased]") < changelog.indexOf(START));
  assert.ok(changelog.indexOf(START) < changelog.indexOf("TASKFLOW-M9B"));
});

test("M9-C1 dry-run and verify never rewrite files", t => {
  const root=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const original=fs.readFileSync(path.join(root,"README.md"),"utf8");
  assert.equal(apply(root,{dryRun:true}).written,0);
  assert.equal(fs.readFileSync(path.join(root,"README.md"),"utf8"),original);
  assert.throws(()=>apply(root,{verify:true}),/尚未寫入/);
  apply(root);
  const after=fs.readFileSync(path.join(root,"README.md"),"utf8");
  assert.equal(apply(root,{dryRun:true}).written,0);
  assert.equal(apply(root).written,0);
  assert.equal(apply(root,{verify:true}).written,0);
  assert.equal(fs.readFileSync(path.join(root,"README.md"),"utf8"),after);
});

test("M9-C1 rejects damaged or edited markers instead of overwriting",()=>{
  const sample="# TaskFlow\n<!-- TASKFLOW-M9B-DOCS-2026-11-23 -->\n";
  assert.throws(()=>planDoc("README.md", sample+START),/標記/);
  const once=planDoc("README.md",sample).result;
  assert.throws(()=>planDoc("README.md",once.replace("M9-C1 看板 UX","M9-B 被改寫")),/人工審查/);
  assert.throws(()=>planDoc("other.md",sample),/允許/);
});

test("M9-C1 checks repo layout and required assets before writing",t=>{
  const root=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.rmSync(path.join(root,"public/task-ux.css"));
  assert.throws(()=>apply(root),/必要檔案/);
  assert.equal(fs.readFileSync(path.join(root,"README.md"),"utf8").includes(START),false);
});
