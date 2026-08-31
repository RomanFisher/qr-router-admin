process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-do-not-use-in-production';
process.env.DB_PATH = ':memory:';

const { createApp } = require('../src/app');

function startTestServer() {
  const app = createApp();
  const server = app.listen(0);
  return new Promise((resolve) => {
    server.once('listening', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

function cookieJar() {
  let cookie = '';
  return {
    headers(extra = {}) {
      return cookie ? { ...extra, Cookie: cookie } : extra;
    },
    capture(res) {
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
    },
  };
}

function form(fields) {
  return new URLSearchParams(fields).toString();
}

module.exports = { startTestServer, cookieJar, form };
