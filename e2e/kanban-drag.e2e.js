"use strict";

// TaskFlow M6-D：Microsoft Edge 多人 Kanban 拖曳 E2E。
// 記憶體 SQLite + 隨機本機 Port；絕不寫入 data/taskflow.db。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");

const PASSWORD = "M6D!LocalEphemeralTest2026";
const USERS = {
  owner: { displayName: "M6D Owner", email: "m6d.owner@example.test" },
  admin: { displayName: "M6D Admin", email: "m6d.admin@example.test" },
  member: { displayName: "M6D Member", email: "m6d.member@example.test" },
  outsider: { displayName: "M6D Outsider", email: "m6d.outsider@example.test" },
};

function card(page, title) {
  return page
    .locator(".tf-task-card")
    .filter({ has: page.locator("h4", { hasText: title }) });
}

function moveResponse(page, projectId) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.startsWith(
        `/api/projects/${projectId}/tasks/`,
      ) &&
      new URL(response.url()).pathname.endsWith("/move"),
  );
}

async function loaded(page) {
  await page.waitForFunction(() =>
    document.querySelector("#task-message")?.textContent?.includes("已載入"),
  );
}

async function operationFinished(page, phrase) {
  await page.waitForFunction(
    (expected) =>
      document.querySelector("#task-message")?.textContent?.includes(expected),
    phrase,
  );
}

async function titles(page, column) {
  return page
    .locator(`.kanban-column[data-status="${column}"] .tf-task-card h4`)
    .allTextContents();
}

