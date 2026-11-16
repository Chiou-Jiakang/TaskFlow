"use strict";

// TaskFlow M3-B：正式 HTTP 整合驗收
// 此腳本連線至正在執行的本機 Server。
// 會建立一個隨機測試帳號。
// 測試專案會在流程結束前刪除。
// 測試帳號仍會保留在本機 SQLite 資料庫。

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");

const BASE = (process.env.TASKFLOW_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
);

const email = `m3b.accept.${randomUUID().replace(/-/g, "")}` + "@example.com";

const password = `TaskFlow-${randomBytes(18).toString("base64url")}!`;

const name = `M3-B Acceptance ${randomUUID().slice(0, 8)}`;

let passed = 0;

// ============================================
// HTTP Request 輔助函式
// ============================================

async function request(
  method,
  route,
  { data, cookie, csrf, origin = BASE, rawBody } = {},
) {
  const headers = {
    Origin: origin,
  };

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (csrf) {
    headers["X-TaskFlow-CSRF"] = csrf;
  }

  let body;

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  if (rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = rawBody;
  }

  const response = await fetch(`${BASE}${route}`, {
    method,
    headers,
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  const text = await response.text();

  let json = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `${method} ${route}: ` + `response is not JSON (${response.status})`,
      );
    }
  }

  return {
    status: response.status,
    json,
    headers: response.headers,
  };
}

// ============================================
// HTTP Response 驗證
// ============================================

function verify(label, result, status, extra = () => {}) {
  assert.equal(
    result.status,
    status,
    `${label}: expected HTTP ${status}, ` +
      `got ${result.status} ` +
      JSON.stringify(result.json),
  );

  extra(result);

  console.log(
    `PASS ${String(++passed).padStart(2, "0")} | ` +
      `${label} (HTTP ${status})`,
  );
}

// ============================================
// M3-B 正式驗收
// ============================================

