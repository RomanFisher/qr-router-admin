const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('./helpers');

let server, base;

test.before(async () => {
  ({ server, base } = await startTestServer());
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test('no Accept-Language header -> defaults to English', async () => {
  const res = await fetch(`${base}/setup`);
  const html = await res.text();
  assert.match(html, /Create admin account/);
});

test('Accept-Language: uk -> Ukrainian', async () => {
  const res = await fetch(`${base}/setup`, { headers: { 'Accept-Language': 'uk-UA,uk;q=0.9' } });
  const html = await res.text();
  assert.match(html, /Створення акаунту адміна/);
});

test('Accept-Language: pl -> Polish', async () => {
  const res = await fetch(`${base}/setup`, { headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' } });
  const html = await res.text();
  assert.match(html, /Utwórz konto administratora/);
});

test('Accept-Language for an unsupported language -> falls back to English', async () => {
  const res = await fetch(`${base}/setup`, { headers: { 'Accept-Language': 'de-DE,de;q=0.9,fr;q=0.8' } });
  const html = await res.text();
  assert.match(html, /Create admin account/);
});

test('switching language via /set-locale sets a cookie that sticks without Accept-Language', async () => {
  const switchRes = await fetch(`${base}/set-locale/uk?redirect=%2Fsetup`, { redirect: 'manual' });
  assert.equal(switchRes.status, 302);
  assert.equal(switchRes.headers.get('location'), '/setup');
  const setCookie = switchRes.headers.get('set-cookie');
  assert.match(setCookie, /lang=uk/);

  const cookie = setCookie.split(';')[0];
  const res = await fetch(`${base}/setup`, { headers: { Cookie: cookie } });
  const html = await res.text();
  assert.match(html, /Створення акаунту адміна/);
});

test('cookie choice wins over Accept-Language', async () => {
  const res = await fetch(`${base}/setup`, {
    headers: { Cookie: 'lang=pl', 'Accept-Language': 'uk-UA,uk;q=0.9' },
  });
  const html = await res.text();
  assert.match(html, /Utwórz konto administratora/);
});

test('/set-locale rejects an unsupported locale code without setting a cookie', async () => {
  const res = await fetch(`${base}/set-locale/de?redirect=%2Fsetup`, { redirect: 'manual' });
  assert.equal(res.headers.get('set-cookie'), null);
});

test('/set-locale only redirects to a safe same-origin path, never to an external URL', async () => {
  const attempts = ['https://evil.example.com', '//evil.example.com', '/\\evil.example.com'];
  for (const target of attempts) {
    const res = await fetch(`${base}/set-locale/en?redirect=${encodeURIComponent(target)}`, {
      redirect: 'manual',
    });
    assert.equal(res.headers.get('location'), '/', `unsafe redirect target should collapse to "/": ${target}`);
  }
});
