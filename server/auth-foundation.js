"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const AUTH_SCHEMA = path.join(__dirname, "auth-schema.sql");

const SCRYPT_OPTIONS = Object.freeze({
  N: 32768,
  r: 8,
  p: 3,
  maxmem: 64 * 1024 * 1024,
});

const HASH_BYTES = 64;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const DUMMY_HASH = `scrypt$32768$8$3$${"00".repeat(16)}$${"00".repeat(64)}`;

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function invalid(message) {
  throw new AuthError(400, "INVALID_INPUT", message);
}

function initializeAuthSchema(db) {
  db.exec(fs.readFileSync(AUTH_SCHEMA, "utf8"));
}

function normalizeEmail(email) {
  if (typeof email !== "string") {
    invalid("Email 格式不正確。");
  }

  const value = email.trim().toLowerCase();

  if (
    value.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      value,
    )
  ) {
    invalid("Email 格式不正確。");
  }

  return value;
}

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    [...password].length < 12 ||
    [...password].length > 128 ||
    Buffer.byteLength(password, "utf8") > 512
  ) {
    invalid("密碼長度須介於 12 至 128 個字元。");
  }

  return password;
}

function validateDisplayName(name) {
  if (typeof name !== "string") {
    invalid("顯示名稱不合法。");
  }

  const value = name.trim();

  if (!value || [...value].length > 80) {
    invalid("顯示名稱須介於 1 至 80 個字元。");
  }

  return value;
}

async function hashPassword(password) {
  validatePassword(password);

  const salt = crypto.randomBytes(16);

  const key = await scrypt(password, salt, HASH_BYTES, SCRYPT_OPTIONS);

  return `scrypt$32768$8$3$${salt.toString("hex")}` + `$${key.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split("$");

  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt" ||
    parts[1] !== "32768" ||
    parts[2] !== "8" ||
    parts[3] !== "3" ||
    !/^[0-9a-f]{32}$/.test(parts[4]) ||
    !/^[0-9a-f]{128}$/.test(parts[5])
  ) {
    return false;
  }

  const actual = await scrypt(
    password,
    Buffer.from(parts[4], "hex"),
    HASH_BYTES,
    SCRYPT_OPTIONS,
  );

  const expected = Buffer.from(parts[5], "hex");

  return crypto.timingSafeEqual(actual, expected);
}

function sessionHash(rawToken) {
  if (typeof rawToken !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    return null;
  }

  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function createAuthRepository(db, { now = Date.now } = {}) {
  const insertUser = db.prepare(`
    INSERT INTO users(email, password_hash, display_name)
    VALUES (?, ?, ?)
  `);

  const findByEmail = db.prepare(`
    SELECT id, email, password_hash,
           display_name AS displayName
    FROM users
    WHERE email = ?
  `);

  const findPublicUser = db.prepare(`
    SELECT id, email,
           display_name AS displayName,
           created_at AS createdAt
    FROM users
    WHERE id = ?
  `);

  const createSessionRecord = db.prepare(`
    INSERT INTO auth_sessions(
      token_hash,
      user_id,
      created_at,
      expires_at
    )
    VALUES (?, ?, ?, ?)
  `);

  const findSession = db.prepare(`
    SELECT
      u.id,
      u.email,
      u.display_name AS displayName,
      u.created_at AS createdAt
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
  `);

  const deleteSession = db.prepare(`
    DELETE FROM auth_sessions
    WHERE token_hash = ?
  `);

  const prune = db.prepare(`
    DELETE FROM auth_sessions
    WHERE expires_at <= ?
  `);

  return {
    async register({ email, password, displayName }) {
      const normalized = normalizeEmail(email);
      const validName = validateDisplayName(displayName);
      const hash = await hashPassword(password);

      try {
        const result = insertUser.run(normalized, hash, validName);

        return findPublicUser.get(Number(result.lastInsertRowid));
      } catch (error) {
        if (
          error.code === "ERR_SQLITE_ERROR" &&
          /UNIQUE constraint failed: users.email/.test(error.message)
        ) {
          throw new AuthError(409, "EMAIL_TAKEN", "此 Email 已被註冊。");
        }

        throw error;
      }
    },

    async authenticate({ email, password }) {
      let account = null;

      if (typeof password !== "string") {
        return null;
      }

      try {
        account = findByEmail.get(normalizeEmail(email)) || null;
      } catch (error) {
        if (!(error instanceof AuthError)) {
          throw error;
        }
      }

      const matched = await verifyPassword(
        password,
        account?.password_hash ?? DUMMY_HASH,
      );

      if (!matched || !account) {
        return null;
      }

      return findPublicUser.get(account.id);
    },

    issueSession(userId) {
      if (!Number.isSafeInteger(userId) || userId < 1) {
        invalid("使用者 ID 不合法。");
      }

      const token = crypto.randomBytes(32).toString("base64url");

      const createdAt = now();
      const expiresAt = createdAt + SESSION_MS;

      createSessionRecord.run(sessionHash(token), userId, createdAt, expiresAt);

      return { token, expiresAt };
    },

    getUserBySession(token) {
      const digest = sessionHash(token);

      return digest ? (findSession.get(digest, now()) ?? null) : null;
    },

    revokeSession(token) {
      const digest = sessionHash(token);

      return digest ? Number(deleteSession.run(digest).changes) === 1 : false;
    },

    pruneExpiredSessions() {
      return Number(prune.run(now()).changes);
    },
  };
}

module.exports = {
  AuthError,
  initializeAuthSchema,
  hashPassword,
  verifyPassword,
  createAuthRepository,
};
