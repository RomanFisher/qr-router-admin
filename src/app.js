const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const { requireAuth } = require('./middleware/auth');
const { detectLocale, translate, SUPPORTED_LOCALES } = require('./i18n');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const redirectRoutes = require('./routes/redirect');
const localeRoutes = require('./routes/locale');

function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;

  const dataDir = path.join(__dirname, '..', 'data');
  const secretPath = path.join(dataDir, '.session_secret');
  if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();

  fs.mkdirSync(dataDir, { recursive: true });
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(cookieParser());
  app.use(
    session({
      secret: resolveSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
    })
  );

  app.use((req, res, next) => {
    req.locale = detectLocale(req);
    req.t = (key, vars) => translate(req.locale, key, vars);
    res.locals.locale = req.locale;
    res.locals.supportedLocales = SUPPORTED_LOCALES;
    res.locals.currentPath = req.originalUrl;
    res.locals.t = req.t;
    next();
  });

  app.use(localeRoutes);
  app.use(redirectRoutes);
  app.use(authRoutes);
  app.use('/admin', requireAuth);
  app.use(adminRoutes);

  app.get('/', (req, res) => res.redirect('/admin'));

  app.use((req, res) => res.status(404).send(req.t('errors.notFound')));

  return app;
}

module.exports = { createApp };
