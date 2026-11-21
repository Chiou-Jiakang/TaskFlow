"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DOCS, START, END, planDoc, makePlan, apply } = require("../scripts/close-m9a-docs");
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "TaskFlow-M9A-fixture-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "taskflow" }));
  for (const rel of DOCS) {
    const dst = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const original = rel === "CHANGELOG.md"
      ? "# TaskFlow｜更新日誌\n\n## [Unreleased]\n\n<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\n舊版保留\n<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\n"
      : `# TaskFlow｜${rel}\n\n<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\n舊版保留\n<!-- /TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\n`;
    fs.writeFileSync(dst, original, "utf8");
  }
  return root;
}
function dispose(root) { fs.rmSync(root, { recursive: true, force: true }); }

test("M9-A 有且只有六份文件的白名單", () => {
  assert.equal(DOCS.length, 6);
  assert.equal(new Set(DOCS).size, 6);
  assert.ok(DOCS.every(x => x.endsWith(".md")));
});
test("正常預覽六份文件不寫入任何內容", (t) => {
  const root = fixture(); t.after(() => dispose(root));
  const before = Object.fromEntries(DOCS.map(x => [x, fs.readFileSync(path.join(root,x),"utf8")]));
  const p = apply(root, { dryRun: true });
  assert.equal(p.written, 0); assert.equal(p.plans.filter(x=>x.changed).length,6);
  for (const x of DOCS) assert.equal(fs.readFileSync(path.join(root,x),"utf8"), before[x]);
});
test("正式寫入後六份標記完整且保留 M8 歷史", (t) => {
  const root = fixture(); t.after(() => dispose(root));
  const result = apply(root);
  assert.equal(result.written,6); assert.ok(fs.statSync(result.backup).isDirectory());
  for (const rel of DOCS) {
    const text = fs.readFileSync(path.join(root,rel),"utf8");
    assert.equal(text.split(START).length-1,1); assert.equal(text.split(END).length-1,1);
    assert.match(text,/舊版保留/);
    assert.ok(text.indexOf(START)<text.indexOf("TASKFLOW-M8-CLOSEOUT-2026-11-21"));
    assert.ok(fs.existsSync(path.join(result.backup,rel)));
  }
  fs.rmSync(result.backup,{recursive:true,force:true});
});
test("重複執行完全 idempotent 且不再建立備份", (t) => {
  const root=fixture(); t.after(()=>dispose(root));
  const first=apply(root); fs.rmSync(first.backup,{recursive:true,force:true});
  const before=DOCS.map(x=>fs.readFileSync(path.join(root,x),"utf8"));
  const second=apply(root);
  assert.equal(second.written,0); assert.equal(second.backup,null);
  assert.deepEqual(DOCS.map(x=>fs.readFileSync(path.join(root,x),"utf8")),before);
});
test("Verify 需六份都有標記才通過", (t) => {
  const root=fixture(); t.after(()=>dispose(root));
  assert.throws(()=>apply(root,{verify:true}),/6 份文件未套用/);
  const a=apply(root);fs.rmSync(a.backup,{recursive:true,force:true});
  assert.doesNotThrow(()=>apply(root,{verify:true}));
});
test("缺少 M8 錨點時拒絕寫入並保留檔案", (t) => {
  const root=fixture();t.after(()=>dispose(root));
  const bad=path.join(root,"docs/TESTING.md");
  fs.writeFileSync(bad,"# TaskFlow｜測試\n無 M8\n");
  const before=DOCS.map(x=>fs.readFileSync(path.join(root,x),"utf8"));
  assert.throws(()=>apply(root),/缺少 M8/);
  assert.deepEqual(DOCS.map(x=>fs.readFileSync(path.join(root,x),"utf8")),before);
});
test("不完整或重複的 M9-A 標記一律拒絕", () => {
  const source="# TaskFlow\n\n<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\n";
  assert.throws(()=>planDoc("README.md",source+START),/不成對/);
  assert.throws(()=>planDoc("README.md",source+START+END+START+END),/重複/);
});
test("保持原本 CRLF 與 UTF-8 BOM", () => {
  const src="\ufeff# TaskFlow｜README\r\n\r\n<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->\r\n舊版\r\n";
  const result=planDoc("README.md",src);
  assert.ok(result.result.startsWith("\ufeff# TaskFlow"));
  assert.equal(result.result.replace(/\r\n/g,"").includes("\n"), false);
});
test("CHANGELOG 段落插在 Unreleased 之下", () => {
  const src="# TaskFlow 更新日誌\n\n## [Unreleased]\n\n<!-- TASKFLOW-M8-CLOSEOUT-2026-11-21 -->";
  const out=planDoc("CHANGELOG.md",src).result;
  assert.ok(out.indexOf(START)>out.indexOf("## [Unreleased]"));
  assert.ok(out.indexOf(START)<out.indexOf("TASKFLOW-M8-CLOSEOUT-2026-11-21"));
});
test("任何不在白名單的路徑均不得更新", () => {
  assert.throws(()=>planDoc("data/taskflow.db", "# TaskFlow"),/非允許/);
});
