"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const app = require("../server/server");

test("M1 Express smoke tests", async (t) => {
  // 使用隨機可用的本機連接埠，不佔用 3000
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  await t.test("健康檢查 API 正常", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);

    const data = await response.json();

    assert.deepEqual(data, {
      service: "TaskFlow",
      status: "ok",
      milestone: "M1",
    });

    assert.equal(response.headers.get("x-powered-by"), null);
  });

  await t.test("首頁與靜態檔案正常", async () => {
    const page = await fetch(`${baseUrl}/`);

    assert.equal(page.status, 200);

    const html = await page.text();

    assert.match(html, /TaskFlow/);
    assert.match(html, /kanban-board/);

    for (const asset of ["/style.css", "/app.js"]) {
      const response = await fetch(baseUrl + asset);
      assert.equal(response.status, 200);
    }
  });

  await t.test("不存在的 API 回傳 404", async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);

    assert.equal(response.status, 404);

    const data = await response.json();
    assert.equal(data.error, "API_NOT_FOUND");
  });
});
