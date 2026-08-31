const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, cookieJar, form } = require('./helpers');

let server, base;
const jar = cookieJar();
let codeId, slug, destA, destB;

test.before(async () => {
  ({ server, base } = await startTestServer());

  await fetch(`${base}/setup`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({ username: 'admin', password: 'TestPass123', password_confirm: 'TestPass123' }),
  }).then((res) => jar.capture(res));

  const codeRes = await fetch(`${base}/admin/codes`, {
    method: 'POST',
    redirect: 'manual',
    headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: form({ title: 'Concurrency Test' }),
  });
  codeId = codeRes.headers.get('location').split('/').pop();

  const html = await (await fetch(`${base}/admin/codes/${codeId}`, { headers: jar.headers() })).text();
  slug = html.match(/\/r\/([a-z0-9-]+)/)[1];

  for (const url of ['https://example.com/a', 'https://example.com/b']) {
    await fetch(`${base}/admin/codes/${codeId}/destinations`, {
      method: 'POST',
      headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: form({ label: url, url }),
    });
  }
  const codeHtml = await (await fetch(`${base}/admin/codes/${codeId}`, { headers: jar.headers() })).text();
  [destA, destB] = [...codeHtml.matchAll(/destination_id" value="(\d+)"/g)].map((m) => m[1]);
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('scans arriving while the admin is switching the active destination never see a broken redirect', async () => {
  const TOTAL_SCANS = 1000;
  const VALID_LOCATIONS = new Set(['https://example.com/a', 'https://example.com/b']);

  let switching = true;
  const switchLoop = (async () => {
    let useA = true;
    while (switching) {
      await fetch(`${base}/admin/codes/${codeId}/active`, {
        method: 'POST',
        headers: jar.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        body: form({ destination_id: useA ? destA : destB }),
      });
      useA = !useA;
      await new Promise((r) => setTimeout(r, 5));
    }
  })();

  const results = await Promise.all(
    Array.from({ length: TOTAL_SCANS }, () => fetch(`${base}/r/${slug}`, { redirect: 'manual' }))
  );

  switching = false;
  await switchLoop;

  for (const res of results) {
    assert.equal(res.status, 302, 'every scan must get a redirect, never an error');
    const loc = res.headers.get('location');
    assert.ok(VALID_LOCATIONS.has(loc), `location must be one of the two known destinations, got: ${loc}`);
  }
});
