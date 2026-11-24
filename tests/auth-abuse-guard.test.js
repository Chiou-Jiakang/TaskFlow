"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAbuseGuard, createSessionSweeper } = require("../server/auth-abuse-guard");

test("M10-A5b-1 abuse guard and session sweeper", async (t) => {
  await t.test("registration: 10 attempts per 15 minutes, then 429 eligibility", () => {
    let time = 10000;
    const guard = createAbuseGuard({ now: () => time });
    for (let i = 0; i < 10; i++) assert.equal(guard.allowRegistration("127.0.0.1"), true);
    assert.equal(guard.allowRegistration("127.0.0.1"), false);
    assert.equal(guard.allowRegistration("127.0.0.2"), true);
    time += 15 * 60 * 1000;
    assert.equal(guard.allowRegistration("127.0.0.1"), true);
  });

  await t.test("login: after 10 failures, block until window expires", () => {
    let time = 0;
    const guard = createAbuseGuard({ now: () => time });
    for (let i = 0; i < 10; i++) {
      const attempt = guard.beginLogin("ip-a");
      assert.ok(attempt);
      attempt.failure();
    }
    assert.equal(guard.beginLogin("ip-a"), null);
    assert.ok(guard.beginLogin("ip-b"));
    time += 15 * 60 * 1000;
    assert.ok(guard.beginLogin("ip-a"));
  });

  await t.test("parallel logins: reserve at most 10 slots before async scrypt", () => {
    const guard = createAbuseGuard();
    const tickets = Array.from({ length: 10 }, () => guard.beginLogin("shared-ip"));
    assert.equal(tickets.every(Boolean), true);
    assert.equal(guard.beginLogin("shared-ip"), null);
    tickets.forEach((ticket) => ticket.failure());
    assert.equal(guard.beginLogin("shared-ip"), null);
  });

  await t.test("successful login resets failures; errors release reserved slots", () => {
    const guard = createAbuseGuard();
    guard.beginLogin("ip-a").failure();
    guard.beginLogin("ip-a").success();
    for (let i = 0; i < 10; i++) {
      const ticket = guard.beginLogin("ip-a");
      assert.ok(ticket);
      ticket.cancel();
    }
    assert.ok(guard.beginLogin("ip-a"));
  });

  await t.test("maxKeys fails closed without unbounded map growth", () => {
    let time = 0;
    const guard = createAbuseGuard({ now: () => time, maxKeys: 2 });
    assert.equal(guard.allowRegistration("ip1"), true);
    assert.equal(guard.allowRegistration("ip2"), true);
    assert.equal(guard.allowRegistration("ip3"), false);
    time += 15 * 60 * 1000;
    assert.equal(guard.allowRegistration("ip3"), true);
  });

  await t.test("session sweep runs at startup and hourly, not per request", () => {
    let time = 100;
    let calls = 0;
    const sweep = createSessionSweeper(() => ++calls, {
      now: () => time,
      intervalMs: 1000,
    });
    assert.equal(sweep(true), 1);
    assert.equal(sweep(), 0);
    time += 999;
    assert.equal(sweep(), 0);
    time++;
    assert.equal(sweep(), 2);
  });
});
