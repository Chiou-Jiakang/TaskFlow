"use strict";

// M8-C1：以 node:test 檢查 URL、權限顯示與真實 REST 請求形狀。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  commentsUrl, canEditComment, canDeleteComment, validateBody, createCommentsApi,
} = require("../public/task-comments");

const csrf = "a".repeat(64);
function mockResponse(status, data) {
  return { status, ok: status >= 200 && status < 300, json: async () => data };
}

test("M8-C1：路由必須使用兩個正整數 ID", () => {
  assert.equal(commentsUrl(8, 12), "/api/projects/8/tasks/12/comments");
  assert.equal(commentsUrl("8", "12", "3"), "/api/projects/8/tasks/12/comments/3");
  for (const invalid of [0, -1, 2.5, "0", "1e3", "0008", null, Infinity]) {
    assert.throws(() => commentsUrl(invalid, 4), /正整數/);
  }
});

test("M8-C1：留言文字驗證，不允許空白與超過 2000 字元", () => {
  assert.equal(validateBody("  哈囉  "), "哈囉");
  assert.throws(() => validateBody("  "), /1～2000/);
  assert.throws(() => validateBody("a".repeat(2001)), /1～2000/);
});

test("M8-C1：只能編輯自己的留言，管理員不可代編", () => {
  const comment = { id: 1, authorId: 9 };
  assert.equal(canEditComment(comment, 9, true), true);
  assert.equal(canEditComment(comment, 10, true), false);
  assert.equal(canEditComment(comment, 9, false), false);
});

test("M8-C1：作者及 Owner/Admin 可刪除；封存不可寫", () => {
  const comment = { id: 1, authorId: 9 };
  assert.equal(canDeleteComment(comment, 9, "member", true), true);
  assert.equal(canDeleteComment(comment, 8, "owner", true), true);
  assert.equal(canDeleteComment(comment, 8, "admin", true), true);
  assert.equal(canDeleteComment(comment, 8, "member", true), false);
  assert.equal(canDeleteComment(comment, 8, "owner", false), false);
});

test("M8-C1：GET 列表使用同源 Cookie、no-store、limit 與 beforeId", async () => {
  const calls = [];
  const api = createCommentsApi(async (url, init) => { calls.push({ url, init }); return mockResponse(200, { comments: [] }); });
  assert.deepEqual(await api.list(1, 2, 4), { comments: [] });
  assert.equal(calls[0].url, "/api/projects/1/tasks/2/comments?limit=30&beforeId=4");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.equal(calls[0].init.cache, "no-store");
  assert.ok(!calls[0].init.headers);
});

test("M8-C1：新增、修改及刪除請求嚴格符合 M8-B API", async () => {
  const calls = [];
  const api = createCommentsApi(async (url, init) => { calls.push({ url, init }); return mockResponse(201, { comment: { id: 3 } }); });
  await api.create(1, 2, " 留言 A ", csrf);
  await api.update(1, 2, 3, 2, " 留言 B ", csrf);
  await api.remove(1, 2, 3, 2, csrf);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { body: "留言 A" });
  assert.equal(calls[1].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].init.body), { version: 2, body: "留言 B" });
  assert.equal(calls[2].init.method, "DELETE");
  assert.equal(calls[2].url, "/api/projects/1/tasks/2/comments/3?version=2");
  assert.ok(!Object.hasOwn(calls[2].init, "body"));
  assert.ok(!Object.hasOwn(calls[2].init.headers, "Content-Type"));
  assert.ok(calls.every((call) => call.init.headers["X-TaskFlow-CSRF"] === csrf));
});

test("M8-C1：拒絕無效 CSRF Token，且不發送 HTTP", async () => {
  let called = 0;
  const api = createCommentsApi(async () => { called++; return mockResponse(201, {}); });
  assert.throws(() => api.create(1, 2, "A", "bad-token"), /登入憑證/);
  assert.equal(called, 0);
});

test("M8-C1：409 與 403 仍交由前端呈現，不誤判為成功", async () => {
  const api = createCommentsApi(async () => mockResponse(409, { error: "VERSION_CONFLICT", message: "版本過期" }));
  await assert.rejects(api.update(1, 2, 3, 1, "更新", csrf), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, "VERSION_CONFLICT");
    return true;
  });
});

test("M8-C1：401 必須觸發登入失效處理", async () => {
  let expired = 0;
  const api = createCommentsApi(async () => mockResponse(401, { message: "請先登入" }), () => expired++);
  await assert.rejects(api.list(1, 2), /請先登入/);
  assert.equal(expired, 1);
});
