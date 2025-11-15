const bcrypt = require('bcrypt');
const db = require('../db');

(async () => {
  const { rows } = await db.query('SELECT user_id, password_hash FROM users');
  for (const user of rows) {
    if (!user.password_hash.startsWith('$2b$')) { // detect unhashed passwords
      const hashed = await bcrypt.hash(user.password_hash, 10);
      await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashed, user.user_id]);
      console.log(`✅ Hashed password for user ID: ${user.user_id}`);
    }
  }
  console.log('All unhashed passwords have been updated.');
  process.exit();
})();
