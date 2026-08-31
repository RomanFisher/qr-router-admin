const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/r/:slug', (req, res) => {
  const code = db.prepare('SELECT * FROM qr_codes WHERE slug = ?').get(req.params.slug);
  if (!code) return res.status(404).send(req.t('errors.notFound'));

  if (!code.active_destination_id) {
    return res.status(200).send(req.t('errors.codeNotConfigured'));
  }

  const destination = db
    .prepare('SELECT * FROM destinations WHERE id = ?')
    .get(code.active_destination_id);
  if (!destination) return res.status(200).send(req.t('errors.codeNotConfigured'));

  res.redirect(302, destination.url);
});

module.exports = router;