async function main() {
  console.log(`TaskFlow M3-B live HTTP acceptance: ${BASE}`);

  console.log("Uses a newly generated local test account.");

  console.log("Password and Session Token are not printed.\n");

  // ------------------------------------------
  // 1. Health API
  // ------------------------------------------

  verify(
    "Health endpoint",
    await request("GET", "/api/health"),
    200,
    ({ json }) => {
      assert.equal(json.status, "ok");
    },
  );

  // ------------------------------------------
  // 2. 未登入不可取得使用者
  // ------------------------------------------

  verify("Anonymous /me rejected", await request("GET", "/api/auth/me"), 401);

  // ------------------------------------------
  // 3. 未登入不可取得專案
  // ------------------------------------------

  verify(
    "Anonymous projects rejected",
    await request("GET", "/api/projects"),
    401,
  );

  // ------------------------------------------
  // 4. 跨來源註冊拒絕
  // ------------------------------------------

  verify(
    "Cross-origin registration rejected",
    await request("POST", "/api/auth/register", {
      origin: "https://untrusted.example",
      data: {
        email,
        password,
        displayName: "Forbidden",
      },
    }),
    403,
  );

  // ------------------------------------------
  // 5. 正式註冊
  // ------------------------------------------

  const registration = await request("POST", "/api/auth/register", {
    data: {
      email: email.toUpperCase(),
      password,
      displayName: " M3-B Acceptance ",
    },
  });

  verify("Register unique user", registration, 201, ({ json, headers }) => {
    assert.equal(json.user.email, email);

    assert.equal(json.user.displayName, "M3-B Acceptance");

    assert.equal(Object.hasOwn(json.user, "password_hash"), false);

    assert.equal(headers.get("set-cookie"), null);
  });

  // ------------------------------------------
  // 6. 重複 Email 不可註冊
  // ------------------------------------------

  verify(
    "Duplicate email rejected",
    await request("POST", "/api/auth/register", {
      data: {
        email,
        password,
        displayName: "Duplicate",
      },
    }),
    409,
  );

  // ------------------------------------------
  // 7. 錯誤密碼拒絕
  // ------------------------------------------

  verify(
    "Incorrect password rejected",
    await request("POST", "/api/auth/login", {
      data: {
        email,
        password: "not-the-right-password",
      },
    }),
    401,
  );

  // ------------------------------------------
  // 8. 跨來源登入拒絕
  // ------------------------------------------

  verify(
    "Cross-origin login rejected",
    await request("POST", "/api/auth/login", {
      origin: "https://untrusted.example",
      data: {
        email,
        password,
      },
    }),
    403,
  );

  // ------------------------------------------
  // 9. 正式登入與 Cookie
  // ------------------------------------------

  const login = await request("POST", "/api/auth/login", {
    data: {
      email,
      password,
    },
  });

  let cookie;
  let csrf;

  verify(
    "Login sets secure browser attributes",
    login,
    200,
    ({ json, headers }) => {
      const header = headers.get("set-cookie") || "";

      assert.match(header, /taskflow_session=[A-Za-z0-9_-]{43}/);

      assert.match(header, /httponly/i);

      assert.match(header, /samesite=strict/i);

      assert.match(json.csrfToken, /^[0-9a-f]{64}$/);

      cookie = header.split(";")[0];
      csrf = json.csrfToken;
    },
  );

  // ------------------------------------------
  // 10. 取得登入使用者
  // ------------------------------------------

  verify(
    "Session /me returns correct user",
    await request("GET", "/api/auth/me", { cookie }),
    200,
    ({ json }) => {
      assert.equal(json.user.email, email);

      assert.equal(json.csrfToken, csrf);
    },
  );

  // ------------------------------------------
  // 11. 新帳號的專案列表應為空
  // ------------------------------------------

  verify(
    "New account has empty project list",
    await request("GET", "/api/projects", { cookie }),
    200,
    ({ json }) => {
      assert.deepEqual(json.projects, []);
    },
  );

  // ------------------------------------------
  // 12. 沒有 CSRF 不可建立專案
  // ------------------------------------------

  verify(
    "Project creation without CSRF rejected",
    await request("POST", "/api/projects", {
      cookie,
      data: { name },
    }),
    403,
  );

  // ------------------------------------------
  // 13. 正式建立專案
  // ------------------------------------------

  const created = await request("POST", "/api/projects", {
    cookie,
    csrf,
    data: { name },
  });

  let projectId;
  let version;

  verify("Create project under logged-in user", created, 201, ({ json }) => {
    assert.equal(json.project.name, name);

    assert.equal(json.project.myRole, "owner");

    projectId = json.project.id;
    version = json.project.version;

    assert.ok(Number.isSafeInteger(projectId));
  });

  // ------------------------------------------
  // 14. 沒有 CSRF 不可修改專案
  // ------------------------------------------

  verify(
    "Patch project without CSRF rejected",
    await request("PATCH", `/api/projects/${projectId}`, {
      cookie,
      data: {
        name: `${name} edited`,
        version,
      },
    }),
    403,
  );

  // ------------------------------------------
  // 15. 正式修改專案
  // ------------------------------------------

  const updated = await request("PATCH", `/api/projects/${projectId}`, {
    cookie,
    csrf,
    data: {
      name: `${name} edited`,
      version,
    },
  });

  verify("Patch project with CSRF", updated, 200, ({ json }) => {
    assert.equal(json.project.name, `${name} edited`);

    assert.equal(json.project.version, version + 1);

    version = json.project.version;
  });

  // ------------------------------------------
  // 16. 舊版本更新應被拒絕
  // ------------------------------------------

  verify(
    "Old project version rejected",
    await request("PATCH", `/api/projects/${projectId}`, {
      cookie,
      csrf,
      data: {
        name: `${name} stale`,
        version: version - 1,
      },
    }),
    409,
  );

  // ------------------------------------------
  // 17. 正式刪除專案
  // ------------------------------------------

  verify(
    "Delete project with CSRF",
    await request("DELETE", `/api/projects/${projectId}?version=${version}`, {
      cookie,
      csrf,
    }),
    204,
  );

  // ------------------------------------------
  // 18. 已刪除專案回傳 404
  // ------------------------------------------

  verify(
    "Deleted project returns 404",
    await request("GET", `/api/projects/${projectId}`, {
      cookie,
    }),
    404,
  );

  // ------------------------------------------
  // 19. 沒有 CSRF 不可登出
  // ------------------------------------------

  verify(
    "Logout without CSRF rejected",
    await request("POST", "/api/auth/logout", {
      cookie,
    }),
    403,
  );

  // ------------------------------------------
  // 20. 正式登出
  // ------------------------------------------

  verify(
    "Logout with CSRF",
    await request("POST", "/api/auth/logout", {
      cookie,
      csrf,
    }),
    204,
  );

  // ------------------------------------------
  // 21. 登出後不能取得使用者
  // ------------------------------------------

  verify(
    "Revoked session cannot access /me",
    await request("GET", "/api/auth/me", {
      cookie,
    }),
    401,
  );

  // ------------------------------------------
  // 22. 登出後不能取得專案
  // ------------------------------------------

  verify(
    "Revoked session cannot access projects",
    await request("GET", "/api/projects", {
      cookie,
    }),
    401,
  );

  // ------------------------------------------
  // 最終驗收報告
  // ------------------------------------------

  console.log(`\nSUCCESS: ${passed}/${passed} ` + "live HTTP checks passed.");

  console.log(`Note: test user ${email} ` + "remains in local SQLite.");

  console.log("The temporary test project was deleted.");
}

// ============================================
// 錯誤處理
// ============================================

main().catch((error) => {
  console.error("\nM3-B live HTTP acceptance FAILED:");

  console.error(error.message);

  console.error("Do not commit or push until " + "the failure is reviewed.");

  process.exitCode = 1;
});
