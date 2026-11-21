"use strict";
// M8-C3：僅使用 Node 內建 runner，不碰正式 data/taskflow.db。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { validateChange, createRealtimeNotifier } = require('../server/realtime-notifier');
const { validChange, createRealtimeCoordinator } = require('../public/task-realtime');

class FakeSocket extends EventEmitter {
  connected = false;
  room = null;
  connect() { this.connected = true; super.emit('connect'); }
  disconnect() { this.connected = false; super.emit('disconnect'); }
  timeout() { return this; }
  emit(event, ...args) {
    if (event === 'project:join') {
      this.room = args[0].projectId;
      args[1](null, { ok: true, projectId: this.room });
      return true;
    }
    if (event === 'project:leave') { this.room = null; return true; }
    return super.emit(event, ...args);
  }
}

test('M8-C3 realtime 協議：接受不含留言正文的 comment ID 通知', () => {
  const input = { projectId: 4, resource: 'comment', action: 'created', resourceId: 7, version: 1 };
  assert.deepEqual(validateChange(input), {
    projectId: 4, change: { resource: 'comment', action: 'created', resourceId: 7, version: 1 },
  });
  assert.equal(validChange(input), true);
  for (const action of ['created', 'updated', 'deleted']) {
    assert.equal(validChange({ projectId: 4, resource: 'comment', action, resourceId: 7 }), true);
  }
});

test('M8-C3 realtime 協議：不接受私有留言正文、非法 ID、未知事件', () => {
  assert.equal(validateChange({ projectId: 4, resource: 'comment', action: 'created', body: '秘密' }), null);
  assert.equal(validChange({ projectId: 4, resource: 'comment', action: 'created', body: '秘密' }), false,
    '前端亦必須拒絕夾帶私有正文的事件');
  assert.equal(validChange({ projectId: 0, resource: 'comment', action: 'updated' }), false);
  assert.equal(validChange({ projectId: 4, resource: 'comment', action: 'invalid' }), false);
  assert.equal(validateChange({ projectId: 4, resource: 'comment', action: 'updated', resourceId: '7' }), null);
});

test('M8-C3 HTTP 完成通知：僅在 2xx 且 Repo 明確註記時推播', () => {
  const sent = [];
  const notifier = createRealtimeNotifier(() => (projectId, change) => sent.push({ projectId, change }));
  const ok = new EventEmitter();
  ok.statusCode = 201;
  ok.locals = { taskflowRealtimeChange: { projectId: 1, resource: 'comment', action: 'created', resourceId: 9, version: 1 } };
  notifier({}, ok, () => {});
  ok.emit('finish');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].change.resourceId, 9);
  const conflict = new EventEmitter();
  conflict.statusCode = 409;
  conflict.locals = { taskflowRealtimeChange: { projectId: 1, resource: 'comment', action: 'updated', resourceId: 9 } };
  notifier({}, conflict, () => {});
  conflict.emit('finish');
  assert.equal(sent.length, 1, '409 不可送事件');
  const empty = new EventEmitter();
  empty.statusCode = 204;
  empty.locals = {};
  notifier({}, empty, () => {});
  empty.emit('finish');
  assert.equal(sent.length, 1, '沒有 Repo 標記即使 204 也不可送');
});

test('M8-C3 Socket：限定 Room 專案，comment 不觸發 Kanban 全表刷新，重新加入補抓', () => {
  const socket = new FakeSocket();
  const comments = [];
  const joined = [];
  const boards = [];
  const coordinator = createRealtimeCoordinator({
    createSocket: () => socket,
    onChange: item => { boards.push(item); return true; },
    onRevoked: () => {},
    onStatus: () => {},
    onCollaborationChange: item => comments.push(item),
    onRoomJoined: id => joined.push(id),
    delay: 0,
    schedule: fn => { fn(); return 1; },
    cancel: () => {},
  });
  coordinator.setProject(1);
  coordinator.start();
  assert.deepEqual(joined, [1]);
  socket.emit('project:changed', { projectId: 2, resource: 'comment', action: 'created', resourceId: 3 });
  assert.equal(comments.length, 0, '不得接受其他專案事件');
  socket.emit('project:changed', { projectId: 1, resource: 'comment', action: 'created', resourceId: 3 });
  assert.equal(comments.length, 1);
  assert.equal(comments[0].resource, 'comment');
  // Room 首次加入可能安排板資料同步；comment 本身不應額外排全板刷新。
  const previous = boards.length;
  socket.emit('project:changed', { projectId: 1, resource: 'comment', action: 'deleted', resourceId: 3 });
  assert.equal(boards.length, previous);
  socket.disconnect();
  socket.connect();
  assert.deepEqual(joined, [1, 1]);
  coordinator.stop();
});
