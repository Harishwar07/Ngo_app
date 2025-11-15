const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

console.log('🔐 AUTH middleware using JWT_SECRET:', process.env.JWT_SECRET);

/**
 * verifyToken - verify JWT and attach user info
 */
async function verifyToken(req, res, next) {
  try {
    // ✅ Try Authorization header first
    let token = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // ✅ Then check HttpOnly cookie
    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    // ✅ Check if token revoked
    const { rows: revoked } = await db.query('SELECT 1 FROM revoked_tokens WHERE token = $1', [token]);
    if (revoked.length > 0) {
      return res.status(401).json({ error: 'Token revoked. Please log in again.' });
    }

    // ✅ Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // ✅ Attach user info
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err) {
    console.error('verifyToken error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}



/**
 * requireRole - allow only specific roles
 * Usage: requireRole('admin','staff')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (allowedRoles.includes(req.user.role) || req.user.role === 'super_admin') return next();
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  };
}

/**
 * RBAC middleware - automatically checks permissions by HTTP method
 */
function rbacAccess() {
  // define what each role can do
  const rules = {
    member:      { GET: true,  POST: false, PUT: false, PATCH: false, DELETE: false },
    staff:       { GET: true,  POST: true,  PUT: true,  PATCH: true,  DELETE: false },
    admin:       { GET: true,  POST: true,  PUT: true,  PATCH: true,  DELETE: true },
    finance:     { GET: true,  POST: true,  PUT: false, PATCH: false, DELETE: false },
    super_admin: { GET: true,  POST: true,  PUT: true,  PATCH: true,  DELETE: true },
  };

  return (req, res, next) => {
    const role = req.user?.role;
    const method = req.method.toUpperCase();

    if (!role) return res.status(401).json({ error: 'Unauthorized: no role' });

    const roleRules = rules[role];
    if (!roleRules) return res.status(403).json({ error: `Role '${role}' not recognized` });

    const allowed = roleRules[method];
    if (!allowed) {
      return res.status(403).json({ error: `Role '${role}' not allowed to ${method}` });
    }

    next();
  };
}

/**
 * requireOwnerOrAdmin - allow owner of the FRF record, or admin/staff/super_admin
 */
async function requireOwnerOrAdmin(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const role = req.user.role;
    if (role === 'admin' || role === 'staff' || role === 'super_admin') return next();

    // determine entity from baseUrl: /api/v1/students -> students_frf_owner style
    const parts = req.baseUrl.split('/');
    const entity = parts[parts.length - 1];

    const map = {
      students_frf_owner: { table: 'students', idcol: 'id', ownercol: 'student_frf_owner' },
      volunteers_frf_owner: { table: 'volunteers', idcol: 'id', ownercol: 'volunteer_frf_owner' },
      donors_frf_owner: { table: 'donors', idcol: 'id', ownercol: 'donor_frf_owner' },
      board_frf_owner: { table: 'board_members', idcol: 'id', ownercol: 'board_frf_owner' },
      projects_frf_owner: { table: 'projects', idcol: 'id', ownercol: 'project_frf_owner' },
      finance_frf_owner: { table: 'finance_reports', idcol: 'id', ownercol: 'finance_report_frf_owner' },
    };

    const cfg = map[entity];
    if (!cfg) return res.status(400).json({ error: 'requireOwnerOrAdmin: unknown entity' });

    const recordId = req.params.id;
    if (!recordId) return res.status(400).json({ error: 'Missing resource id' });

    const q = `SELECT ${cfg.ownercol} FROM ${cfg.table} WHERE ${cfg.idcol} = $1 LIMIT 1`;
    const { rows } = await db.query(q, [recordId]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });

    const recordOwner = rows[0][cfg.ownercol];
    if (
      String(recordOwner) === String(req.user.email) ||
      String(recordOwner) === String(req.user.user_id)
    ) {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: not owner' });
  } catch (err) {
    console.error('requireOwnerOrAdmin error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * requireReadAccess - for list endpoints: members and above
 */
function requireReadAccess(req, res, next) {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

module.exports = {
  verifyToken,
  requireRole,
  requireOwnerOrAdmin,
  requireReadAccess,
  rbacAccess,
};
