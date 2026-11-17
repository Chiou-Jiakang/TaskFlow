"use strict";

// TaskFlow M5-C2：獨立 SQLite + 隨機 Port + Microsoft Edge。
// 不讀寫 data/taskflow.db，也不輸出密碼、Cookie 或 CSRF Token。
const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");
const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");
const { initializeTaskSchema } = require("../server/task-repository");

const PASSWORD = "M5C2!IndependentPassword2026";
const users = {
  owner: {
    displayName: "M5C2 Owner",
    email: "owner.m5c2@example.test",
  },
  admin: {
    displayName: "M5C2 Admin",
    email: "admin.m5c2@example.test",
  },
  member: {
    displayName: "M5C2 Member",
    email: "member.m5c2@example.test",
  },
  outsider: {
    displayName: "M5C2 Outsider",
    email: "outsider.m5c2@example.test",
  },
};

function waitForResponse(page, method, pathname) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === pathname,
  );
}

function taskCard(page, title) {
  return page.locator(".tf-task-card").filter({ hasText: title });
}

async function waitForTaskLoaded(page) {
  await page.waitForFunction(() =>
    document.querySelector("#task-message")?.textContent?.includes("已載入"),
  );
}

async function assertResult(response, status, label) {
  assert.equal(
    response.status(),
    status,
    `${label}: HTTP ${response.status()}`,
  );
}

