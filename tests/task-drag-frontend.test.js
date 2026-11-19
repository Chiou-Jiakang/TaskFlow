"use strict";

// M6-C：前端靜態守衛。真實滑鼠拖放及多 Session 流程在 M6-D E2E 驗收。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");
const read = (name) => fs.readFileSync(path.join(publicDir, name), "utf8");

test("M6-C Kanban drag & drop frontend smoke tests", async (t) => {
  const js = read("task-board.js");
  const css = read("task-board.css");
  const html = read("index.html");

  await t.test("保留 M5 任務表單、專案選擇器與 Kanban 三欄", () => {
    for (const id of [
      "task-project-select", "task-form", "task-submit", "task-assignee",
      "task-due", "task-board-heading", "task-message",
    ]) {
      assert.ok(html.includes(`id="${id}"`), `缺少 ${id}`);
    }
    for (const status of ["todo", "progress", "done"]) {
      assert.ok(html.includes(`data-status="${status}"`));
    }
  });

  await t.test("只由 Owner/Admin 在 active 專案啟用拖放", () => {
    assert.match(js, /\["owner", "admin"\]\.includes\(state\.project\.myRole\)/);
    assert.match(js, /state\.project\?\.status === "active"/);
    assert.match(js, /card\.draggable = canMove\(\)/);
    assert.match(js, /if \(!canMove\(\)/);
  });

  await t.test("前端使用原生 dragstart / dragover / drop / dragend", () => {
    for (const event of ["dragstart", "dragover", "drop", "dragend"]) {
      assert.ok(js.includes(`"${event}"`), `缺少 ${event}`);
    }
    assert.match(js, /dataTransfer\.setData\("text\/plain"/);
    assert.match(js, /dropIndex\(section, event\.clientY\)/);
    assert.match(js, /\.getBoundingClientRect\(\)/);
  });

  await t.test("排序使用 M6-B move API，帶入 version/status/index 及 CSRF", () => {
    assert.match(js, /`\$\{taskUrl\(task\.id\)\}\/move`/);
    assert.match(js, /writeOptions\("PATCH", \{/);
    for (const field of ["version: task.version", "status,", "index,"]) {
      assert.ok(js.includes(field));
    }
    assert.match(js, /"X-TaskFlow-CSRF": state\.csrf/);
    assert.match(js, /credentials: "same-origin"/);
  });

  await t.test("409 時刷新後端資料，不做樂觀排序", () => {
    assert.match(js, /error\.status === 409/);
    assert.match(js, /await refresh\(\)/);
    assert.match(js, /state\.tasks = taskData\.tasks/);
    assert.match(js, /remaining = columnTasks\(status\)\.filter/);
  });

  await t.test("Member 保有個人狀態權限，但不取得排序權限", () => {
    assert.match(js, /task\.assigneeId === state\.user\?\.id/);
    assert.match(js, /if \(isManager\(\)\) \{/);
    assert.match(js, /"任務狀態已更新。"/);
    assert.match(js, /button\("上移"/);
    assert.match(js, /button\("下移"/);
  });

  await t.test("拖曳提示、鍵盤替代控制及樣式存在", () => {
    for (const token of ["tf-drop-before", "tf-drop-at-end", "tf-dragging", "tf-drag-hint", "tf-drag-instructions"]) {
      assert.ok(js.includes(token), `JS 缺少 ${token}`);
      assert.ok(css.includes(token), `CSS 缺少 ${token}`);
    }
  });

  await t.test("不使用危險 HTML 注入或持久化 Session Token", () => {
    assert.doesNotMatch(js, /\.innerHTML\s*=/);
    assert.doesNotMatch(js, /\b(?:localStorage|sessionStorage)\s*\./);
    assert.match(js, /\.textContent\s*=/);
    assert.match(js, /state\.busy/);
  });
});
