"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../server/server");

// M10-A5a: Test isolated HTTP headers without touching the production database.
test("M10-A5a CSP baseline and Permissions-Policy", async (t) => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())
  ));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (endpoint) => fetch(`${base}${endpoint}`);

  function assertPolicy(response) {
    const csp = response.headers.get("content-security-policy");
    assert.ok(csp, "缺少 Content-Security-Policy");
    for (const directive of [
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ]) {
      assert.ok(csp.split(";").some((part) => part.trim() === directive), `CSP 缺少 ${directive}`);
    }
    assert.equal(response.headers.get("permissions-policy"),
      "camera=(), microphone=(), geolocation=()");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
  }

  await t.test("首頁正常載入且具有 CSP/Permissions 標頭", async () => {
    const response = await request("/");
    assert.equal(response.status, 200);
    assertPolicy(response);
    await response.arrayBuffer();
  });

  await t.test("健康檢查仍為 200，API no-store 不受影響", async () => {
    const response = await request("/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertPolicy(response);
    await response.arrayBuffer();
  });

  await t.test("不存在的 API 仍為 404 並套用安全政策", async () => {
    const response = await request("/api/m10a5a-not-found");
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assertPolicy(response);
    await response.arrayBuffer();
  });

  await t.test("本機 HTTP 不得誤宣告 HSTS", async () => {
    const response = await request("/");
    assert.equal(response.headers.get("strict-transport-security"), null);
    await response.arrayBuffer();
  });
});
