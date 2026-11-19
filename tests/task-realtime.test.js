"use strict";

// M7-C：獨立 Node.js 測試，不啟動或修改正式 SQLite。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { projectIdOf, validChange, createRealtimeCoordinator } =
  require("../public/task-realtime");

function setup({ canApply = () => true } = {}) {
  const listeners = new Map();
  const sent = [];
  const changes = [];
  const revoked = [];
  const statuses = [];
  const pendingTimers = new Map();
  let timerId = 0;
  let stopped = false;
  let expired = false;
  const socket = {
    connected: false,
    on(name, callback) { listeners.set(name, callback); return this; },
    removeAllListeners() { listeners.clear(); return this; },
    connect() { this.connected = true; listeners.get("connect")?.(); },
    disconnect() { this.connected = false; stopped = true; },
    emit(name, payload) { sent.push({ name, payload }); },
    timeout() {
      return { emit(name, payload, callback) {
        sent.push({ name, payload });
        if (name === "project:join") callback(null, { ok: true, projectId: payload.projectId, role: "owner" });
      } };
    },
    trigger(name, payload) { listeners.get(name)?.(payload); },
  };
  const coordinator = createRealtimeCoordinator({
    createSocket: () => socket,
    onChange(update) { if (!canApply()) return false; changes.push(update); return true; },
    onRevoked: (id) => revoked.push(id),
    onStatus: (label) => statuses.push(label),
    onExpired: () => { expired = true; },
    schedule(fn) { const id = ++timerId; pendingTimers.set(id, fn); return id; },
    cancel(id) { pendingTimers.delete(id); },
  });
  function tick() {
    const jobs = [...pendingTimers.values()];
    pendingTimers.clear();
    for (const fn of jobs) fn();
  }
  return { socket, coordinator, sent, changes, revoked, statuses, tick,
    stopped: () => stopped, expired: () => expired };
}

const event = (projectId, resource = "task", action = "updated") =>
  ({ projectId, resource, action, resourceId: 4, version: 2 });

