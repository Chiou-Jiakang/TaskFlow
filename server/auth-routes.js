"use strict";

const express = require("express");
const crypto = require("node:crypto");

const {
  AuthError,
  initializeAuthSchema,
  createAuthRepository,
} = require("./auth-foundation");

const COOKIE = "taskflow_session";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const WINDOW = 15 * 60 * 1000;

// 統一建立驗證錯誤
function error(status, code, message) {
  throw new AuthError(status, code, message);
}

// 從 Cookie 中讀取 Session Token
function readCookie(req) {
  const header = req.headers.cookie;

  if (typeof header !== "string") {
    return null;
  }

  let token = null;

  for (const piece of header.split(";")) {
    const eq = piece.indexOf("=");

    if (eq < 0 || piece.slice(0, eq).trim() !== COOKIE) {
      continue;
    }

    // 避免同名 Cookie 造成身分歧義
    if (token !== null) {
      return null;
    }

    token = piece.slice(eq + 1).trim();
  }

  return token;
}

// 從 Session Token 產生獨立的 CSRF Token
function csrfValue(token) {
  return crypto
    .createHash("sha256")
    .update("taskflow-csrf-v1:")
    .update(token)
    .digest("hex");
}

// 使用固定時間比較，驗證 CSRF Token
function csrfMatches(value, expected) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{64}$/.test(value) &&
    crypto.timingSafeEqual(
      Buffer.from(value, "hex"),
      Buffer.from(expected, "hex"),
    )
  );
}

// 本機 HTTP 可使用非 Secure Cookie。
// 正式環境必須經由 HTTPS。
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

// 只接受 JSON Request Body
function jsonRequired(req, _res, next) {
  if (!req.is("application/json")) {
    return next(
      new AuthError(415, "JSON_REQUIRED", "請使用 application/json。"),
    );
  }

  next();
}

// 拒絕不允許的請求欄位
function exactFields(body, allowed) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !allowed.includes(key))
  ) {
    error(400, "INVALID_INPUT", "JSON 欄位不合法。");
  }
}

// 防止跨來源寫入請求
function sameOriginOnly(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const site = req.get("sec-fetch-site");

  if (site && !["same-origin", "none"].includes(site)) {
    return res.status(403).json({
      error: "CROSS_ORIGIN_DENIED",
      message: "不允許跨來源請求。",
    });
  }

  // 正式部署可透過 TASKFLOW_ORIGIN 指定可信來源
  const expected =
    process.env.TASKFLOW_ORIGIN || `${req.protocol}://${req.get("host")}`;

  let source = req.get("origin");

  // 沒有 Origin 時檢查 Referer
  if (!source && req.get("referer")) {
    try {
      source = new URL(req.get("referer")).origin;
    } catch {
      source = "invalid";
    }
  }

  if (source !== expected) {
    return res.status(403).json({
      error: "CROSS_ORIGIN_DENIED",
      message: "來源驗證失敗。",
    });
  }

  next();
}

// 建立 Authentication 路由與 Session Middleware
function createAuthContext(db) {
  initializeAuthSchema(db);

  const repo = createAuthRepository(db);
  const router = express.Router();

  // 本機 MVP 的基本登入失敗計數
  const failures = new Map();

  // 解析目前使用者 Session
  function session(req) {
    if (req.taskflowSession !== undefined) {
      return req.taskflowSession;
    }

    const token = readCookie(req);

    const user = token ? repo.getUserBySession(token) : null;

    req.taskflowSession = user ? { user, token } : null;

    return req.taskflowSession;
  }

  // 提供 Project API 可信任的使用者 ID
  function actorId(req) {
    return session(req)?.user.id ?? null;
  }

  // 必須先登入
  function requireSession(req, res, next) {
    if (!session(req)) {
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "請先登入。",
      });
    }

    next();
  }

  // 必須攜帶有效 CSRF Token
  function requireCsrf(req, res, next) {
    const current = session(req);

    if (!current) {
      return requireSession(req, res, next);
    }

    if (!csrfMatches(req.get("x-taskflow-csrf"), csrfValue(current.token))) {
      return res.status(403).json({
        error: "CSRF_INVALID",
        message: "CSRF 驗證失敗。",
      });
    }

    next();
  }

  // 身分驗證回應不得被中介快取
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // ==================================
  // POST /api/auth/register
  // ==================================
  router.post("/register", jsonRequired, async (req, res) => {
    exactFields(req.body, ["email", "password", "displayName"]);

    const user = await repo.register(req.body);

    res.status(201).json({ user });
  });

  // ==================================
  // POST /api/auth/login
  // ==================================
  router.post("/login", jsonRequired, async (req, res) => {
    exactFields(req.body, ["email", "password"]);

    const key = req.ip || req.socket.remoteAddress || "unknown";

    const time = Date.now();
    const previous = failures.get(key);

    // 超過連續失敗次數，暫時限制登入
    if (previous && previous.until > time && previous.count >= 10) {
      return res.status(429).json({
        error: "TOO_MANY_ATTEMPTS",
        message: "登入嘗試過多，請稍後再試。",
      });
    }

    // 清除已過期的失敗紀錄
    if (previous && previous.until <= time) {
      failures.delete(key);
    }

    const user = await repo.authenticate(req.body);

    if (!user) {
      const latest = failures.get(key);

      failures.set(key, {
        count: (latest?.count ?? 0) + 1,
        until: latest?.until ?? time + WINDOW,
      });

      return res.status(401).json({
        error: "INVALID_CREDENTIALS",
        message: "Email 或密碼不正確。",
      });
    }

    // 成功登入後清除失敗計數
    failures.delete(key);

    // 避免沿用舊的 Session
    const oldToken = readCookie(req);

    if (oldToken) {
      repo.revokeSession(oldToken);
    }

    // 建立新的 Session
    const issued = repo.issueSession(user.id);

    res.cookie(COOKIE, issued.token, {
      ...cookieOptions(),
      maxAge: WEEK,
    });

    res.json({
      user,
      csrfToken: csrfValue(issued.token),
      expiresAt: issued.expiresAt,
    });
  });

  // ==================================
  // GET /api/auth/me
  // ==================================
  router.get("/me", requireSession, (req, res) => {
    const current = session(req);

    res.json({
      user: current.user,
      csrfToken: csrfValue(current.token),
    });
  });

  // ==================================
  // POST /api/auth/logout
  // ==================================
  router.post("/logout", requireSession, requireCsrf, (req, res) => {
    repo.revokeSession(session(req).token);

    res.clearCookie(COOKIE, cookieOptions());

    res.status(204).end();
  });

  return {
    router,
    actorId,
    requireCsrf,
  };
}

module.exports = {
  createAuthContext,
  sameOriginOnly,
};
