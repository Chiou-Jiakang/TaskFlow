"use strict";

// M10-A5b-1: single-process abuse prevention, deliberately independent of Express.
// No database schema changes, timers, or global state.
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LOGIN_FAILURE_LIMIT = 10;
const DEFAULT_REGISTRATION_LIMIT = 10;
const DEFAULT_MAX_KEYS = 10000;

function createAbuseGuard({
  now = Date.now,
  windowMs = DEFAULT_WINDOW_MS,
  loginFailureLimit = DEFAULT_LOGIN_FAILURE_LIMIT,
  registrationLimit = DEFAULT_REGISTRATION_LIMIT,
  maxKeys = DEFAULT_MAX_KEYS,
} = {}) {
  if (![windowMs, loginFailureLimit, registrationLimit, maxKeys].every(
    (value) => Number.isSafeInteger(value) && value > 0,
  )) {
    throw new TypeError("Abuse guard settings must be positive integers");
  }

  const login = new Map();
  const registration = new Map();
  let nextSweep = 0;

  function sweepExpired(time) {
    if (time < nextSweep && login.size < maxKeys && registration.size < maxKeys) {
      return;
    }
    nextSweep = time + Math.min(windowMs, 60 * 1000);
    for (const [key, entry] of login) {
      if (entry.until <= time && entry.inFlight === 0) login.delete(key);
    }
    for (const [key, entry] of registration) {
      if (entry.until <= time) registration.delete(key);
    }
  }

  function normalizedKey(key) {
    return typeof key === "string" && key.length > 0 && key.length <= 256
      ? key
      : "unknown";
  }

  // Count every registration request before expensive password hashing.
  function allowRegistration(key) {
    const time = now();
    sweepExpired(time);
    key = normalizedKey(key);
    let record = registration.get(key);
    if (!record || record.until <= time) {
      if (!record && registration.size >= maxKeys) return false;
      record = { count: 0, until: time + windowMs };
      registration.set(key, record);
    }
    if (record.count >= registrationLimit) return false;
    record.count += 1;
    return true;
  }

  // Reserve an in-flight slot synchronously, so parallel logins cannot bypass
  // the existing 10-failure ceiling while asynchronous scrypt is running.
  function beginLogin(key) {
    const time = now();
    sweepExpired(time);
    key = normalizedKey(key);
    let record = login.get(key);
    if (!record || (record.until <= time && record.inFlight === 0)) {
      if (!record && login.size >= maxKeys) return null;
      record = { failures: 0, inFlight: 0, until: time + windowMs };
      login.set(key, record);
    }
    if (record.failures + record.inFlight >= loginFailureLimit) return null;
    record.inFlight += 1;
    let settled = false;

    function settle(outcome) {
      if (settled) return;
      settled = true;
      record.inFlight -= 1;
      if (login.get(key) !== record) return;
      if (outcome === "success") {
        // A verified login resets prior failures, as in the original code.
        record.failures = 0;
      } else if (outcome === "failure") {
        if (record.until <= now()) {
          record.until = now() + windowMs;
          record.failures = 0;
        }
        record.failures += 1;
      }
      if (record.inFlight === 0 && record.failures === 0) login.delete(key);
    }
    return {
      success: () => settle("success"),
      failure: () => settle("failure"),
      cancel: () => settle("cancel"),
    };
  }

  return { allowRegistration, beginLogin };
}

// Opportunistic cleanup: once at startup, then at most once per interval
// whenever an authenticated request is handled. Avoids long-lived timers and
// touching SQLite while test fixtures are being closed.
function createSessionSweeper(prune, { now = Date.now, intervalMs = 60 * 60 * 1000 } = {}) {
  if (typeof prune !== "function" || !Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new TypeError("Invalid session sweeper configuration");
  }
  let nextSweepAt = 0;
  return function sweep(force = false) {
    const time = now();
    if (!force && time < nextSweepAt) return 0;
    nextSweepAt = time + intervalMs;
    return prune();
  };
}

module.exports = { createAbuseGuard, createSessionSweeper };
