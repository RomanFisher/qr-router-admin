const express = require('express');
const bcrypt = require('bcryptjs');
const { getSetting, setSetting } = require('../db');

const router = express.Router();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  const now = Date.now();
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (entry) entry.count += 1;
}

function hasAdminAccount() {
  return !!getSetting('admin_password_hash');
}

router.get('/setup', (req, res) => {
  if (hasAdminAccount()) return res.redirect('/login');
  res.render('setup', { error: null });
});

router.post('/setup', (req, res) => {
  if (hasAdminAccount()) return res.redirect('/login');

  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const passwordConfirm = req.body.password_confirm || '';

  if (!username || password.length < 8) {
    return res.status(400).render('setup', { error: req.t('auth.setupValidation') });
  }
  if (password !== passwordConfirm) {
    return res.status(400).render('setup', { error: req.t('auth.setupPasswordsMismatch') });
  }

  setSetting('admin_username', username);
  setSetting('admin_password_hash', bcrypt.hashSync(password, 10));

  req.session.userId = username;
  res.redirect('/admin');
});

router.get('/login', (req, res) => {
  if (!hasAdminAccount()) return res.redirect('/setup');
  if (req.session.userId) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  if (!hasAdminAccount()) return res.redirect('/setup');

  if (isRateLimited(req.ip)) {
    return res.status(429).render('login', { error: req.t('auth.rateLimited') });
  }

  const { username, password } = req.body;
  const storedUsername = getSetting('admin_username');
  const storedHash = getSetting('admin_password_hash');

  const ok = username === storedUsername && bcrypt.compareSync(password || '', storedHash);
  if (!ok) {
    recordFailedAttempt(req.ip);
    return res.status(401).render('login', { error: req.t('auth.invalidCredentials') });
  }

  req.session.userId = storedUsername;
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
