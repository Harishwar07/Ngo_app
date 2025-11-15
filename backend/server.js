// server.js
// ✅ NGO FRF Management System - Secure Backend API Server (Production-Ready, No CSURF)

require('dotenv').config();
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const https = require('https');
const db = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;
const USE_HTTPS = process.env.USE_HTTPS === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

// ✅ Trust proxy (needed for HTTPS detection behind Nginx/Render)
app.set('trust proxy', 1);

// ✅ Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: false, // allow images/scripts if needed
  })
);

// ✅ Core Middlewares
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Rate Limiting (anti-bruteforce / DoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// ✅ CORS (Strictly allow your frontend only)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'https://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// ✅ Safe HTTPS Redirect (for production behind proxy)
app.use((req, res, next) => {
  const behindProxy = !!req.headers['x-forwarded-proto'];
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (isProd && behindProxy && req.headers['x-forwarded-proto'] !== 'https' && !isLocal) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ✅ Debug route (development only)
if (!isProd) {
  app.get('/debug', (req, res) => {
    res.json({
      secure: req.secure,
      protocol: req.protocol,
      xForwardedProto: req.headers['x-forwarded-proto'] || null,
    });
  });
}

// ✅ Default Route
app.get('/', (req, res) => {
  res.send('✅ NGO FRF API Server is running securely (No CSURF, Origin-based protection active).');
});

// ✅ API Routes
const usersRoutes = require('./routes/users');
const studentsRoutes = require('./routes/students');
const volunteersRoutes = require('./routes/volunteers');
const donorsRoutes = require('./routes/donors');
const boardRoutes = require('./routes/board');
const projectsRoutes = require('./routes/projects');
const financeRoutes = require('./routes/finance');
const uiConfigRoutes = require('./routes/uiConfig');

app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/students', studentsRoutes);
app.use('/api/v1/volunteers', volunteersRoutes);
app.use('/api/v1/donors', donorsRoutes);
app.use('/api/v1/board', boardRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/v1/ui-config', uiConfigRoutes);

// ✅ Centralized Error Handler (must be LAST)
app.use(errorHandler);

// ✅ Create Default Super Admin (if missing)
async function ensureSuperAdmin() {
  try {
    if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
      console.warn('⚠️ Missing SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD. Skipping super admin creation.');
      return;
    }

    const { rows } = await db.query(`SELECT * FROM users WHERE user_role = 'super_admin' LIMIT 1`);
    if (rows.length > 0) {
      console.log('✅ Super admin already exists:', rows[0].email);
      return;
    }

    const bcrypt = require('bcrypt');
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
    const hash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, saltRounds);

    const insert = `
      INSERT INTO users (username, email, password_hash, user_role, approval_status, created_at)
      VALUES ($1, $2, $3, 'super_admin', 'APPROVED', NOW())
      RETURNING user_id, username, email, user_role;
    `;
    const { rows: newAdmin } = await db.query(insert, [
      process.env.SUPER_ADMIN_NAME || 'Super Admin',
      process.env.SUPER_ADMIN_EMAIL,
      hash,
    ]);

    console.log('🛠️ Created default super_admin:', newAdmin[0].email);
  } catch (err) {
    console.error('❌ Failed to ensure super_admin:', err.message);
  }
}

// ✅ Start Server (HTTPS or HTTP)
async function startServer() {
  try {
    const result = await db.query('SELECT NOW()');
    console.log(`✅ Connected to DB at ${result.rows[0].now}`);
    await ensureSuperAdmin();

    if (USE_HTTPS) {
      if (!fs.existsSync('./certs/server.key') || !fs.existsSync('./certs/server.cert')) {
        console.error('❌ SSL certificates not found in ./certs/. Run with USE_HTTPS=false for local dev.');
        process.exit(1);
      }

      const sslOptions = {
        key: fs.readFileSync('./certs/server.key'),
        cert: fs.readFileSync('./certs/server.cert'),
      };

      https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`🔒 HTTPS Server running securely at https://localhost:${PORT}`);
      });
    } else {
      app.listen(PORT, () => {
        console.log(`🚀 HTTP Server running at http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
  }
}

startServer();