test(
  "M6-D Microsoft Edge multi-user Kanban drag & drop E2E",
  { timeout: 180000 },
  async (t) => {
    const db = openDatabase(":memory:");
    initializeSchema(db);
    const server = createApp({ database: db }).listen(0, "127.0.0.1");
    let browser;
    const contexts = {};
    const pages = {};
    const pageErrors = [];
    const ids = {};
    const taskIds = {};
    let projectId;

    t.after(async () => {
      for (const context of Object.values(contexts)) await context.close();
      if (browser) await browser.close();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      db.close();
    });

    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: "msedge", headless: true });

    for (const key of Object.keys(USERS)) {
      contexts[key] = await browser.newContext({
        baseURL: base,
        viewport: {
          width: 1440,
          height: 1600,
        },
      });

      pages[key] = await contexts[key].newPage();
      pages[key].on("pageerror", (error) =>
        pageErrors.push(`${key}: ${error.message}`),
      );
    }

    function taskPath() {
      return `/api/projects/${projectId}/tasks`;
    }
    function reorderPath(id) {
      return `${taskPath()}/${id}/move`;
    }

    async function readTasks(role = "owner") {
      const response = await contexts[role].request.get(`${base}${taskPath()}`);
      assert.equal(response.status(), 200, `GET 任務：${role}`);
      return (await response.json()).tasks;
    }

    async function csrf(role) {
      const response = await contexts[role].request.get(`${base}/api/auth/me`);
      assert.equal(response.status(), 200, `${role} Session 必須有效`);
      return (await response.json()).csrfToken;
    }

    async function requestMove(role, id, payload, token = null) {
      return contexts[role].request.patch(`${base}${reorderPath(id)}`, {
        headers: {
          Origin: base,
          "X-TaskFlow-CSRF": token ?? (await csrf(role)),
        },
        data: payload,
      });
    }

    async function login(role) {
      const page = pages[role];
      await page.goto("/auth.html");
      await page.locator("#login-form").waitFor({ state: "visible" });
      await page.locator("#login-email").fill(USERS[role].email);
      await page.locator("#login-password").fill(PASSWORD);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/"),
        page.locator('#login-form button[type="submit"]').click(),
      ]);
      await page.locator("body.auth-ready").waitFor();
      assert.equal(
        await page.locator("#user-display").textContent(),
        USERS[role].displayName,
      );
    }

    async function openBoard(role) {
      const page = pages[role];
      await page.goto("/");
      await page.locator("body.auth-ready").waitFor();
      await page
        .locator("#task-project-select")
        .selectOption(String(projectId));
      await loaded(page);
      return page;
    }

    async function drag(page, sourceTitle, target, targetPosition) {
      const source = card(page, sourceTitle);
      await source.waitFor();
      assert.equal(
        await source.getAttribute("draggable"),
        "true",
        "來源卡片應可拖曳",
      );
      const [response] = await Promise.all([
        moveResponse(page, projectId),
        source.dragTo(target, { targetPosition, timeout: 15000 }),
      ]);
      await operationFinished(
        page,
        response.status() === 409 ? "資料已由其他成員更新" : "任務已移動",
      );
      return response;
    }

    await t.test("註冊四個隔離帳號並建立四個獨立 Edge Session", async () => {
      for (const [key, account] of Object.entries(USERS)) {
        const response = await contexts.owner.request.post(
          `${base}/api/auth/register`,
          {
            headers: { Origin: base },
            data: { ...account, password: PASSWORD },
          },
        );
        assert.equal(response.status(), 201, `註冊 ${key}`);
        ids[key] = (await response.json()).user.id;
      }
      for (const role of Object.keys(USERS)) await login(role);
      const tokens = [];
      for (const role of Object.keys(USERS)) {
        const cookie = (await contexts[role].cookies(base)).find(
          (x) => x.name === "taskflow_session",
        );
        assert.ok(cookie, `${role} 缺少 Session Cookie`);
        assert.equal(cookie.httpOnly, true);
        tokens.push(cookie.value);
      }
      assert.equal(new Set(tokens).size, 4);
    });

    await t.test("Owner 建立專案，新增 Admin 與 Member", async () => {
      const owner = pages.owner;
      await owner.locator("#project-name").fill("M6-D Kanban 驗收專案");
      const [created] = await Promise.all([
        owner.waitForResponse(
          (r) =>
            r.request().method() === "POST" &&
            new URL(r.url()).pathname === "/api/projects",
        ),
        owner.locator('#project-create button[type="submit"]').click(),
      ]);
      assert.equal(created.status(), 201);
      projectId = (await created.json()).project.id;
      assert.ok(Number.isSafeInteger(projectId) && projectId > 0);

      await owner.goto(`/members.html?projectId=${projectId}`);
      await owner.locator("body.auth-ready").waitFor();
      for (const role of ["admin", "member"]) {
        await owner.locator("#member-email").fill(USERS[role].email);
        await owner.locator("#member-role").selectOption(role);
        const [response] = await Promise.all([
          owner.waitForResponse(
            (r) =>
              r.request().method() === "POST" &&
              new URL(r.url()).pathname ===
                `/api/projects/${projectId}/members`,
          ),
          owner.locator('#member-add-form button[type="submit"]').click(),
        ]);
        assert.equal(response.status(), 201);
        await owner
          .locator("#member-list li")
          .filter({ hasText: USERS[role].email })
          .waitFor();
      }
    });

    await t.test("Owner 建立三筆待處理任務與一筆進行中任務", async () => {
      const owner = await openBoard("owner");
      for (const [title, status] of [
        ["M6D-A", "todo"],
        ["M6D-B", "todo"],
        ["M6D-C", "todo"],
        ["M6D-D", "in_progress"],
      ]) {
        await owner.locator("#task-title").fill(title);
        await owner.locator("#task-status").selectOption(status);
        if (title === "M6D-B") {
          await owner
            .locator("#task-assignee")
            .selectOption(String(ids.member));
        }
        const [response] = await Promise.all([
          owner.waitForResponse(
            (r) =>
              r.request().method() === "POST" &&
              new URL(r.url()).pathname === taskPath(),
          ),
          owner.locator("#task-submit").click(),
        ]);
        assert.equal(response.status(), 201);
        taskIds[title] = (await response.json()).task.id;
        await card(owner, title).waitFor();
      }
      assert.deepEqual(await titles(owner, "todo"), [
        "M6D-A",
        "M6D-B",
        "M6D-C",
      ]);
      assert.deepEqual(await titles(owner, "progress"), ["M6D-D"]);
    });

    await t.test("Owner 真正用滑鼠同欄拖曳：C 排到 A 前方", async () => {
      const owner = pages.owner;

      const moveRequests = [];

      const recordMoveRequest = (request) => {
        if (request.method() === "PATCH" && request.url().includes("/move")) {
          moveRequests.push({
            url: request.url(),
            body: request.postData(),
          });
        }
      };

      owner.on("request", recordMoveRequest);

      await owner.evaluate(() => {
        window.__tfDragTrace = [];

        for (const type of [
          "dragstart",
          "dragenter",
          "dragover",
          "drop",
          "dragend",
        ]) {
          document.addEventListener(type, (event) => {
            const records = window.__tfDragTrace;

            if (type === "dragover" && records.at(-1)?.type === "dragover") {
              return;
            }

            records.push({
              type,
              column:
                event.target.closest?.(".kanban-column")?.dataset.status ??
                null,
              targetTask:
                event.target.closest?.(".tf-task-card")?.querySelector("h4")
                  ?.textContent ?? null,
              clientY: event.clientY,
              prevented: event.defaultPrevented,
            });

            if (records.length > 100) {
              records.shift();
            }
          });
        }
      });

      const target = card(owner, "M6D-A");

      // 取得目標卡片實際尺寸
      const box = await target.boundingBox();

      assert.ok(box, "無法取得 M6D-A 卡片位置");

      // 拖曳至卡片水平中央、上方 25% 的位置
      const targetPosition = {
        x: Math.round(box.width * 0.5),
        y: Math.round(box.height * 0.25),
      };

      let response;

      try {
        response = await drag(owner, "M6D-C", target, targetPosition);
      } catch (error) {
        const trace = await owner.evaluate(() => window.__tfDragTrace);

        console.log("DRAG EVENT TRACE:", JSON.stringify(trace, null, 2));

        console.log("MOVE REQUESTS:", JSON.stringify(moveRequests, null, 2));

        console.log(
          "TASK MESSAGE:",
          await owner.locator("#task-message").textContent(),
        );

        console.log("TODO ORDER:", JSON.stringify(await titles(owner, "todo")));

        console.log(
          "CARD POSITIONS:",
          JSON.stringify(
            await owner
              .locator('.kanban-column[data-status="todo"] .tf-task-card')
              .evaluateAll((cards) =>
                cards.map((card) => {
                  const rect = card.getBoundingClientRect();
                  return {
                    title: card.querySelector("h4")?.textContent,
                    taskId: card.dataset.taskId,
                    top: rect.top,
                    midpoint: rect.top + rect.height / 2,
                    bottom: rect.bottom,
                  };
                }),
              ),
            null,
            2,
          ),
        );

        throw error;
      } finally {
        owner.off("request", recordMoveRequest);
      }

      assert.equal(response.status(), 200);

      assert.deepEqual(await titles(owner, "todo"), [
        "M6D-C",
        "M6D-A",
        "M6D-B",
      ]);

      const actual = await readTasks();

      assert.deepEqual(
        actual.filter((x) => x.status === "todo").map((x) => x.position),
        [0, 1, 2],
      );
    });

    await t.test("同欄排序重新整理後仍持久保存", async () => {
      const owner = pages.owner;
      await owner.reload();
      await owner.locator("body.auth-ready").waitFor();
      await loaded(owner);
      assert.deepEqual(await titles(owner, "todo"), [
        "M6D-C",
        "M6D-A",
        "M6D-B",
      ]);
    });

    await t.test("Owner 真實跨欄拖曳：B 移入進行中", async () => {
      const owner = pages.owner;
      const target = owner.locator(
        '.kanban-column[data-status="progress"] .task-list',
      );
      const response = await drag(owner, "M6D-B", target);
      assert.equal(response.status(), 200);
      const actual = await readTasks();
      const moved = actual.find((x) => x.id === taskIds["M6D-B"]);
      assert.equal(moved.status, "in_progress");
      assert.deepEqual(await titles(owner, "todo"), ["M6D-C", "M6D-A"]);
      assert.equal((await titles(owner, "progress")).includes("M6D-B"), true);
      const progress = actual.filter((x) => x.status === "in_progress");
      assert.deepEqual(
        progress.map((x) => x.position),
        progress.map((_, i) => i),
      );
    });

    await t.test("Admin 有排序權；上移／下移走 M6-B API", async () => {
      const admin = await openBoard("admin");
      const rows = await titles(admin, "todo");
      assert.deepEqual(rows, ["M6D-C", "M6D-A"]);
      const [response] = await Promise.all([
        moveResponse(admin, projectId),
        card(admin, "M6D-A").getByRole("button", { name: "上移" }).click(),
      ]);
      assert.equal(response.status(), 200);
      await operationFinished(admin, "任務已移動");
      assert.deepEqual(await titles(admin, "todo"), ["M6D-A", "M6D-C"]);
    });

    await t.test(
      "Member 不可拖曳、不可排序，但保有自己的狀態權限",
      async () => {
        const member = await openBoard("member");
        assert.equal(
          await member.locator('.tf-task-card[draggable="true"]').count(),
          0,
        );
        assert.equal(
          await member.getByRole("button", { name: "上移" }).count(),
          0,
        );
        const task = (await readTasks("member")).find(
          (x) => x.id === taskIds["M6D-B"],
        );
        const denied = await requestMove("member", task.id, {
          version: task.version,
          status: "done",
          index: 0,
        });
        assert.equal(denied.status(), 403);
        assert.equal(
          (await readTasks()).find((x) => x.id === task.id).status,
          "in_progress",
        );
        // Member 原本的狀態變更透過既有 M5 PATCH API（非排序 API）。
        const [response] = await Promise.all([
          member.waitForResponse(
            (r) =>
              r.request().method() === "PATCH" &&
              new URL(r.url()).pathname === `${taskPath()}/${task.id}`,
          ),
          card(member, "M6D-B").locator("select").selectOption("done"),
        ]);
        assert.equal(response.status(), 200);
        await operationFinished(member, "任務狀態已更新");
        assert.equal(
          (await readTasks()).find((x) => x.id === task.id).status,
          "done",
        );
      },
    );

    await t.test("匿名、非成員與無 CSRF 的排序請求均遭拒絕", async () => {
      const task = (await readTasks())[0];
      const body = { version: task.version, status: "done", index: 0 };
      const guest = await browser.newContext();
      try {
        const anonymous = await guest.request.patch(
          `${base}${reorderPath(task.id)}`,
          { headers: { Origin: base }, data: body },
        );
        assert.equal(anonymous.status(), 401);
      } finally {
        await guest.close();
      }
      const outsider = await requestMove("outsider", task.id, body);
      assert.equal(outsider.status(), 404);
      const noCsrf = await contexts.owner.request.patch(
        `${base}${reorderPath(task.id)}`,
        {
          headers: { Origin: base },
          data: body,
        },
      );
      assert.equal(noCsrf.status(), 403);
    });

    await t.test("兩個瀏覽器並行：過期版本得到 409，前端自動重載", async () => {
      const owner = await openBoard("owner");
      const admin = await openBoard("admin");
      const target = (await readTasks()).find((x) => x.id === taskIds["M6D-C"]);
      assert.equal(target.status, "todo");
      const updated = await requestMove("admin", target.id, {
        version: target.version,
        status: "in_progress",
        index: 0,
      });
      assert.equal(updated.status(), 200);
      // Owner 的 DOM 尚未更新，拖曳發送舊 version，必須由後端拒絕。
      const response = await drag(
        owner,
        "M6D-C",
        owner.locator('.kanban-column[data-status="done"] .task-list'),
      );
      assert.equal(response.status(), 409);
      await owner.waitForFunction(() =>
        document
          .querySelector("#task-message")
          ?.textContent?.includes("資料已由其他成員更新"),
      );
      const actual = await readTasks();
      assert.equal(
        actual.find((x) => x.id === target.id).status,
        "in_progress",
      );
      assert.equal((await titles(owner, "progress")).includes("M6D-C"), true);
      assert.equal((await titles(owner, "done")).includes("M6D-C"), false);
      await admin.locator("#task-refresh").click();
      await loaded(admin);
    });

    await t.test("Owner 重新載入後看到全部角色產生的正式排序", async () => {
      const owner = pages.owner;
      await owner.reload();
      await owner.locator("body.auth-ready").waitFor();
      await loaded(owner);
      const actual = await readTasks();
      for (const [column, status] of [
        ["todo", "todo"],
        ["progress", "in_progress"],
        ["done", "done"],
      ]) {
        assert.deepEqual(
          await titles(owner, column),
          actual.filter((x) => x.status === status).map((x) => x.title),
        );
      }
    });

    await t.test("撤銷 Admin Session 後無法再使用排序 API", async () => {
      const token = await csrf("admin");
      await Promise.all([
        pages.admin.waitForURL((url) => url.pathname === "/auth.html"),
        pages.admin.locator("#logout-button").click(),
      ]);
      const task = (await readTasks())[0];
      const response = await requestMove(
        "admin",
        task.id,
        {
          version: task.version,
          status: "done",
          index: 0,
        },
        token,
      );
      assert.equal(response.status(), 401);
    });

    await t.test("封存專案前端不提供拖曳，後端也拒絕排序", async () => {
      const owner = pages.owner;
      db.prepare("UPDATE projects SET status = 'archived' WHERE id = ?").run(
        projectId,
      );
      await owner.reload();
      await owner.locator("body.auth-ready").waitFor();
      await loaded(owner);
      assert.equal(
        await owner.locator('.tf-task-card[draggable="true"]').count(),
        0,
      );
      const task = (await readTasks())[0];
      const response = await requestMove("owner", task.id, {
        version: task.version,
        status: "done",
        index: 0,
      });
      assert.equal(response.status(), 403);
    });

    await t.test("四個 Edge 頁面均無未處理的 JavaScript 錯誤", () => {
      assert.deepEqual(pageErrors, []);
    });
  },
);
