"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("node:worker_threads");

const { openDatabase, initializeSchema } = require("../server/db");

const {
  createProjectRepository,
  ProjectError,
} = require("../server/project-repository");

// 這段只在隔離測試 Worker 中執行。
if (!isMainThread && workerData?.purpose === "m2c-concurrency") {
  let db;

  try {
    db = openDatabase(workerData.filename);
    initializeSchema(db);

    const repo = createProjectRepository(db);

    parentPort.postMessage({ type: "ready" });

    parentPort.once("message", (message) => {
      if (message !== "start") {
        parentPort.postMessage({
          type: "result",
          outcome: "unexpected",
          message: "invalid signal",
        });

        db.close();
        parentPort.close();
        return;
      }

      try {
        const updated = repo.update(
          workerData.userId,
          workerData.projectId,
          1,
          { name: workerData.name },
        );

        parentPort.postMessage({
          type: "result",
          outcome: "updated",
          version: updated.version,
        });
      } catch (error) {
        const isConflict =
          error instanceof ProjectError &&
          error.status === 409 &&
          error.code === "VERSION_CONFLICT";

        parentPort.postMessage({
          type: "result",
          outcome: isConflict ? "conflict" : "unexpected",
          message: error.message,
        });
      } finally {
        db.close();
        parentPort.close();
      }
    });
  } catch (error) {
    parentPort.postMessage({
      type: "result",
      outcome: "unexpected",
      message: error.message,
    });

    if (db) db.close();
    parentPort.close();
  }
} else if (isMainThread) {
  const { createApp } = require("../server/server");

  // 建立獨立的系統暫存資料庫。
  function newFixture() {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "taskflow-m2c-final-"),
    );

    return {
      directory,
      filename: path.join(directory, "acceptance.db"),
    };
  }

  function addUser(db, email) {
    return Number(
      db
        .prepare(
          `
        INSERT INTO users (
          email,
          password_hash,
          display_name
        )
        VALUES (?, 'TEST_ONLY', 'Integration Tester')
      `,
        )
        .run(email).lastInsertRowid,
    );
  }

  async function listen(app) {
    const server = app.listen(0, "127.0.0.1");

    await once(server, "listening");

    return {
      server,
      base: `http://127.0.0.1:${server.address().port}`,
    };
  }

  async function stop(server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  async function api(base, method, route, data) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers:
        data === undefined
          ? {}
          : {
              "content-type": "application/json",
            },
      body: data === undefined ? undefined : JSON.stringify(data),
    });

    const body = response.status === 204 ? null : await response.json();

    return {
      status: response.status,
      body,
      location: response.headers.get("location"),
    };
  }

  // 建立一個真正的獨立 Worker。
  function createRacer(filename, userId, projectId, name) {
    const worker = new Worker(__filename, {
      execArgv: [],
      workerData: {
        purpose: "m2c-concurrency",
        filename,
        userId,
        projectId,
        name,
      },
    });

    let readyResolve;
    let readyReject;
    let resultResolve;
    let resultReject;
    let exitResolve;
    let exitReject;

    const ready = new Promise((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });

    const result = new Promise((resolve, reject) => {
      resultResolve = resolve;
      resultReject = reject;
    });

    const exited = new Promise((resolve, reject) => {
      exitResolve = resolve;
      exitReject = reject;
    });

    worker.on("message", (message) => {
      if (message.type === "ready") {
        readyResolve();
      }

      if (message.type === "result") {
        if (message.outcome === "unexpected") {
          readyReject(new Error(message.message));
        }

        resultResolve(message);
      }
    });

    worker.on("error", (error) => {
      readyReject(error);
      resultReject(error);
      exitReject(error);
    });

    worker.once("exit", (code) => {
      if (code === 0) {
        exitResolve();
      } else {
        const error = new Error(`worker exit code ${code}`);

        readyReject(error);
        resultReject(error);
        exitReject(error);
      }
    });

    return {
      worker,
      ready,
      result,
      exited,
    };
  }

  test("M2-C final acceptance: HTTP persistence and concurrency", async (t) => {
    await t.test("HTTP 建立修改後重開資料庫，資料與刪除持久化", async (t) => {
      const { filename, directory } = newFixture();

      let db = openDatabase(filename);

      initializeSchema(db);

      const ownerId = addUser(db, "http-owner@example.invalid");

      let server = null;

      t.after(async () => {
        try {
          if (server) await stop(server);
          if (db) db.close();
        } finally {
          fs.rmSync(directory, {
            recursive: true,
            force: true,
          });
        }
      });

      let opened = await listen(
        createApp({
          database: db,
          getAuthenticatedUserId: () => ownerId,
        }),
      );

      server = opened.server;

      const created = await api(opened.base, "POST", "/api/projects", {
        name: "持久化 HTTP 專案",
        description: "跨重啟仍保留",
      });

      assert.equal(created.status, 201);

      const projectId = created.body.project.id;

      assert.equal(created.location, `/api/projects/${projectId}`);

      const patched = await api(
        opened.base,
        "PATCH",
        `/api/projects/${projectId}`,
        {
          version: 1,
          name: "更新後的專案",
        },
      );

      assert.equal(patched.status, 200);
      assert.equal(patched.body.project.version, 2);

      await stop(server);
      server = null;

      db.close();
      db = null;

      db = openDatabase(filename);
      initializeSchema(db);

      opened = await listen(
        createApp({
          database: db,
          getAuthenticatedUserId: () => ownerId,
        }),
      );

      server = opened.server;

      const recovered = await api(
        opened.base,
        "GET",
        `/api/projects/${projectId}`,
      );

      assert.equal(recovered.status, 200);

      assert.equal(recovered.body.project.name, "更新後的專案");

      assert.equal(recovered.body.project.description, "跨重啟仍保留");

      assert.equal(recovered.body.project.version, 2);

      const removed = await api(
        opened.base,
        "DELETE",
        `/api/projects/${projectId}?version=2`,
      );

      assert.equal(removed.status, 204);

      await stop(server);
      server = null;

      db.close();
      db = null;

      db = openDatabase(filename);
      initializeSchema(db);

      const missing = createProjectRepository(db).list(ownerId);

      assert.deepEqual(missing, []);

      assert.equal(
        db
          .prepare(
            `
              SELECT count(*) AS n
              FROM project_members
            `,
          )
          .get().n,
        0,
      );
    });

    await t.test("HTTP 非法輸入回傳 400、404、413，資料不變", async (t) => {
      const db = openDatabase(":memory:");

      initializeSchema(db);

      const ownerId = addUser(db, "boundary-owner@example.invalid");

      const { server, base } = await listen(
        createApp({
          database: db,
          getAuthenticatedUserId: () => ownerId,
        }),
      );

      t.after(async () => {
        await stop(server);
        db.close();
      });

      const created = await api(base, "POST", "/api/projects", {
        name: "原始名稱",
      });

      assert.equal(created.status, 201);

      const id = created.body.project.id;

      const badVersion = await api(base, "PATCH", `/api/projects/${id}`, {
        version: 0,
        name: "非法",
      });

      assert.equal(badVersion.status, 400);

      const badId = await api(base, "GET", "/api/projects/not-a-number");

      assert.equal(badId.status, 400);

      const missing = await api(base, "GET", "/api/projects/999999");

      assert.equal(missing.status, 404);

      const oversize = await api(base, "POST", "/api/projects", {
        name: "x",
        description: "x".repeat(20000),
      });

      assert.equal(oversize.status, 413);

      assert.equal(oversize.body.error, "PAYLOAD_TOO_LARGE");

      const after = await api(base, "GET", `/api/projects/${id}`);

      assert.equal(after.body.project.name, "原始名稱");

      assert.equal(after.body.project.version, 1);
    });

    await t.test("未登入者不能使用 user_id 冒用 Owner", async (t) => {
      const db = openDatabase(":memory:");

      initializeSchema(db);

      const ownerId = addUser(db, "spoof-owner@example.invalid");

      const { server, base } = await listen(createApp({ database: db }));

      t.after(async () => {
        await stop(server);
        db.close();
      });

      const result = await api(base, "POST", "/api/projects", {
        name: "不允許的專案",
        user_id: ownerId,
      });

      assert.equal(result.status, 401);

      assert.equal(result.body.error, "UNAUTHENTICATED");

      assert.equal(
        db
          .prepare(
            `
              SELECT count(*) AS n
              FROM projects
            `,
          )
          .get().n,
        0,
      );
    });

    await t.test("兩個獨立 Worker 並發更新相同版本，僅一筆成功", async (t) => {
      const { filename, directory } = newFixture();

      const db = openDatabase(filename);
      initializeSchema(db);

      const ownerId = addUser(db, "race-owner@example.invalid");

      const project = createProjectRepository(db).create(ownerId, {
        name: "競爭前名稱",
        description: "",
      });

      const a = createRacer(filename, ownerId, project.id, "Worker A");

      const b = createRacer(filename, ownerId, project.id, "Worker B");

      t.after(async () => {
        try {
          await Promise.allSettled([
            a.worker.terminate(),
            b.worker.terminate(),
          ]);

          db.close();
        } finally {
          fs.rmSync(directory, {
            recursive: true,
            force: true,
          });
        }
      });

      await Promise.all([a.ready, b.ready]);

      a.worker.postMessage("start");
      b.worker.postMessage("start");

      const results = await Promise.all([a.result, b.result]);

      await Promise.all([a.exited, b.exited]);

      assert.deepEqual(results.map((r) => r.outcome).sort(), [
        "conflict",
        "updated",
      ]);

      const latest = createProjectRepository(db).get(ownerId, project.id);

      assert.equal(latest.version, 2);

      assert.ok(["Worker A", "Worker B"].includes(latest.name));

      assert.equal(
        db.prepare("PRAGMA integrity_check").get().integrity_check,
        "ok",
      );
    });
  });
}
