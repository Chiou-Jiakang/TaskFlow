"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {FILES,START,END,planContent,closeDocs}=require("../scripts/close-m10a5a-docs");

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"TaskFlow-M10A5a-test-"));
  fs.writeFileSync(path.join(root,"package.json"),JSON.stringify({name:"taskflow"}));
  for(const file of [...FILES,"server/server.js","scripts/apply-m10a5a.js","tests/security-policy.test.js"]){
    const loc=path.join(root,file);fs.mkdirSync(path.dirname(loc),{recursive:true});
    let src="# TaskFlow 測試文件\n\n既有歷史紀錄\n";
    if(file==="CHANGELOG.md")src="# TaskFlow 更新日誌\n\n## [Unreleased]\n\n原有變更\n";
    if(file==="server/server.js")src="// TASKFLOW-M10A5A-HEADERS-BEGIN\n// Content-Security-Policy\n// Permissions-Policy\n// TASKFLOW-M10A5A-HEADERS-END\n";
    fs.writeFileSync(loc,src);
  }
  return root;
}

test("M10-A5a 六份文件只增量寫入，保留歷史",()=>{
  const repo=fixture();try{
    const before=Object.fromEntries(FILES.map(f=>[f,fs.readFileSync(path.join(repo,f),"utf8")]));
    closeDocs(repo,"--apply",()=>{});
    for(const f of FILES){const now=fs.readFileSync(path.join(repo,f),"utf8");assert.ok(now.includes(before[f].split("\n").at(-2)));assert.equal(now.split(START).length,2);assert.equal(now.split(END).length,2);}
    closeDocs(repo,"--verify",()=>{});
  }finally{fs.rmSync(repo,{recursive:true,force:true});}
});

test("M10-A5a dry-run 不寫入且重複 apply 冪等",()=>{
  const repo=fixture();try{
    const f=path.join(repo,"README.md");const before=fs.readFileSync(f);
    closeDocs(repo,"--dry-run",()=>{});assert.deepEqual(fs.readFileSync(f),before);
    closeDocs(repo,"--apply",()=>{});const once=fs.readFileSync(f);
    closeDocs(repo,"--apply",()=>{});assert.deepEqual(fs.readFileSync(f),once);
    closeDocs(repo,"--dry-run",()=>{});assert.deepEqual(fs.readFileSync(f),once);
  }finally{fs.rmSync(repo,{recursive:true,force:true});}
});

test("M10-A5a 保留 UTF-8 BOM 與 CRLF",()=>{
  const data=Buffer.from("\ufeff# TaskFlow 測試\r\n\r\n原始內容\r\n","utf8");
  const p=planContent("README.md",data);
  assert.equal(p.changed,true);
  const out=p.next.toString("utf8");
  assert.ok(out.startsWith("\ufeff# TaskFlow 測試\r\n"));
  assert.equal(/(?<!\r)\n/.test(out),false);
  assert.ok(out.includes("原始內容\r\n"));
  assert.equal(planContent("README.md",p.next).changed,false);
});

test("M10-A5a 損壞、重複或篡改標記時拒絕覆蓋",()=>{
  for(const bad of [
    "# 標題\n"+START+"\n",
    "# 標題\n"+START+START+END,
    "# 標題\n"+START+"\n被修改\n"+END,
  ])assert.throws(()=>planContent("README.md",Buffer.from(bad)),/標記|覆寫/);
});

test("M10-A5a 非預期專案結構在寫入前停止",()=>{
  const repo=fixture();try{
    fs.rmSync(path.join(repo,"server/server.js"));
    const before=fs.readFileSync(path.join(repo,"README.md"));
    assert.throws(()=>closeDocs(repo,"--apply",()=>{}),/必要檔案不存在/);
    assert.deepEqual(fs.readFileSync(path.join(repo,"README.md")),before);
  }finally{fs.rmSync(repo,{recursive:true,force:true});}
});
