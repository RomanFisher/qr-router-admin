const { getSetting } = require('../db');

function getBaseUrl(req) {
  const configured = getSetting('base_domain');
  if (configured) return configured.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

module.exports = { getBaseUrl };