test("M7-C 即時同步協調器與前端整合檢查", async (t) => {
  await t.test("專案 ID 與事件欄位驗證", () => {
    assert.equal(projectIdOf("42"), 42);
    assert.equal(projectIdOf(3), 3);
    for (const bad of [null, "01", "1evil", 0, -1, NaN, "99999999999999999"]) {
      assert.equal(projectIdOf(bad), null);
    }
    assert.equal(validChange(event(2)), true);
    assert.equal(validChange(event("2")), false);
    assert.equal(validChange({ ...event(2), resource: "secret" }), false);
    assert.equal(validChange({ ...event(2), action: "unknown" }), false);
  });

  await t.test("啟動後加入選定 Room，只接收該專案異動", () => {
    const { coordinator, socket, sent, changes, tick } = setup();
    coordinator.setProject("7");
    coordinator.start();
    assert.deepEqual(sent[0], { name: "project:join", payload: { projectId: 7 } });
    tick(); // 首次加入補抓
    changes.length = 0;
    socket.trigger("project:changed", event(8));
    socket.trigger("project:changed", event(7));
    tick();
    assert.deepEqual(changes, [{ projectId: 7, refreshProjects: false }]);
    coordinator.stop();
  });

  await t.test("同時間多次資料變更合併成一次 REST 刷新", () => {
    const { coordinator, socket, changes, tick } = setup();
    coordinator.setProject(1); coordinator.start(); tick(); changes.length = 0;
    socket.trigger("project:changed", event(1, "task", "moved"));
    socket.trigger("project:changed", event(1, "member", "updated"));
    socket.trigger("project:changed", event(1, "task", "deleted"));
    tick();
    assert.deepEqual(changes, [{ projectId: 1, refreshProjects: true }]);
    coordinator.stop();
  });

  await t.test("編輯或拖曳期間先暫存，解鎖後才同步", () => {
    let ready = false;
    const { coordinator, socket, changes, tick } = setup({ canApply: () => ready });
    coordinator.setProject(3); coordinator.start(); tick();
    assert.equal(changes.length, 0);
    socket.trigger("project:changed", event(3)); tick();
    assert.equal(changes.length, 0);
    assert.ok(coordinator.snapshot().pending);
    ready = true;
    coordinator.flushPending(); tick();
    assert.equal(changes.length, 1);
    assert.equal(coordinator.snapshot().pending, null);
    coordinator.stop();
  });

  await t.test("切換專案時退出舊 Room，舊專案事件不能誤刷新", () => {
    const { coordinator, socket, sent, changes, tick } = setup();
    coordinator.setProject(1); coordinator.start(); tick(); changes.length = 0;
    coordinator.setProject(2); tick(); changes.length = 0;
    assert.ok(sent.some((x) => x.name === "project:leave" && x.payload.projectId === 1));
    assert.ok(sent.some((x) => x.name === "project:join" && x.payload.projectId === 2));
    socket.trigger("project:changed", event(1));
    socket.trigger("project:changed", event(2)); tick();
    assert.deepEqual(changes, [{ projectId: 2, refreshProjects: false }]);
    coordinator.stop();
  });

  await t.test("斷線重連重新加入 Room 並重新取得完整清單", () => {
    const { coordinator, socket, changes, tick } = setup();
    coordinator.setProject(1); coordinator.start(); tick(); changes.length = 0;
    socket.connected = false;
    socket.trigger("disconnect", "transport close");
    socket.connected = true;
    socket.trigger("connect");
    tick();
    assert.deepEqual(changes, [{ projectId: 1, refreshProjects: true }]);
    coordinator.stop();
  });

  await t.test("失去專案資格時清除目標並通知前端清空舊資料", () => {
    const { coordinator, socket, revoked, tick } = setup();
    coordinator.setProject(1); coordinator.start(); tick();
    socket.trigger("project:access-revoked", { projectId: 99 });
    assert.deepEqual(revoked, []);
    socket.trigger("project:access-revoked", { projectId: 1 });
    assert.deepEqual(revoked, [1]);
    assert.equal(coordinator.snapshot().desiredProject, null);
    coordinator.stop();
  });

  await t.test("匿名／過期 Session 會終止 socket 並要求重新登入", () => {
    const { coordinator, socket, stopped, expired } = setup();
    coordinator.start();
    socket.trigger("connect_error", { message: "UNAUTHENTICATED" });
    assert.equal(stopped(), true);
    assert.equal(expired(), true);
  });

  await t.test("結束連線後不再處理已排定的更新", () => {
    const { coordinator, socket, changes, tick } = setup();
    coordinator.setProject(1); coordinator.start(); tick(); changes.length = 0;
    socket.trigger("project:changed", event(1));
    coordinator.stop(); tick();
    assert.equal(changes.length, 0);
  });

  await t.test("M7-C 入口按序載入且保留 M6 拖曳／版本檢查", () => {
    const pub = path.join(__dirname, "..", "public");
    const html = fs.readFileSync(path.join(pub, "index.html"), "utf8");
    const board = fs.readFileSync(path.join(pub, "task-board.js"), "utf8");
    const auth = fs.readFileSync(path.join(pub, "dashboard-auth.js"), "utf8");
    const loader = ["/socket.io/socket.io.js", "/task-realtime.js", "/task-board.js", "/dashboard-auth.js"];
    const positions = loader.map((x) => html.indexOf(x));
    assert.ok(positions.every((x) => x >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    assert.match(board, /realtimeSync\(update\)/);
    assert.match(board, /realtimeRevoked\(projectId\)/);
    assert.match(board, /state\.editingVersion \?\? editing\?\.version/);
    assert.match(board, /\$\{taskUrl\(task\.id\)\}\/move/);
    assert.match(auth, /TaskFlowDashboard = \{ reloadProjects: loadProjects \}/);
    assert.doesNotMatch(fs.readFileSync(path.join(pub, "task-realtime.js"), "utf8"), /\.innerHTML\s*=/);
  });
});
