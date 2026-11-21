"use strict";
// All tests use a temporary fake TaskFlow tree; never touch the user's real project/SQLite/Git.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const sourceScript = path.resolve(__dirname, "../scripts/close-m8-docs.js");
const paths = [
  "README.md", "CHANGELOG.md", "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md", "docs/PROJECT_PLAN.md", "docs/TESTING.md",
];
const marker = "<!-- TASKFLOW-M7-CLOSEOUT-2026-11-19 -->";
function fixture({ eol = "\n", bom = "" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "M8-doc-script-fixture-"));
  fs.mkdirSync(path.join(root,"scripts"),{recursive:true});
  fs.copyFileSync(sourceScript,path.join(root,"scripts","close-m8-docs.js"));
  for(const rel of paths){
    const target=path.join(root,...rel.split("/"));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const head = rel === "CHANGELOG.md" ? "# TaskFlow｜更新日誌\n\n## [Unreleased]\n\n舊資料" : "# TaskFlow｜歷史標題\n\n舊資料";
    const text = bom + (head + "\n\n"+marker+"\n歷史 M7 內容\n<!-- /TASKFLOW-M7-CLOSEOUT-2026-11-19 -->\n").replace(/\n/g,eol);
    fs.writeFileSync(target,text,"utf8");
  }
  return root;
}
function run(root,args=[],expectSuccess=true){
  const p=spawnSync(process.execPath,[path.join(root,"scripts","close-m8-docs.js"),...args],{encoding:"utf8",timeout:15000});
  if(expectSuccess)assert.equal(p.status,0,p.stderr+"\n"+p.stdout);
  else assert.notEqual(p.status,0);
  return p.stdout+p.stderr;
}
function clean(root){fs.rmSync(root,{recursive:true,force:true});}

test("M8-D dry-run 不變更六份文件",()=>{
 const root=fixture();
 try{
   const before=paths.map(p=>fs.readFileSync(path.join(root,p),"utf8"));
   assert.match(run(root,["--dry-run"]),/6 份待更新/);
   assert.deepEqual(paths.map(p=>fs.readFileSync(path.join(root,p),"utf8")),before);
 }finally{clean(root);}
});

test("首次執行更新六份文件，歷史保留且標記只出現一次",()=>{
 const root=fixture();
 try{
   const out=run(root);
   assert.match(out,/六份原始文件備份位置/);
   for(const rel of paths){
     const data=fs.readFileSync(path.join(root,rel),"utf8");
     assert.ok(data.includes("舊資料"));
     assert.ok(data.includes(marker));
     assert.equal(data.split("<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->").length-1,1);
     assert.equal(data.split("<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->").length-1,1);
   }
   const log=fs.readFileSync(path.join(root,"docs/DEVELOPMENT_LOG.md"),"utf8");
   assert.ok(log.indexOf(marker)<log.indexOf("<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->"));
   const change=fs.readFileSync(path.join(root,"CHANGELOG.md"),"utf8");
   assert.ok(change.indexOf("## [Unreleased]")<change.indexOf("M8 —"));
   assert.ok(change.indexOf("M8 —")<change.indexOf("舊資料"));
 }finally{clean(root);}
});

test("重複執行跳過、不產生第二份紀錄",()=>{
 const root=fixture();
 try{
   run(root);
   const first=paths.map(p=>fs.readFileSync(path.join(root,p),"utf8"));
   assert.match(run(root),/無需重寫/);
   assert.deepEqual(paths.map(p=>fs.readFileSync(path.join(root,p),"utf8")),first);
 }finally{clean(root);}
});

test("維持原始 CRLF 與 UTF-8 BOM",()=>{
 const root=fixture({eol:"\r\n",bom:"\ufeff"});
 try{
   run(root);
   for(const rel of paths){
    const data=fs.readFileSync(path.join(root,rel),"utf8");
    assert.ok(data.startsWith("\ufeff#"),rel);
    assert.equal(data.replace(/\r\n/g,"").includes("\n"),false,rel);
   }
 }finally{clean(root);}
});

test("遇到文件部分標記或缺少 M7 錨點，全面停止且不寫任何文件",()=>{
 const root=fixture();
 try{
   const broken=path.join(root,"docs","TESTING.md");
   fs.appendFileSync(broken,"\n<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\n");
   const first=paths.map(p=>fs.readFileSync(path.join(root,p),"utf8"));
   assert.match(run(root,[],false),/只找到一側 M8 標記/);
   assert.deepEqual(paths.map(p=>fs.readFileSync(path.join(root,p),"utf8")),first);
 }finally{clean(root);}
});

test("缺少文件時不寫入其餘五份",()=>{
 const root=fixture();
 try{
   fs.unlinkSync(path.join(root,"docs","ARCHITECTURE.md"));
   assert.match(run(root,[],false),/不存在/);
   for(const rel of paths.filter(x=>x!=="docs/ARCHITECTURE.md")){
      assert.ok(!fs.readFileSync(path.join(root,rel),"utf8").includes("TASKFLOW-M8-CLOSEOUT-2026-11-21"));
   }
 }finally{clean(root);}
});
