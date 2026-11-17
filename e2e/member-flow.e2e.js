"use strict";

// M4-C2：真實 Edge 多帳號端對端驗收。
// 全程使用 :memory: SQLite 與系統分配的 Port。
// 不使用 data/taskflow.db。

const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { chromium } = require("playwright-core");

const { createApp } = require("../server/server");
const { openDatabase, initializeSchema } = require("../server/db");

// 測試用帳號僅存在記憶體資料庫中
const PASSWORD = "M4C2!IndependentPassword2026";

const users = {
  owner: {
    name: "M4C2 Owner",
    email: "owner.m4c2@example.test",
  },
  admin: {
    name: "M4C2 Admin",
    email: "admin.m4c2@example.test",
  },
  member: {
    name: "M4C2 Member",
    email: "member.m4c2@example.test",
  },
  outsider: {
    name: "M4C2 Outsider",
    email: "outsider.m4c2@example.test",
  },
  extra: {
    name: "<img src=x onerror=alert(1)>",
    email: "extra.m4c2@example.test",
  },
};

test(
  "M4-C2 Microsoft Edge multi-member browser E2E",
  { timeout: 120000 },
  async (t) => {
    // 1. 建立獨立的 SQLite 記憶體資料庫
    const db = openDatabase(":memory:");
    initializeSchema(db);

    // 使用隨機 Port，避免占用 localhost:3000
    const server = createApp({
      database: db,
    }).listen(0, "127.0.0.1");

    let browser = null;

    const contexts = {};
    const pages = {};
    const errors = [];
    const ids = {};

    let projectId = null;

    // 測試結束後釋放所有資源
    t.after(async () => {
      for (const context of Object.values(contexts)) {
        await context.close();
      }

      if (browser) {
        await browser.close();
      }

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      db.close();
    });

    await once(server, "listening");

    const base = `http://127.0.0.1:${server.address().port}`;

    // 2. 啟動 Microsoft Edge
    browser = await chromium.launch({
      channel: "msedge",
      headless: true,
    });

    // 建立四組完全隔離的瀏覽器 Session
    for (const key of ["owner", "admin", "member", "outsider"]) {
      contexts[key] = await browser.newContext({
        baseURL: base,
      });

      pages[key] = await contexts[key].newPage();

      pages[key].on("pageerror", (error) => {
        errors.push(`${key}: ${error.message}`);
      });
    }

    // 3. 共用工具函式

    const membersUrl = () => `/api/projects/${projectId}/members`;

    const memberPage = () => `/members.html?projectId=${projectId}`;

    const rowFor = (page, email) =>
      page.locator("#member-list li").filter({
        hasText: email,
      });

    async function noticeContains(page, phrase) {
      await page.waitForFunction(
        (expected) =>
          document
            .querySelector("#member-message")
            ?.textContent?.includes(expected),
        phrase,
        { timeout: 10000 },
      );
    }

    // 正式透過登入表單建立 Session
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
        users[key].name,
      );
    }

    // 使用成員管理表單新增成員
    async function addViaUI(page, email, role = "member") {
      await page.locator("#member-email").fill(email);

      await page.locator("#member-role").selectOption(role);

      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === membersUrl() &&
            r.request().method() === "POST",
        ),

        page.locator('#member-add-form button[type="submit"]').click(),
      ]);

      assert.equal(response.status(), 201);

      await noticeContains(page, "已新增成員");

      await rowFor(page, email).waitFor({
        state: "visible",
      });

      return response.json();
    }

    // 透過前端修改角色
    async function changeRoleViaUI(page, email, role, expectedStatus) {
      const row = rowFor(page, email);

      await row.locator("select").selectOption(role);

      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname.includes(`${membersUrl()}/`) &&
            r.request().method() === "PATCH",
        ),

        row
          .getByRole("button", {
            name: "更新角色",
          })
          .click(),
      ]);

      assert.equal(response.status(), expectedStatus);

      await noticeContains(
        page,
        expectedStatus === 409 ? "專案已被其他操作更新" : "已更新成員角色",
      );
    }

    // 透過前端移除成員
    async function removeViaUI(page, email, expectedStatus) {
      const row = rowFor(page, email);

      // 接受瀏覽器確認對話框
      page.once("dialog", (dialog) => dialog.accept());

      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname.includes(`${membersUrl()}/`) &&
            r.request().method() === "DELETE",
        ),

        row
          .getByRole("button", {
            name: "移除",
          })
          .click(),
      ]);

      assert.equal(response.status(), expectedStatus);

      await noticeContains(
        page,
        expectedStatus === 409 ? "專案已被其他操作更新" : "已移除成員",
      );
    }

    // =====================================
    // TEST 01
    // 五個測試帳號與獨立 Session
    // =====================================

    await t.test(
      "隔離資料庫註冊五位帳號，四個瀏覽器 Session 獨立登入",
      async () => {
        for (const [key, account] of Object.entries(users)) {
          const response = await contexts.owner.request.post(
            `${base}/api/auth/register`,
            {
              headers: {
                Origin: base,
              },
              data: {
                email: account.email,
                displayName: account.name,
                password: PASSWORD,
              },
            },
          );

          assert.equal(response.status(), 201, `register ${key}`);

          ids[key] = (await response.json()).user.id;
        }

        for (const key of Object.keys(pages)) {
          await login(key);
        }

        const cookies = [];

        for (const key of Object.keys(pages)) {
          const session = (await contexts[key].cookies(base)).find(
            (cookie) => cookie.name === "taskflow_session",
          );

          assert.ok(session, `${key} session cookie missing`);

          assert.equal(session.httpOnly, true);

          assert.equal(session.sameSite, "Strict");

          cookies.push(session.value);
        }

        assert.equal(new Set(cookies).size, 4);
      },
    );

    // =====================================
    // TEST 02
    // Owner 建立專案並進入成員管理
    // =====================================

    await t.test("Owner 建立專案並從 Dashboard 進入成員管理頁", async () => {
      const page = pages.owner;

      const projectName = "M4-C2 成員權限端對端測試";

      await page.locator("#project-name").fill(projectName);

      const [response] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/projects" &&
            r.request().method() === "POST",
        ),

        page.locator('#project-create button[type="submit"]').click(),
      ]);

      assert.equal(response.status(), 201);

      projectId = (await response.json()).project.id;

      assert.ok(Number.isSafeInteger(projectId) && projectId > 0);

      const projectRow = page.locator("#project-list li").filter({
        hasText: projectName,
      });

      const entry = projectRow.getByRole("link", {
        name: `管理「${projectName}」的成員`,
      });

      await Promise.all([
        page.waitForURL(
          (url) =>
            url.pathname === "/members.html" &&
            url.searchParams.get("projectId") === String(projectId),
        ),

        entry.click(),
      ]);

      await page.locator("body.auth-ready").waitFor();

      assert.equal(
        await page.locator("#my-role").textContent(),
        "Owner（擁有者）",
      );

      assert.equal(await page.locator("#member-count").textContent(), "1");

      assert.equal(await page.locator("#project-version").textContent(), "1");
    });

    // =====================================
    // TEST 03
    // 非專案成員無存取權限
    // =====================================

    await t.test("非成員讀取 API 得 404，直接進入成員頁也遭拒", async () => {
      const response = await contexts.outsider.request.get(
        `${base}${membersUrl()}`,
      );

      assert.equal(response.status(), 404);

      await pages.outsider.goto(memberPage());

      await pages.outsider.locator("body.auth-error").waitFor();

      assert.match(
        await pages.outsider.locator("#auth-boot").textContent(),
        /專案不存在|無存取權限/,
      );
    });

    // =====================================
    // TEST 04
    // Owner 新增 Admin
    // =====================================

    await t.test("Owner 透過頁面新增 Admin，清單與版本立即更新", async () => {
      const result = await addViaUI(pages.owner, users.admin.email, "admin");

      assert.equal(result.version, 2);

      assert.equal(
        await pages.owner.locator("#project-version").textContent(),
        "2",
      );

      assert.equal(
        await pages.owner.locator("#member-count").textContent(),
        "2",
      );
    });

    // =====================================
    // TEST 05
    // Owner 新增 Member 與資料持久化
    // =====================================

    await t.test("Owner 加入 Member，重新整理頁面後資料仍存在", async () => {
      await addViaUI(pages.owner, users.member.email);

      await pages.owner.reload();

      await pages.owner.locator("body.auth-ready").waitFor();

      assert.equal(
        await pages.owner.locator("#member-count").textContent(),
        "3",
      );

      assert.equal(
        await pages.owner.locator("#project-version").textContent(),
        "3",
      );

      assert.equal(await rowFor(pages.owner, users.member.email).count(), 1);
    });

    // =====================================
    // TEST 06
    // 前端權限顯示
    // =====================================

    await t.test("Admin 與 Member 分開登入，前端按角色顯示權限", async () => {
      await pages.admin.goto(memberPage());

      await pages.admin.locator("body.auth-ready").waitFor();

      assert.equal(await pages.admin.locator("#add-section").isVisible(), true);

      assert.equal(
        await pages.admin
          .locator('#member-role option[value="admin"]')
          .evaluate((node) => node.hidden),
        true,
      );

      assert.equal(
        await pages.admin.locator(".member-actions select").count(),
        0,
      );

      assert.equal(
        await rowFor(pages.admin, users.owner.email)
          .getByRole("button", {
            name: "移除",
          })
          .count(),
        0,
      );

      await pages.member.goto(memberPage());

      await pages.member.locator("body.auth-ready").waitFor();

      assert.equal(await pages.member.locator("#add-section").isHidden(), true);

      assert.equal(
        await pages.member.locator(".member-actions select").count(),
        0,
      );

      assert.equal(
        await rowFor(pages.member, users.member.email)
          .getByRole("button", {
            name: "退出專案",
          })
          .count(),
        1,
      );
    });

    // =====================================
    // TEST 07
    // Admin 新增 Member 與安全文字渲染
    // =====================================

    await t.test("Admin 新增一般成員，惡意顯示名稱以純文字呈現", async () => {
      await addViaUI(pages.admin, users.extra.email);

      assert.equal(
        await pages.admin.locator("#project-version").textContent(),
        "4",
      );

      const row = rowFor(pages.admin, users.extra.email);

      // 顯示名稱不應被當作 HTML 執行
      assert.equal(await row.locator("img").count(), 0);

      assert.equal(
        await row.locator(".member-person strong").textContent(),
        users.extra.name,
      );
    });

    // =====================================
    // TEST 08
    // 409 Version Conflict
    // =====================================

    await t.test("Owner 使用舊版本更改角色得 409，更新後重試成功", async () => {
      assert.equal(
        await pages.owner.locator("#project-version").textContent(),
        "3",
      );

      // 另一個 Session 已將版本提升到 4
      await changeRoleViaUI(pages.owner, users.member.email, "admin", 409);

      assert.equal(
        await pages.owner.locator("#project-version").textContent(),
        "4",
      );

      assert.match(
        await rowFor(pages.owner, users.member.email).textContent(),
        /Member（成員）/,
      );

      // 重新取得版本後再次操作
      await changeRoleViaUI(pages.owner, users.member.email, "admin", 200);

      assert.equal(
        await pages.owner.locator("#project-version").textContent(),
        "5",
      );

      assert.match(
        await rowFor(pages.owner, users.member.email).textContent(),
        /Admin（管理員）/,
      );
    });

    // =====================================
    // TEST 09
    // 角色降級與重新整理
    // =====================================

    await t.test(
      "Owner 降回 Member，頁面刷新後角色與版本持久保留",
      async () => {
        await changeRoleViaUI(pages.owner, users.member.email, "member", 200);

        await pages.owner.reload();

        await pages.owner.locator("body.auth-ready").waitFor();

        assert.equal(
          await pages.owner.locator("#project-version").textContent(),
          "6",
        );

        assert.match(
          await rowFor(pages.owner, users.member.email).textContent(),
          /Member（成員）/,
        );
      },
    );

    // =====================================
    // TEST 10
    // Admin 移除 Member 與版本衝突
    // =====================================

    await t.test(
      "Admin 先遇版本衝突，再移除 Member；舊成員立即失去存取權",
      async () => {
        assert.equal(
          await pages.admin.locator("#project-version").textContent(),
          "4",
        );

        await removeViaUI(pages.admin, users.member.email, 409);

        assert.equal(
          await pages.admin.locator("#project-version").textContent(),
          "6",
        );

        await removeViaUI(pages.admin, users.member.email, 204);

        assert.equal(
          await pages.admin.locator("#project-version").textContent(),
          "7",
        );

        await pages.member.reload();

        await pages.member.locator("body.auth-error").waitFor();

        const response = await contexts.member.request.get(
          `${base}${membersUrl()}`,
        );

        assert.equal(response.status(), 404);
      },
    );

    // =====================================
    // TEST 11
    // Member 自行退出專案
    // =====================================

    await t.test(
      "Owner 重新加入 Member，Member 可從瀏覽器自行退出",
      async () => {
        await pages.owner.locator("#refresh-members").click();

        await noticeContains(pages.owner, "已更新成員清單");

        assert.equal(
          await pages.owner.locator("#project-version").textContent(),
          "7",
        );

        await addViaUI(pages.owner, users.member.email);

        assert.equal(
          await pages.owner.locator("#project-version").textContent(),
          "8",
        );

        await pages.member.goto(memberPage());

        await pages.member.locator("body.auth-ready").waitFor();

        pages.member.once("dialog", (dialog) => dialog.accept());

        await Promise.all([
          pages.member.waitForURL((url) => url.pathname === "/"),

          rowFor(pages.member, users.member.email)
            .getByRole("button", {
              name: "退出專案",
            })
            .click(),
        ]);

        await pages.member.locator("body.auth-ready").waitFor();

        assert.equal(
          (
            await contexts.member.request.get(`${base}${membersUrl()}`)
          ).status(),
          404,
        );
      },
    );

    // =====================================
    // TEST 12
    // Owner 身分保護
    // =====================================

    await t.test(
      "後端繼續保護 Owner，包含 Owner 自退與 Admin 移除",
      async () => {
        const projectResponse = await contexts.owner.request.get(
          `${base}${membersUrl()}`,
        );

        assert.equal(projectResponse.status(), 200);

        const { version } = await projectResponse.json();

        assert.equal(version, 9);

        for (const role of ["owner", "admin"]) {
          const me = await contexts[role].request.get(`${base}/api/auth/me`);

          assert.equal(me.status(), 200);

          const { csrfToken } = await me.json();

          const result = await contexts[role].request.delete(
            `${base}${membersUrl()}/${ids.owner}?version=${version}`,
            {
              headers: {
                Origin: base,
                "X-TaskFlow-CSRF": csrfToken,
              },
            },
          );

          assert.equal(result.status(), 403);

          const body = await result.json();

          assert.equal(typeof body.error, "string");

          if (role === "owner") {
            assert.equal(body.error, "OWNER_PROTECTED");
          }
        }
      },
    );

    // =====================================
    // TEST 13
    // 登出與 Session 撤銷
    // =====================================

    await t.test(
      "Admin、Owner 登出後，原 Session 無法讀取成員 API",
      async () => {
        for (const role of ["admin", "owner"]) {
          const page = pages[role];

          await Promise.all([
            page.waitForURL((url) => url.pathname === "/auth.html"),

            page.locator("#logout-button").click(),
          ]);

          const response = await contexts[role].request.get(
            `${base}${membersUrl()}`,
          );

          assert.equal(response.status(), 401);
        }
      },
    );

    // =====================================
    // TEST 14
    // 前端 JavaScript 例外檢查
    // =====================================

    await t.test("四個獨立瀏覽器沒有未處理的 JavaScript 頁面錯誤", () => {
      assert.deepEqual(errors, []);
    });
  },
);
