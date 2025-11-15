// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const uiConfig = require('./uiConfig');
const { verifyToken, rbacAccess, requireOwnerOrAdmin } = require('../middleware/auth');
const { projectValidation } = require('../middleware/validators');
const { emailValidation, runValidation } = require('../middleware/globalValidators');


/* ==========================================================
   🔹 GET ALL PROJECTS (Members and above)
========================================================== */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, project_frf_name, email, project_frf_owner, modified_date
      FROM projects
      ORDER BY project_frf_name ASC
    `);
    res.json({ data: result.rows, uiConfig: uiConfig.projects });
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).send('Error fetching projects');
  }
});

/* ==========================================================
   🔹 GET SINGLE PROJECT (Owner or Admin/Staff)
========================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const projectQ = `
      SELECT 
        p.*,
        cu.username AS created_by_username,
        cu.email AS created_by_email,
        mu.username AS modified_by_username,
        mu.email AS modified_by_email
      FROM projects p
      LEFT JOIN users cu ON p.created_by_user_id = cu.user_id
      LEFT JOIN users mu ON p.modified_by_user_id = mu.user_id
      WHERE p.id = $1
    `;

    const { rows: projectRows } = await db.query(projectQ, [id]);
    if (projectRows.length === 0)
      return res.status(404).json({ message: 'Project not found' });

    const project = projectRows[0];

    // Fetch attendance logs
    const logsQ = `
  SELECT 
    project_attendance_log_id,
    TO_CHAR(log_date, 'DD-MM-YYYY') AS log_date,
    attent_list,
    absent_list,
    overall,
    remarks
  FROM project_attendance_logs
  WHERE project_id = $1
  ORDER BY log_date DESC
`;

    const { rows: logs } = await db.query(logsQ, [id]);

    project.attendance_logs = logs;

    res.json(project);

  } catch (err) {
    console.error('Error fetching project details:', err);
    res.status(500).send('Error fetching project details');
  }
});


/* ==========================================================
   🔹 CREATE NEW PROJECT (Owner, Admin, Staff, SuperAdmin)
========================================================== */
router.post('/', verifyToken, rbacAccess(), projectValidation, emailValidation('email'), emailValidation('secondary_email'), runValidation, async (req, res) => {
  try {
    const {
      id,
      project_frf_name,
      project_frf_owner,
      project_id,
      email,
      secondary_email,
      email_opt_out,
      start_date,
      duration,
      objective,
      budget,
      budget_utilized,
      impact_summary,
      end_date,
      location,
      target_group,
      responsible_officer_user_id,
      status,
      modified_by_user_id
    } = req.body;

    const q = `
      INSERT INTO projects (
        id, project_frf_name, project_frf_owner, project_id,
        email, secondary_email, email_opt_out,
        created_by_date, modified_by_user_id, modified_date,
        start_date, duration, objective, budget, budget_utilized,
        impact_summary, end_date, location, target_group,
        responsible_officer_user_id, status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,COALESCE($7,false),
        NOW(), $8, NOW(),
        $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      RETURNING *;
    `;

    const vals = [
      id, project_frf_name, project_frf_owner, project_id,
      email, secondary_email, email_opt_out,
      modified_by_user_id,
      start_date, duration, objective, budget, budget_utilized,
      impact_summary, end_date, location, target_group,
      responsible_officer_user_id, status
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).send('Error creating project');
  }
});

/* ==========================================================
   🔹 ADD ATTENDANCE LOG TO PROJECT
========================================================== */
router.post('/:id/attendance', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const { log_date, attent_list, absent_list, overall, remarks } = req.body;

    const q = `
      INSERT INTO project_attendance_logs
      (project_id, log_date, attent_list, absent_list, overall, remarks)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *;
    `;
    const vals = [id, log_date, attent_list, absent_list, overall, remarks];
    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding project attendance:', err);
    res.status(500).send('Error adding project attendance');
  }
});

/* ==========================================================
   🔹 UPDATE PROJECT (PUT - Full Update)
========================================================== */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      project_frf_name,
      project_frf_owner,
      project_id,
      email,
      secondary_email,
      email_opt_out,
      start_date,
      duration,
      objective,
      budget,
      budget_utilized,
      impact_summary,
      end_date,
      location,
      target_group,
      responsible_officer_user_id,
      status
    } = req.body;

    const q = `
      UPDATE projects
      SET
        project_frf_name = $1,
        project_frf_owner = $2,
        project_id = $3,
        email = $4,
        secondary_email = $5,
        email_opt_out = COALESCE($6, email_opt_out),
        start_date = $7,
        duration = $8,
        objective = $9,
        budget = $10,
        budget_utilized = $11,
        impact_summary = $12,
        end_date = $13,
        location = $14,
        target_group = $15,
        responsible_officer_user_id = $16,
        status = $17,
        modified_date = NOW()
      WHERE id = $18
      RETURNING *;
    `;

    const vals = [
      project_frf_name, project_frf_owner, project_id,
      email, secondary_email, email_opt_out,
      start_date, duration, objective, budget, budget_utilized,
      impact_summary, end_date, location, target_group,
      responsible_officer_user_id, status, id
    ];

    const { rows } = await db.query(q, vals);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).send('Error updating project');
  }
});

/* ==========================================================
   🔹 PARTIAL UPDATE PROJECT (PATCH)
========================================================== */
router.patch('/:id', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'), runValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(req.body)) {
      updates.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    const q = `
      UPDATE projects
      SET ${updates.join(', ')}, modified_date = NOW()
      WHERE id = $${i}
      RETURNING *;
    `;
    values.push(id);

    const { rows } = await db.query(q, values);
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error patching project:', err);
    res.status(500).send('Error patching project');
  }
});

router.patch('/attendance_logs/:log_id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { log_id } = req.params;
    const updates = req.body;

    if (!Object.keys(updates).length)
      return res.status(400).json({ message: "Nothing to update" });

    const setClause = Object.keys(updates)
      .map((field, i) => `${field} = $${i + 1}`)
      .join(", ");

    const values = [...Object.values(updates), log_id];

    const q = `
      UPDATE project_attendance_logs
      SET ${setClause}
      WHERE project_attendance_log_id = $${Object.keys(updates).length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(q, values);

    if (!rows.length)
      return res.status(404).json({ message: "Attendance log not found" });

    res.json(rows[0]);

  } catch (err) {
    console.error("Error patching project attendance:", err);
    res.status(500).json({ error: "Error updating project attendance" });
  }
});




/* ==========================================================
   🔹 DELETE PROJECT (Admin, Staff, SuperAdmin)
========================================================== */
router.delete('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;

    // Remove associated attendance logs first
    await db.query('DELETE FROM project_attendance_logs WHERE project_id = $1', [id]);

    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Project not found' });

    res.json({ message: 'Project and related attendance logs deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).send('Error deleting project');
  }
});

module.exports = router;
