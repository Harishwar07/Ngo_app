'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../db');
const { verifyToken, rbacAccess } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validators');
require('dotenv').config();

const router = express.Router();

// ---------------------------------------------------
// CONFIG
// ---------------------------------------------------
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
const isProd = process.env.NODE_ENV === 'production';

// ---------------------------------------------------
// EMAIL TRANSPORTER (Nodemailer)
// ---------------------------------------------------
const transporter = require('nodemailer').createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// ---------------------------------------------------
// TOKEN HELPERS
// ---------------------------------------------------
function createAccessToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.user_role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function createRefreshToken() {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  return { token: uuidv4(), expiresAt };
}

const cookieOptions = ({ maxAge } = {}) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'Strict' : 'Lax',
  ...(maxAge ? { maxAge } : {}),
});

// ---------------------------------------------------
// USER REGISTRATION (auto PENDING approval)
// ---------------------------------------------------
router.post('/', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password, user_role } = req.body;

  try {
    const { rows: exists } = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.length) return res.status(400).json({ error: 'Email already exists' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const q = `
      INSERT INTO users (username, email, password_hash, user_role, approval_status, created_at)
      VALUES ($1,$2,$3,COALESCE($4,'member'),'PENDING',NOW())
      RETURNING user_id, username, email, user_role, approval_status, created_at;
    `;
    const { rows } = await db.query(q, [username, email, password_hash, user_role]);

    res.status(201).json({
      message: 'Account created. Awaiting admin approval.',
      user: rows[0],
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------
// USER LOGIN (with approval + lockout)
// ---------------------------------------------------
router.post('/login', loginValidation, async (req, res) => {
  const { email, password } = req.body;

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];

    // Approval check
    if (user.approval_status !== 'APPROVED') {
      const msg =
        user.approval_status === 'REJECTED'
          ? 'Account has been rejected by admin'
          : 'Account pending admin approval';
      return res.status(403).json({ error: msg });
    }

    // Lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(403).json({ error: `Account locked. Try again in ${mins} minutes.` });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        await db.query(
          `UPDATE users SET failed_attempts=$1, locked_until = NOW() + INTERVAL '15 minutes' WHERE user_id=$2`,
          [attempts, user.user_id]
        );
      } else {
        await db.query(`UPDATE users SET failed_attempts=$1 WHERE user_id=$2`, [attempts, user.user_id]);
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success: reset counters
    await db.query(`UPDATE users SET failed_attempts=0, locked_until=NULL WHERE user_id=$1`, [user.user_id]);

    const accessToken = createAccessToken(user);
    const refresh = createRefreshToken();

    await db.query(
      `INSERT INTO refresh_tokens (user_id, refresh_token, issued_at, expires_at, device)
       VALUES ($1,$2,NOW(),$3,$4)`,
      [user.user_id, refresh.token, refresh.expiresAt, req.get('user-agent') || null]
    );

    res.cookie('access_token', accessToken, cookieOptions({ maxAge: 15 * 60 * 1000 }));
    res.cookie('refresh_token', refresh.token, { ...cookieOptions(), expires: refresh.expiresAt });

    res.json({ message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------
// REFRESH TOKEN
// ---------------------------------------------------
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return res.status(400).json({ error: 'Missing refresh token' });

    const { rows } = await db.query(
      'SELECT * FROM refresh_tokens WHERE refresh_token=$1 AND expires_at > NOW()',
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid refresh token' });

    const user_id = rows[0].user_id;
    const { rows: users } = await db.query('SELECT * FROM users WHERE user_id=$1', [user_id]);
    if (!users.length) return res.status(401).json({ error: 'User not found' });

    const user = users[0];
    const accessToken = createAccessToken(user);
    res.cookie('access_token', accessToken, cookieOptions({ maxAge: 15 * 60 * 1000 }));

    res.json({ message: 'Access token refreshed' });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------
// LOGOUT
// ---------------------------------------------------
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    const accessToken = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];

    if (refreshToken)
      await db.query('DELETE FROM refresh_tokens WHERE refresh_token = $1', [refreshToken]);

    if (accessToken)
      await db.query('INSERT INTO revoked_tokens (token) VALUES ($1) ON CONFLICT DO NOTHING', [accessToken]);

    res.clearCookie('access_token', cookieOptions());
    res.clearCookie('refresh_token', cookieOptions());
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------
// ADMIN: Pending Users
// ---------------------------------------------------
router.get(
  '/pending',
  verifyToken,
  rbacAccess(['admin', 'super_admin']),
  async (req, res) => {
    try {
      const { rows } = await db.query(
        "SELECT user_id, username, email, user_role, approval_status, created_at FROM users WHERE approval_status = 'PENDING' ORDER BY created_at ASC"
      );
      res.json(rows);
    } catch (err) {
      console.error('Pending users error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ---------------------------------------------------
// ADMIN: Approve User
// ---------------------------------------------------
router.post(
  '/:id/approve',
  verifyToken,
  rbacAccess(['admin', 'super_admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await db.query(
        `UPDATE users SET approval_status='APPROVED', updated_at=NOW() WHERE user_id=$1 RETURNING user_id, username, email, approval_status`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const user = rows[0];

      try {
        if (user.email) {
          await transporter.sendMail({
            from: `"NGO FRF" <${process.env.SMTP_EMAIL}>`,
            to: user.email,
            subject: 'Account Approved',
            html: `<p>Hello ${user.username || ''},</p><p>Your account has been approved. You can now log in.</p><p>– NGO FRF Team</p>`,
          });
        }
      } catch (mailErr) {
        console.warn('Approval email failed:', mailErr.message);
      }

      res.json({ message: 'User approved', user });
    } catch (err) {
      console.error('Approve user error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ---------------------------------------------------
// ADMIN: Reject User
// ---------------------------------------------------
router.post(
  '/:id/reject',
  verifyToken,
  rbacAccess(['admin', 'super_admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const { rows } = await db.query(
        `UPDATE users SET approval_status='REJECTED', updated_at=NOW() WHERE user_id=$1 RETURNING user_id, username, email, approval_status`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const user = rows[0];

      try {
        if (user.email) {
          await transporter.sendMail({
            from: `"NGO FRF" <${process.env.SMTP_EMAIL}>`,
            to: user.email,
            subject: 'Account Rejected',
            html: `<p>Hello ${user.username || ''},</p><p>Your account registration has been rejected by admin.</p>${reason ? `<p>Reason: ${reason}</p>` : ''}<p>– NGO FRF Team</p>`,
          });
        }
      } catch (mailErr) {
        console.warn('Rejection email failed:', mailErr.message);
      }

      res.json({ message: 'User rejected', user });
    } catch (err) {
      console.error('Reject user error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ---------------------------------------------------
// UPDATE USER (PATCH)
// ---------------------------------------------------
router.patch('/:id', verifyToken, rbacAccess(['admin', 'super_admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(req.body)) {
      if (key === 'password') {
        const hashed = await bcrypt.hash(value, SALT_ROUNDS);
        fields.push(`password_hash = $${i}`);
        values.push(hashed);
      } else {
        fields.push(`${key} = $${i}`);
        values.push(value);
      }
      i++;
    }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    const q = `UPDATE users SET ${fields.join(', ')}, updated_at=NOW() WHERE user_id=$${i} RETURNING user_id, username, email, user_role, approval_status`;
    const { rows } = await db.query(q, values);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Patch user error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------
// DELETE USER (ADMIN + SUPER_ADMIN) with restrictions
// ---------------------------------------------------
router.delete('/:id', verifyToken, rbacAccess(['admin', 'super_admin']), async (req, res) => {
  try {
    const targetId = req.params.id;
    const requester = req.user; // user making request

    // 1️⃣ Cannot delete yourself
    if (Number(targetId) === Number(requester.user_id)) {
      return res.status(403).json({ error: "You cannot delete your own account" });
    }

    // 2️⃣ Load target user
    const { rows } = await db.query(
      `SELECT user_id, user_role FROM users WHERE user_id = $1`,
      [targetId]
    );

    if (!rows.length) return res.status(404).json({ error: "User not found" });

    const target = rows[0];

    // 3️⃣ Super Admin cannot be deleted by ANYONE
    if (target.user_role === "super_admin") {
      return res.status(403).json({ error: "Super Admin cannot be deleted" });
    }

    // 4️⃣ Admin can delete ONLY members
    if (requester.role === "admin") {
      if (target.user_role !== "member") {
        return res.status(403).json({ error: "Admins can only delete members" });
      }
    }

    // 5️⃣ SUPER ADMIN can delete anyone except SUPER ADMIN
    // (Already handled above)

    // 6️⃣ Delete user now
    await db.query(`DELETE FROM users WHERE user_id = $1`, [targetId]);

    res.json({ message: "User deleted successfully" });

  } catch (err) {
    console.error("Delete user error:", err.message);
    if (err.code === "23503") {
      return res.status(400).json({
        error: "Cannot delete user: dependent records exist"
      });
    }
    res.status(500).json({ error: "Server error" });
  }
});


// ---------------------------------------------------
// CURRENT USER INFO
// ---------------------------------------------------
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { rows } = await db.query(
      'SELECT user_id, username, email, user_role, approval_status FROM users WHERE user_id=$1',
      [user_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Me route error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