test(
  "M5-C2 Microsoft Edge multi-user task E2E",
  { timeout: 150000 },
  async (t) => {
    const db = openDatabase(":memory:");
    initializeSchema(db);
    initializeTaskSchema(db);

    const server = createApp({ database: db }).listen(0, "127.0.0.1");
    let browser = null;
    const contexts = {};
    const pages = {};
    const pageErrors = [];
    const ids = {};
    let projectId;
    let taskId;

    t.after(async () => {
      for (const context of Object.values(contexts)) {
        await context.close();
      }
      if (browser) await browser.close();
      await new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
      db.close();
    });

    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: "msedge", headless: true });

    for (const key of Object.keys(users)) {
      contexts[key] = await browser.newContext({ baseURL: base });
      pages[key] = await contexts[key].newPage();
      pages[key].on("pageerror", (err) =>
        pageErrors.push(`${key}: ${err.message}`),
      );
    }

    async function login(key) {
      const page = pages[key];
      await page.goto("/auth.html");
      await page.locator("#login-form").waitFor({ state: "visible" });
      await page.locator("#login-email").fill(users[key].email);
      await page.locator("#login-password").fill(PASSWORD);

      await Promise.all([
        page.waitForURL((url) => url.pathname === "/"),
        page.locator('#login-form button[type="submit"]').click(),
      ]);

      await page.locator("body.auth-ready").waitFor();
      assert.equal(
        await page.locator("#user-display").textContent(),
        users[key].displayName,
      );
    }

    async function openBoard(key) {
      const page = pages[key];
      await page.goto("/");
      await page.locator("body.auth-ready").waitFor();
      await page
        .locator("#task-project-select")
        .selectOption(String(projectId));
      await waitForTaskLoaded(page);
      return page;
    }

    async function addMember(email, role) {
      const owner = pages.owner;
      await owner.locator("#member-email").fill(email);
      await owner.locator("#member-role").selectOption(role);

      const [response] = await Promise.all([
        waitForResponse(owner, "POST", `/api/projects/${projectId}/members`),
        owner.locator('#member-add-form button[type="submit"]').click(),
      ]);

      await assertResult(response, 201, `新增 ${role}`);
      await owner
        .locator("#member-list li")
        .filter({ hasText: email })
        .waitFor();
    }

    await t.test(
      "註冊四個隔離帳號，各自登入 Microsoft Edge Session",
      async () => {
        for (const [key, account] of Object.entries(users)) {
          const response = await contexts.owner.request.post(
            `${base}/api/auth/register`,
            {
              headers: { Origin: base },
              data: {
                email: account.email,
                displayName: account.displayName,
                password: PASSWORD,
              },
            },
          );

          await assertResult(response, 201, `註冊 ${key}`);
          ids[key] = (await response.json()).user.id;
        }

        for (const key of Object.keys(users)) {
          await login(key);
        }

        const tokens = [];

        for (const key of Object.keys(users)) {
          const cookie = (await contexts[key].cookies(base)).find(
            (item) => item.name === "taskflow_session",
          );

          assert.ok(cookie, `${key} 缺少 Session Cookie`);
          assert.equal(cookie.httpOnly, true);
          tokens.push(cookie.value);
        }

        assert.equal(new Set(tokens).size, 4);
      },
    );

    await t.test("Owner 建立專案並新增 Admin、Member", async () => {
      const owner = pages.owner;
      const projectName = "M5-C2 Task E2E 專案";

      await owner.locator("#project-name").fill(projectName);

      const [response] = await Promise.all([
        waitForResponse(owner, "POST", "/api/projects"),
        owner.locator('#project-create button[type="submit"]').click(),
      ]);

      await assertResult(response, 201, "建立專案");
      projectId = (await response.json()).project.id;
      assert.ok(Number.isSafeInteger(projectId) && projectId > 0);

      await owner.goto(`/members.html?projectId=${projectId}`);
      await owner.locator("body.auth-ready").waitFor();

      await addMember(users.admin.email, "admin");
      await addMember(users.member.email, "member");

      assert.equal(await owner.locator("#member-count").textContent(), "3");
    });

    await t.test("匿名及非成員不能存取專案任務", async () => {
      const url = `${base}/api/projects/${projectId}/tasks`;
      const guest = await browser.newContext();

      try {
        assert.equal((await guest.request.get(url)).status(), 401);
        assert.equal((await contexts.outsider.request.get(url)).status(), 404);
      } finally {
        await guest.close();
      }
    });

    await t.test("Owner 透過表單建立指派給 Member 的待處理任務", async () => {
      const page = await openBoard("owner");

      assert.equal(await page.locator("#task-my-role").textContent(), "owner");

      await page.locator("#task-title").fill("M5-C2 初始任務");
      await page
        .locator("#task-description")
        .fill("測試建立、指派、版本衝突與權限");
      await page.locator("#task-status").selectOption("todo");
      await page.locator("#task-priority").selectOption("high");
      await page.locator("#task-assignee").selectOption(String(ids.member));

      const [response] = await Promise.all([
        waitForResponse(page, "POST", `/api/projects/${projectId}/tasks`),
        page.locator("#task-submit").click(),
      ]);

      await assertResult(response, 201, "新增任務");
      taskId = (await response.json()).task.id;
      assert.ok(Number.isSafeInteger(taskId) && taskId > 0);

      await taskCard(page, "M5-C2 初始任務").waitFor();

      assert.equal(
        await page
          .locator('.kanban-column[data-status="todo"] .tf-task-card')
          .count(),
        1,
      );
    });

    await t.test("Owner 重新整理後任務仍存在", async () => {
      const page = pages.owner;

      await page.reload();
      await page.locator("body.auth-ready").waitFor();
      await waitForTaskLoaded(page);
      await taskCard(page, "M5-C2 初始任務").waitFor();

      assert.equal(await page.locator("#total-count").textContent(), "1");
    });

    await t.test("Member 看得到自己的任務但沒有編輯與刪除權限", async () => {
      const page = await openBoard("member");

      assert.equal(await page.locator("#task-create-panel").isHidden(), true);

      const card = taskCard(page, "M5-C2 初始任務");
      await card.waitFor();

      assert.equal(await card.getByRole("button", { name: "編輯" }).count(), 0);
      assert.equal(await card.getByRole("button", { name: "刪除" }).count(), 0);
      assert.equal(await card.locator("select").count(), 1);
    });

    await t.test("Member 能將自己受指派任務改成進行中", async () => {
      const page = pages.member;

      const [response] = await Promise.all([
        waitForResponse(
          page,
          "PATCH",
          `/api/projects/${projectId}/tasks/${taskId}`,
        ),
        taskCard(page, "M5-C2 初始任務")
          .locator("select")
          .selectOption("in_progress"),
      ]);

      await assertResult(response, 200, "Member 更改狀態");

      await page
        .locator('.kanban-column[data-status="progress"] .tf-task-card')
        .waitFor();

      assert.equal(await page.locator("#progress-count").textContent(), "1");

      await pages.owner.locator("#task-refresh").click();
      await pages.owner
        .locator('.kanban-column[data-status="progress"] .tf-task-card')
        .waitFor();
    });

    await t.test("Admin 可編輯任務內容與優先順序", async () => {
      const page = await openBoard("admin");

      await taskCard(page, "M5-C2 初始任務")
        .getByRole("button", { name: "編輯" })
        .click();

      await page.locator("#task-title").fill("M5-C2 Admin 已更新");
      await page.locator("#task-priority").selectOption("medium");

      const [response] = await Promise.all([
        waitForResponse(
          page,
          "PATCH",
          `/api/projects/${projectId}/tasks/${taskId}`,
        ),
        page.locator("#task-submit").click(),
      ]);

      await assertResult(response, 200, "Admin 修改任務");
      await taskCard(page, "M5-C2 Admin 已更新").waitFor();
    });

    await t.test("Owner 的過時版本更新收到 409 並讀取最新資料", async () => {
      const page = pages.owner;

      // Owner 的卡片版本仍停留在 Admin 編輯之前。
      const [response] = await Promise.all([
        waitForResponse(
          page,
          "PATCH",
          `/api/projects/${projectId}/tasks/${taskId}`,
        ),
        taskCard(page, "M5-C2 初始任務").locator("select").selectOption("done"),
      ]);

      await assertResult(response, 409, "舊版本衝突");
      await taskCard(page, "M5-C2 Admin 已更新").waitFor();

      assert.equal(
        await page
          .locator('.kanban-column[data-status="progress"] .tf-task-card')
          .count(),
        1,
      );
    });

    await t.test("Owner 重新取得版本後更新為已完成", async () => {
      const page = pages.owner;

      const [response] = await Promise.all([
        waitForResponse(
          page,
          "PATCH",
          `/api/projects/${projectId}/tasks/${taskId}`,
        ),
        taskCard(page, "M5-C2 Admin 已更新")
          .locator("select")
          .selectOption("done"),
      ]);

      await assertResult(response, 200, "更新最新版本");

      await page
        .locator('.kanban-column[data-status="done"] .tf-task-card')
        .waitFor();

      await page.reload();
      await page.locator("body.auth-ready").waitFor();
      await waitForTaskLoaded(page);

      assert.equal(await page.locator("#done-count").textContent(), "1");
    });

    await t.test("Owner 刪除任務後立即從正式看板移除", async () => {
      const page = pages.owner;
      page.once("dialog", (dialog) => dialog.accept());

      const [response] = await Promise.all([
        waitForResponse(
          page,
          "DELETE",
          `/api/projects/${projectId}/tasks/${taskId}`,
        ),
        taskCard(page, "M5-C2 Admin 已更新")
          .getByRole("button", { name: "刪除" })
          .click(),
      ]);

      await assertResult(response, 204, "刪除任務");

      await page.waitForFunction(
        () => document.querySelector("#total-count")?.textContent === "0",
      );

      assert.equal(
        (
          await contexts.member.request.get(
            `${base}/api/projects/${projectId}/tasks/${taskId}`,
          )
        ).status(),
        404,
      );
    });

    await t.test("Member 登出後原 Session 不可讀取任務", async () => {
      const page = pages.member;

      await Promise.all([
        page.waitForURL((url) => url.pathname === "/auth.html"),
        page.locator("#logout-button").click(),
      ]);

      assert.equal(
        (
          await contexts.member.request.get(
            `${base}/api/projects/${projectId}/tasks`,
          )
        ).status(),
        401,
      );
    });

    await t.test("四個瀏覽器均無未處理的 JavaScript 頁面錯誤", () => {
      assert.deepEqual(pageErrors, []);
    });
  },
);
