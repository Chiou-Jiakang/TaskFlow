"use strict";
// M8-C3：Edge + Socket.IO + REST 真實整合驗收。
// 只用 :memory: SQLite 與隨機本機 port；不讀寫正式 data/taskflow.db。
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { chromium } = require('playwright-core');
const { openDatabase, initializeSchema } = require('../server/db');
const { createApp } = require('../server/server');
const { attachRealtime } = require('../server/realtime-hub');

const USERS = {
  owner: { email: 'm8c3-owner@example.test', displayName: 'M8C3 Owner' },
  member: { email: 'm8c3-member@example.test', displayName: 'M8C3 Member' },
};
const PASSWORD = 'M8C3!IsolatedBrowserTesting2026';
function card(page) {
  return page.locator('.tf-task-card').filter({ has: page.locator('h4', { hasText: 'M8C3 shared task' }) });
}
async function ready(page) {
  await page.locator("#task-realtime-status[data-kind='success']").waitFor({ timeout: 12000 });
  await page.waitForFunction(() => document.querySelector('#task-message')?.textContent?.includes('已載入'), null, { timeout: 12000 });
}

test('M8-C3 Edge 兩人留言即時同步、活動時間軸與重連補抓', { timeout: 105000 }, async t => {
  const db = openDatabase(':memory:');
  initializeSchema(db);
  const app = createApp({ database: db });
  const server = app.listen(0, '127.0.0.1');
  let hub;
  let browser;
  const contexts = {};
  const pages = {};
  const errors = [];
  t.after(async () => {
    await Promise.allSettled(Object.values(contexts).map(c => c.close()));
    if (browser) await browser.close().catch(() => {});
    if (hub) await new Promise(resolve => hub.io.close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
    db.close();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  hub = attachRealtime(server, db);
  app.locals.publishProjectChanged = hub.publishProjectChanged;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const role of Object.keys(USERS)) {
    contexts[role] = await browser.newContext({ baseURL: base });
    pages[role] = await contexts[role].newPage();
    pages[role].on('pageerror', err => errors.push(`${role}: ${err.message}`));
  }
  async function login(role) {
    const page = pages[role];
    await page.goto('/auth.html');
    await page.locator('#login-email').fill(USERS[role].email);
    await page.locator('#login-password').fill(PASSWORD);
    await Promise.all([
      page.waitForURL(url => url.pathname === '/'),
      page.locator('#login-form button[type="submit"]').click(),
    ]);
    await page.locator('body.auth-ready').waitFor();
  }
  let projectId;
  let taskId;
  let csrf;
  let lastComment;
  const comments = pages.member.locator('#task-comments-list .tf-comments-item');
  const activity = pages.owner.locator('#task-activity-list .tf-activity-entry');
  const commentUrl = () => `${base}/api/projects/${projectId}/tasks/${taskId}/comments`;
  const actUrl = () => `${base}/api/projects/${projectId}/activity`;
  const writeOptions = data => ({ headers: { Origin: base, 'X-TaskFlow-CSRF': csrf }, ...(data ? { data } : {}) });
  async function requireStatus(response, status, label) {
    assert.equal(response.status(), status, `${label}: ${(await response.text()).slice(0, 240)}`);
  }
  await t.test('建立隔離的 Owner/Member 專案、兩組 Socket Room 訂閱', async () => {
    for (const user of Object.values(USERS)) {
      const result = await contexts.owner.request.post(`${base}/api/auth/register`, {
        headers: { Origin: base }, data: { ...user, password: PASSWORD },
      });
      await requireStatus(result, 201, '註冊');
    }
    await login('owner');
    await pages.owner.locator('#project-name').fill('M8C3 isolated collaboration');
    const [created] = await Promise.all([
      pages.owner.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/projects'),
      pages.owner.locator('#project-create button[type="submit"]').click(),
    ]);
    await requireStatus(created, 201, '建立專案');
    projectId = (await created.json()).project.id;
    await pages.owner.goto(`/members.html?projectId=${projectId}`);
    await pages.owner.locator('body.auth-ready').waitFor();
    await pages.owner.locator('#member-email').fill(USERS.member.email);
    await pages.owner.locator('#member-role').selectOption('member');
    const [added] = await Promise.all([
      pages.owner.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/projects/${projectId}/members`),
      pages.owner.locator('#member-add-form button[type="submit"]').click(),
    ]);
    await requireStatus(added, 201, '邀請成員');
    await pages.owner.goto('/');
    await pages.owner.locator('body.auth-ready').waitFor();
    await login('member');
    for (const page of Object.values(pages)) {
      await page.locator('#task-project-select').selectOption(String(projectId));
      await ready(page);
    }
    const session = await contexts.owner.request.get(`${base}/api/auth/me`);
    await requireStatus(session, 200, '取得 CSRF');
    csrf = (await session.json()).csrfToken;
    assert.match(csrf, /^[a-f0-9]{64}$/);
    await pages.owner.locator('#task-title').fill('M8C3 shared task');
    const [resp] = await Promise.all([
      pages.owner.waitForResponse(r => r.request().method() === 'POST' && /\/tasks$/.test(new URL(r.url()).pathname)),
      pages.owner.locator('#task-submit').click(),
    ]);
    await requireStatus(resp, 201, '建立任務');
    taskId = (await resp.json()).task.id;
    await card(pages.member).waitFor({ timeout: 12000 });
    await card(pages.member).getByRole('button', { name: '留言' }).click();
    await pages.member.locator('#task-comments-overlay').waitFor({ state: 'visible' });
    await pages.member.waitForFunction(() => document.querySelector('#task-comments-message')?.textContent?.includes('已載入'));
    await pages.owner.locator('#task-activity-open').click();
    await pages.owner.locator('#task-activity-overlay').waitFor({ state: 'visible' });
    await pages.owner.waitForFunction(() => document.querySelector('#task-activity-message')?.textContent?.includes('已載入'));
  });

  await t.test('Owner REST 新增留言 → Member 面板與 Owner 時間軸自動更新', async () => {
    const response = await contexts.owner.request.post(commentUrl(), writeOptions({ body: 'M8C3 live new comment' }));
    await requireStatus(response, 201, '新增留言');
    lastComment = (await response.json()).comment;
    await comments.filter({ hasText: 'M8C3 live new comment' }).waitFor({ timeout: 12000 });
    await activity.filter({ hasText: '新增了任務留言' }).waitFor({ timeout: 12000 });
    assert.equal(await activity.count(), 1);
    assert.equal(await pages.owner.locator('#task-activity-overlay').getByText('M8C3 live new comment').count(), 0);
  });

  await t.test('Owner 修改留言 → 其他頁面的內容及時間軸均自動更新', async () => {
    const response = await contexts.owner.request.patch(`${commentUrl()}/${lastComment.id}`,
      writeOptions({ version: lastComment.version, body: 'M8C3 live updated comment' }));
    await requireStatus(response, 200, '編輯留言');
    lastComment = (await response.json()).comment;
    await comments.filter({ hasText: 'M8C3 live updated comment' }).waitFor({ timeout: 12000 });
    await pages.owner.waitForFunction(() => document.querySelectorAll('#task-activity-list .tf-activity-entry').length === 2, null, { timeout: 12000 });
    assert.match(await activity.first().innerText(), /編輯了任務留言/);
  });

  await t.test('Owner 刪除留言 → Member 自動移除並保留活動紀錄', async () => {
    const response = await contexts.owner.request.delete(`${commentUrl()}/${lastComment.id}?version=${lastComment.version}`,
      writeOptions());
    await requireStatus(response, 204, '刪除留言');
    await pages.member.waitForFunction(() => document.querySelectorAll('#task-comments-list .tf-comments-item').length === 0, null, { timeout: 12000 });
    await pages.owner.waitForFunction(() => document.querySelectorAll('#task-activity-list .tf-activity-entry').length === 3, null, { timeout: 12000 });
    assert.match(await activity.first().innerText(), /刪除了任務留言/);
  });

  await t.test('Member 離線期間寫入；重新加入 Room 後 REST 補抓留言', async () => {
    await pages.member.evaluate(() => window.TaskRealtime.stop());
    const response = await contexts.owner.request.post(commentUrl(), writeOptions({ body: 'M8C3 offline catchup' }));
    await requireStatus(response, 201, '離線新增留言');
    assert.equal(await comments.count(), 0, '離線不可假裝已同步');
    await pages.member.evaluate(id => { window.TaskRealtime.setProject(id); window.TaskRealtime.start(); }, projectId);
    await pages.member.locator("#task-realtime-status[data-kind='success']").waitFor({ timeout: 12000 });
    await comments.filter({ hasText: 'M8C3 offline catchup' }).waitFor({ timeout: 12000 });
    assert.deepEqual(errors, [], '不應產生未捕捉的瀏覽器頁面錯誤');
  });

  await t.test('留言只透過 REST 授權取得，不在 Socket 通知曝露正文', async () => {
    const data = await (await contexts.owner.request.get(actUrl())).json();
    assert.equal(Array.isArray(data.activities), true);
    assert.equal(data.activities.length, 4);
    assert.equal(JSON.stringify(data.activities).includes('M8C3 offline catchup'), false);
  });
});
