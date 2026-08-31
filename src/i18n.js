const uk = require('./locales/uk.json');
const en = require('./locales/en.json');
const pl = require('./locales/pl.json');

const locales = { uk, en, pl };
const SUPPORTED_LOCALES = Object.keys(locales);
const DEFAULT_LOCALE = 'en';

function getPath(obj, keyPath) {
  return keyPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function translate(locale, key, vars = {}) {
  const dict = locales[locale] || locales[DEFAULT_LOCALE];
  const template = getPath(dict, key) ?? getPath(locales[DEFAULT_LOCALE], key) ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`));
}

function detectLocale(req) {
  if (req.cookies && SUPPORTED_LOCALES.includes(req.cookies.lang)) {
    return req.cookies.lang;
  }

  const header = req.headers['accept-language'];
  if (header) {
    const preferred = header
      .split(',')
      .map((part) => part.split(';')[0].trim().toLowerCase().split('-')[0]);
    for (const lang of preferred) {
      if (SUPPORTED_LOCALES.includes(lang)) return lang;
    }
  }

  return DEFAULT_LOCALE;
}

module.exports = { locales, SUPPORTED_LOCALES, DEFAULT_LOCALE, translate, detectLocale };
