const express = require('express');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const { db, getSetting, setSetting } = require('../db');
const { slugify } = require('../utils/slug');
const { getBaseUrl } = require('../utils/baseUrl');

const router = express.Router();

function flashAndRedirect(req, res, message, to) {
  req.session.flash = message;
  res.redirect(to);
}

router.get('/admin', (req, res) => {
  const codes = db.prepare('SELECT * FROM qr_codes ORDER BY created_at DESC').all();
  const baseUrl = getBaseUrl(req);
  const flash = req.session.flash;
  delete req.session.flash;
  res.render('dashboard', { codes, baseUrl, flash });
});

router.post('/admin/codes', (req, res) => {
  const title = (req.body.title || '').trim();
  if (!title) return flashAndRedirect(req, res, req.t('flash.titleRequired'), '/admin');

  let slug = slugify(title);
  if (!slug) slug = 'code-' + Date.now();

  let finalSlug = slug;
  let i = 1;
  while (db.prepare('SELECT 1 FROM qr_codes WHERE slug = ?').get(finalSlug)) {
    finalSlug = `${slug}-${i++}`;
  }

  const result = db
    .prepare('INSERT INTO qr_codes (slug, title) VALUES (?, ?)')
    .run(finalSlug, title);

  res.redirect(`/admin/codes/${result.lastInsertRowid}`);
});

router.get('/admin/codes/:id', (req, res) => {
  const code = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!code) return res.status(404).send(req.t('errors.codeNotFound'));

  const destinations = db
    .prepare('SELECT * FROM destinations WHERE qr_code_id = ? ORDER BY created_at DESC')
    .all(code.id);

  const baseUrl = getBaseUrl(req);
  const flash = req.session.flash;
  delete req.session.flash;
  res.render('code', { code, destinations, baseUrl, flash });
});

router.post('/admin/codes/:id/delete', (req, res) => {
  db.prepare('DELETE FROM qr_codes WHERE id = ?').run(req.params.id);
  flashAndRedirect(req, res, req.t('flash.codeDeleted'), '/admin');
});

router.post('/admin/codes/:id/destinations', (req, res) => {
  const code = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!code) return res.status(404).send(req.t('errors.codeNotFound'));

  const label = (req.body.label || '').trim();
  const url = (req.body.url || '').trim();

  if (!label || !url || !/^https?:\/\//i.test(url)) {
    return flashAndRedirect(req, res, req.t('flash.destinationInvalid'), `/admin/codes/${code.id}`);
  }

  const result = db
    .prepare('INSERT INTO destinations (qr_code_id, label, url) VALUES (?, ?, ?)')
    .run(code.id, label, url);

  if (!code.active_destination_id) {
    db.prepare('UPDATE qr_codes SET active_destination_id = ? WHERE id = ?').run(
      result.lastInsertRowid,
      code.id
    );
  }

  flashAndRedirect(req, res, req.t('flash.destinationAdded'), `/admin/codes/${code.id}`);
});

router.post('/admin/codes/:id/active', (req, res) => {
  const code = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!code) return res.status(404).send(req.t('errors.codeNotFound'));

  const destination = db
    .prepare('SELECT * FROM destinations WHERE id = ? AND qr_code_id = ?')
    .get(req.body.destination_id, code.id);
  if (!destination) {
    return flashAndRedirect(req, res, req.t('flash.destinationNotFound'), `/admin/codes/${code.id}`);
  }

  db.prepare('UPDATE qr_codes SET active_destination_id = ? WHERE id = ?').run(
    destination.id,
    code.id
  );

  flashAndRedirect(
    req,
    res,
    req.t('flash.activeSet', { label: destination.label }),
    `/admin/codes/${code.id}`
  );
});

router.post('/admin/codes/:id/destinations/:destId/delete', (req, res) => {
  const code = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!code) return res.status(404).send(req.t('errors.codeNotFound'));

  db.prepare('DELETE FROM destinations WHERE id = ? AND qr_code_id = ?').run(
    req.params.destId,
    code.id
  );

  flashAndRedirect(req, res, req.t('flash.destinationDeleted'), `/admin/codes/${code.id}`);
});

router.get('/admin/codes/:id/qr.png', async (req, res) => {
  const code = db.prepare('SELECT * FROM qr_codes WHERE id = ?').get(req.params.id);
  if (!code) return res.status(404).send(req.t('errors.codeNotFound'));

  const targetUrl = `${getBaseUrl(req)}/r/${code.slug}`;
  res.type('png');
  QRCode.toFileStream(res, targetUrl, { width: 512, margin: 2 });
});

router.get('/admin/settings', (req, res) => {
  const baseDomain = getSetting('base_domain') || '';
  const adminUsername = getSetting('admin_username') || '';
  const flash = req.session.flash;
  delete req.session.flash;
  res.render('settings', { baseDomain, adminUsername, flash });
});

router.post('/admin/settings', (req, res) => {
  const value = (req.body.base_domain || '').trim().replace(/\/+$/, '');
  setSetting('base_domain', value);
  flashAndRedirect(req, res, req.t('flash.settingsSaved'), '/admin/settings');
});

router.post('/admin/settings/password', (req, res) => {
  const currentPassword = req.body.current_password || '';
  const newPassword = req.body.new_password || '';
  const newPasswordConfirm = req.body.new_password_confirm || '';

  const storedHash = getSetting('admin_password_hash');
  if (!bcrypt.compareSync(currentPassword, storedHash)) {
    return flashAndRedirect(req, res, req.t('flash.currentPasswordWrong'), '/admin/settings');
  }
  if (newPassword.length < 8) {
    return flashAndRedirect(req, res, req.t('flash.newPasswordTooShort'), '/admin/settings');
  }
  if (newPassword !== newPasswordConfirm) {
    return flashAndRedirect(req, res, req.t('flash.newPasswordsMismatch'), '/admin/settings');
  }

  setSetting('admin_password_hash', bcrypt.hashSync(newPassword, 10));
  flashAndRedirect(req, res, req.t('flash.passwordChanged'), '/admin/settings');
});

module.exports = router;
