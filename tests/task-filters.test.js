"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { filterTasks } = require("../public/task-filters");

const tasks = [
  {
    id: 1,
    title: "修正登入錯誤",
    description: "處理 Session",
    status: "todo",
    priority: "high",
    assigneeId: 2,
  },
  {
    id: 2,
    title: "更新首頁",
    description: "改善排版",
    status: "in_progress",
    priority: "medium",
    assigneeId: null,
  },
  {
    id: 3,
    title: "撰寫測試",
    description: "驗證 Session",
    status: "done",
    priority: "low",
    assigneeId: 3,
  },
];

const ids = (items) => items.map((task) => task.id);

test("不設定條件時顯示所有任務", () => {
  assert.deepEqual(ids(filterTasks(tasks)), [1, 2, 3]);
});

test("搜尋中文任務標題", () => {
  assert.deepEqual(ids(filterTasks(tasks, { keyword: "登入" })), [1]);
});

test("搜尋描述且不區分英文大小寫", () => {
  assert.deepEqual(ids(filterTasks(tasks, { keyword: "SESSION" })), [1, 3]);
});

test("依任務狀態篩選", () => {
  assert.deepEqual(ids(filterTasks(tasks, { status: "done" })), [3]);
});

test("依優先度篩選", () => {
  assert.deepEqual(ids(filterTasks(tasks, { priority: "high" })), [1]);
});

test("依指定負責人篩選", () => {
  assert.deepEqual(ids(filterTasks(tasks, { assignee: "2" })), [1]);
});

test("篩選未指派任務", () => {
  assert.deepEqual(ids(filterTasks(tasks, { assignee: "unassigned" })), [2]);
});

test("多條件必須同時符合", () => {
  assert.deepEqual(
    ids(
      filterTasks(tasks, {
        keyword: "登入",
        status: "todo",
        priority: "high",
        assignee: "2",
      }),
    ),
    [1],
  );
});

test("無符合任務時回傳空陣列", () => {
  assert.deepEqual(filterTasks(tasks, { keyword: "不存在的任務" }), []);
});

test("篩選不得修改原始任務資料", () => {
  const before = structuredClone(tasks);

  filterTasks(tasks, {
    status: "todo",
    priority: "high",
  });

  assert.deepEqual(tasks, before);
});
