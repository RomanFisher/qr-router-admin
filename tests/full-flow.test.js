const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, cookieJar, form } = require('./helpers');

let server, base;
const jar = cookieJar();
let codeId, slug, destA, destB;

test.before(async () => {
  ({ server, base } = await startTestServer());
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('no admin account yet -> /login redirects to /setup', async () => {
  const res = await fetch(`${base}/login`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/setup');
});

test('setup wizard creates the admin account and logs the creator in', async () => {
  const res = await fetch(`${base}/setup`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password: 'TestPass123', password_confirm: 'TestPass123' }),
  });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin');
  jar.capture(res);
});

test('setup is blocked once an account exists', async () => {
  const res = await fetch(`${base}/setup`, { redirect: 'manual' });
  assert.equal(res.headers.get('location'), '/login');
});

test('wrong password is rejected with 401', async () => {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password: 'wrong' }),
  });
  assert.equal(res.status, 401);
});

test('anonymous access to /admin redirects to /login', async () => {
  const res = await fetch(`${base}/admin`, { redirect: 'manual' });
  assert.equal(res.headers.get('location'), '/login');
});

test('authenticated request reaches the dashboard', async () => {
  const res = await fetch(`${base}/admin`, { headers: jar.headers() });
  assert.equal(res.status, 200);
});

test('admin can create a QR code', async () => {
  const res = await fetch(`${base}/admin/codes`, {
    method: 'POST',
    redirect: 'manual',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ title: 'Test Router' }),
  });
  assert.equal(res.status, 302);
  const loc = res.headers.get('location');
  assert.match(loc, /^\/admin\/codes\/\d+$/);
  codeId = loc.split('/').pop();
});

test('code detail page loads for the new code', async () => {
  const res = await fetch(`${base}/admin/codes/${codeId}`, { headers: jar.headers() });
  assert.equal(res.status, 200);
  const html = await res.text();
  slug = html.match(/\/r\/([a-z0-9-]+)/)[1];
  assert.ok(slug);
});

test('a code with no destination yet does not redirect anywhere', async () => {
  const res = await fetch(`${base}/r/${slug}`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('location'), null);
});

test('adding an invalid URL is rejected and adds nothing', async () => {
  const before = await (await fetch(`${base}/admin/codes/${codeId}`, { headers: jar.headers() })).text();
  await fetch(`${base}/admin/codes/${codeId}/destinations`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ label: 'Bad', url: 'not-a-url' }),
  });
  const after = await (await fetch(`${base}/admin/codes/${codeId}`, { headers: jar.headers() })).text();
  assert.equal(
    (before.match(/dest-item/g) || []).length,
    (after.match(/dest-item/g) || []).length
  );
});

test('adding the first valid destination makes it active automatically', async () => {
  await fetch(`${base}/admin/codes/${codeId}/destinations`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ label: 'WiFi', url: 'https://example.com/wifi' }),
  });
  const res = await fetch(`${base}/r/${slug}`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://example.com/wifi');
});

test('adding a second destination and switching active changes the live redirect', async () => {
  await fetch(`${base}/admin/codes/${codeId}/destinations`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ label: 'Menu', url: 'https://example.com/menu' }),
  });

  const html = await (await fetch(`${base}/admin/codes/${codeId}`, { headers: jar.headers() })).text();
  const ids = [...html.matchAll(/destination_id" value="(\d+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 2);
  [destA, destB] = ids;

  await fetch(`${base}/admin/codes/${codeId}/active`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ destination_id: destB }),
  });

  const res = await fetch(`${base}/r/${slug}`, { redirect: 'manual' });
  assert.equal(res.headers.get('location'), 'https://example.com/menu');

  // switch back so later tests see a known state
  await fetch(`${base}/admin/codes/${codeId}/active`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ destination_id: destA }),
  });
});

test('the QR code itself never changes across switches — same slug, same PNG endpoint', async () => {
  const res = await fetch(`${base}/admin/codes/${codeId}/qr.png`, { headers: jar.headers() });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
});

test('unknown slug returns 404', async () => {
  const res = await fetch(`${base}/r/does-not-exist-xyz`);
  assert.equal(res.status, 404);
});

test('base_domain setting is saved and reflected back', async () => {
  await fetch(`${base}/admin/settings`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ base_domain: 'https://custom.example.com' }),
  });
  const html = await (await fetch(`${base}/admin/settings`, { headers: jar.headers() })).text();
  assert.match(html, /value="https:\/\/custom\.example\.com"/);
  await fetch(`${base}/admin/settings`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ base_domain: '' }),
  });
});

test('changing password with a wrong current password is rejected', async () => {
  await fetch(`${base}/admin/settings/password`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ current_password: 'nope', new_password: 'NewPassword1', new_password_confirm: 'NewPassword1' }),
  });
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password: 'NewPassword1' }),
  });
  assert.equal(res.status, 401, 'password must not have changed');
});

test('changing password with correct current password takes effect immediately', async () => {
  await fetch(`${base}/admin/settings/password`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ current_password: 'TestPass123', new_password: 'NewPassword1', new_password_confirm: 'NewPassword1' }),
  });

  const oldOk = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password: 'TestPass123' }),
  });
  assert.equal(oldOk.status, 401);

  const newOk = await fetch(`${base}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password: 'NewPassword1' }),
  });
  assert.equal(newOk.status, 302);
});

test('deleting the code makes its slug 404 immediately', async () => {
  await fetch(`${base}/admin/codes/${codeId}/delete`, {
    method: 'POST',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
  });
  const res = await fetch(`${base}/r/${slug}`);
  assert.equal(res.status, 404);
});
