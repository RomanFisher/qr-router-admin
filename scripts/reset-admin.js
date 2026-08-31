const bcrypt = require('bcryptjs');
const { setSetting } = require('../src/db');

const [, , username, password] = process.argv;

if (!username || !password || password.length < 8) {
  console.error('Usage: node scripts/reset-admin.js <username> <password (min 8 chars)>');
  process.exit(1);
}

setSetting('admin_username', username);
setSetting('admin_password_hash', bcrypt.hashSync(password, 10));

console.log(`Admin account set: ${username}`);
