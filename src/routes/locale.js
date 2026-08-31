const express = require('express');
const { SUPPORTED_LOCALES } = require('../i18n');

const router = express.Router();

router.get('/set-locale/:locale', (req, res) => {
  const { locale } = req.params;
  if (SUPPORTED_LOCALES.includes(locale)) {
    res.cookie('lang', locale, { maxAge: 1000 * 60 * 60 * 24 * 365, sameSite: 'lax' });
  }

  const redirectTo = req.query.redirect;
  const isSafeRelativePath =
    typeof redirectTo === 'string' && /^\/(?!\/)/.test(redirectTo) && !redirectTo.includes('\\');

  res.redirect(isSafeRelativePath ? redirectTo : '/');
});

module.exports = router;
