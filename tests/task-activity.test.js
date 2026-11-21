"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PAGE_SIZE, positiveId, activityUrl, activityLabel, normalizeActivities, fetchActivities,
} = require("../public/task-activity");

test("M8-C2 activity module", async (t) => {
  await t.test("預設分頁 20 筆與正確路徑", () => {
    assert.equal(PAGE_SIZE, 20);
    assert.equal(activityUrl(3), "/api/projects/3/activity?limit=20");
  });
  await t.test("beforeId 游標與 limit", () => {
    assert.equal(activityUrl(5, 47, 10), "/api/projects/5/activity?limit=10&beforeId=47");
  });
  await t.test("拒絕無效 ID 與 limit", () => {
    for (const id of [-1, 0, "03", 1.5, "abc", Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => positiveId(id));
    }
    assert.throws(() => activityUrl(1, null, 101));
    assert.throws(() => activityUrl(1, 0));
  });
  await t.test("依 API action 顯示三類活動", () => {
    assert.equal(activityLabel("comment_created"), "新增了任務留言");
    assert.equal(activityLabel("comment_updated"), "編輯了任務留言");
    assert.equal(activityLabel("comment_deleted"), "刪除了任務留言");
  });
  await t.test("未知事件保持保守描述", () => {
    assert.equal(activityLabel("task_moved"), "進行了一項專案操作");
  });
  await t.test("拒絕不正確的 response body", () => {
    assert.throws(() => normalizeActivities({ activities: null }));
    assert.throws(() => normalizeActivities({ activities: [null] }));
    assert.throws(() => normalizeActivities({ activities: [{ id: 0, action: "x" }] }));
  });
  await t.test("GET 不傳 CSRF / Cookie Token", async () => {
    let captured;
    const items = [{ id: 2, action: "comment_created" }];
    const fetched = await fetchActivities(async (url, options) => {
      captured = { url, options };
      return { status: 200, ok: true, json: async () => ({ activities: items }) };
    }, 1, 7);
    assert.deepEqual(fetched, items);
    assert.equal(captured.url, "/api/projects/1/activity?limit=20&beforeId=7");
    assert.equal(captured.options.credentials, "same-origin");
    assert.equal(captured.options.cache, "no-store");
    assert.equal("headers" in captured.options, false);
  });
  await t.test("401 會通知 Session 失效", async () => {
    let called = false;
    await assert.rejects(fetchActivities(async () => ({
      status: 401, ok: false, json: async () => ({ message: "請先登入" }),
    }), 2, null, () => { called = true; }), /請先登入/);
    assert.equal(called, true);
  });
  await t.test("403/404 等錯誤不視為成功", async () => {
    for (const status of [403, 404, 500]) {
      await assert.rejects(fetchActivities(async () => ({
        status, ok: false, json: async () => null,
      }), 2), (e) => e.status === status);
    }
  });
});
