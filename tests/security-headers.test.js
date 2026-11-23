"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../server/server");

test("M10-A4 HTTP security headers", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  async function get(path) {
    const response = await fetch(`${base}${path}`);
    await response.arrayBuffer();
    return response;
  }

  function assertCommonHeaders(response) {
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(
      response.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(response.headers.get("x-powered-by"), null);
  }

  await t.test("首頁應回傳 200 與基本安全標頭", async () => {
    const response = await get("/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/html/i);
    assertCommonHeaders(response);
  });

  await t.test("健康檢查 API 應禁止快取", async () => {
    const response = await get("/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertCommonHeaders(response);
  });

  await t.test("不存在的 API 應回傳 404 並禁止快取", async () => {
    const response = await get("/api/not-a-real-route");
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertCommonHeaders(response);
  });
});
