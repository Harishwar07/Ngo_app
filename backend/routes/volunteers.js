// backend/routes/volunteers.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, rbacAccess, requireOwnerOrAdmin } = require('../middleware/auth');
const { volunteerValidation } = require('../middleware/validators');
const { emailValidation, phoneValidation, nameValidation, runValidation } = require('../middleware/globalValidators');


/* ==========================================================
   🔹 GET ALL VOLUNTEERS (Members and above)
========================================================== */
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM volunteers ORDER BY volunteer_frf_name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching volunteers:', err);
    res.status(500).send('Error fetching volunteers');
  }
});

/* ==========================================================
   🔹 GET VOLUNTEER WITH ATTENDANCE LOGS
========================================================== */
// GET SINGLE VOLUNTEER (Owner/Admin/Staff/SuperAdmin)
// GET SINGLE VOLUNTEER WITH CREATED/MODIFIED USER DETAILS
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const volunteerQuery = `
      SELECT 
        v.*,

        -- Creator Info
        u1.username AS created_by_username,
        u1.email AS created_by_email,

        -- Modifier Info
        u2.username AS modified_by_username,
        u2.email AS modified_by_email

      FROM volunteers v
      LEFT JOIN users u1 ON v.created_by_user_id = u1.user_id
      LEFT JOIN users u2 ON v.modified_by_user_id = u2.user_id
      WHERE v.id = $1
    `;

    const { rows } = await db.query(volunteerQuery, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Volunteer not found' });
    }

    const volunteer = rows[0];

    // === GET ATTENDANCE LOGS ===
    const logsQuery = `
      SELECT attendance_id, volunteer_id, attendance_date, attendance_status, performance, remarks
      FROM volunteer_attendance
      WHERE volunteer_id = $1
      ORDER BY attendance_date DESC
    `;
    const { rows: logs } = await db.query(logsQuery, [id]);

    volunteer.attendance_logs = logs;

    res.json(volunteer);

  } catch (err) {
    console.error('Error fetching volunteer details:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



/* ==========================================================
   🔹 CREATE VOLUNTEER (Admin, Staff, SuperAdmin)
========================================================== */
router.post('/', verifyToken, rbacAccess(), volunteerValidation, emailValidation('email'), emailValidation('secondary_email'), phoneValidation('contact_number'), phoneValidation('emergency_contact_number'), nameValidation('volunteer_frf_name'), runValidation, async (req, res) => {
  try {
    const {
      id,
      volunteer_frf_name,
      volunteer_frf_owner,
      volunteer_id,
      email,
      secondary_email,
      email_opt_out,
      gender,
      date_of_birth,
      father_name,
      mother_name,
      contact_number,
      emergency_contact_number,
      address,
      blood_group,
      company_name,
      experience,
      skill,
      id_proof_type,
      id_number,
      joining_date,
      proof_file_upload,
      modified_by_user_id
    } = req.body;

    const q = `
      INSERT INTO volunteers (
        id, volunteer_frf_name, volunteer_frf_owner, volunteer_id,
        email, secondary_email, email_opt_out,
        created_by_date, modified_by_user_id, modified_date,
        gender, date_of_birth, father_name, mother_name,
        contact_number, emergency_contact_number, address, blood_group,
        company_name, experience, skill, id_proof_type, id_number,
        joining_date, proof_file_upload
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,COALESCE($7,false),
        NOW(), $23, NOW(),
        $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      RETURNING *;
    `;

    const vals = [
      id, volunteer_frf_name, volunteer_frf_owner, volunteer_id,
      email, secondary_email, email_opt_out,
      gender, date_of_birth, father_name, mother_name,
      contact_number, emergency_contact_number, address, blood_group,
      company_name, experience, skill, id_proof_type, id_number,
      joining_date, proof_file_upload, modified_by_user_id
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating volunteer:', err);
    res.status(500).send('Error creating volunteer');
  }
});

/* ==========================================================
   🔹 PUT (FULL UPDATE) VOLUNTEER
========================================================== */
router.put('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const keys = Object.keys(updates);
    if (keys.length === 0)
      return res.status(400).json({ message: 'No fields to update' });

    const vals = Object.values(updates);
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const q = `
      UPDATE volunteers
      SET ${set}, modified_date = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *;
    `;
    const { rows } = await db.query(q, [...vals, id]);

    if (!rows.length)
      return res.status(404).json({ error: 'Volunteer not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating volunteer:', err);
    res.status(500).send('Error updating volunteer');
  }
});

/* ==========================================================
   🔹 PATCH (PARTIAL UPDATE) VOLUNTEER
========================================================== */
router.patch('/:id', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'), phoneValidation('contact_number'), phoneValidation('emergency_contact_number'), runValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const keys = Object.keys(updates);
    if (keys.length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    const values = Object.values(updates);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    const q = `
      UPDATE volunteers
      SET ${setClause}, modified_date = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(q, [...values, id]);
    if (!rows.length)
      return res.status(404).json({ error: 'Volunteer not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error patching volunteer:', err);
    res.status(500).send('Error patching volunteer');
  }
});


router.patch('/volunteer-attendance/:attendance_id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { attendance_id } = req.params;
    const updates = req.body;

    const keys = Object.keys(updates);
    if (keys.length === 0)
      return res.status(400).json({ message: "No fields to update" });

    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(updates);

    const q = `
      UPDATE volunteer_attendance
      SET ${setClause}
      WHERE attendance_id = $${keys.length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(q, [...values, attendance_id]);

    if (!rows.length)
      return res.status(404).json({ message: "Attendance log not found" });

    res.json(rows[0]);

  } catch (err) {
    console.error("Error updating volunteer attendance:", err);
    res.status(500).json({ error: "Error updating volunteer attendance" });
  }
});


/* ==========================================================
   🔹 DELETE VOLUNTEER (Admin/Staff/SuperAdmin)
========================================================== */
router.delete('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;

    // Delete attendance logs first
    await db.query('DELETE FROM volunteer_attendance WHERE volunteer_id = $1', [id]);

    const result = await db.query('DELETE FROM volunteers WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount)
      return res.status(404).json({ message: 'Volunteer not found' });

    res.json({ message: 'Volunteer and related attendance deleted successfully' });
  } catch (err) {
    console.error('Error deleting volunteer:', err);
    res.status(500).send('Error deleting volunteer');
  }
});

/* ==========================================================
   🔹 POST ATTENDANCE FOR VOLUNTEER
========================================================== */
router.post('/:id/attendance', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance_date, attendance_status, performance, remarks } = req.body;

    const q = `
      INSERT INTO volunteer_attendance (
        volunteer_id, attendance_date, attendance_status, performance, remarks
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *;
    `;
    const vals = [id, attendance_date, attendance_status, performance, remarks];
    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding attendance:', err);
    res.status(500).send('Error adding attendance');
  }
});

module.exports = router;
