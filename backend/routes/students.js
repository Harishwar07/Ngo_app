// backend/routes/students.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const uiConfig = require('./uiConfig');
const { verifyToken, rbacAccess } = require('../middleware/auth');
const { studentValidation } = require('../middleware/validators');
const { emailValidation, phoneValidation, runValidation } = require('../middleware/globalValidators');


/* ==========================================================
   GET ALL STUDENTS + AVG SCORE
========================================================== */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.student_frf_name,
        s.class,
        s.section,
        ROUND(COALESCE(AVG(l.overall_score), 0), 2) AS avg_overall_score
      FROM students s
      LEFT JOIN student_session_logs l 
        ON s.id = l.student_id
      GROUP BY s.id
      ORDER BY s.student_frf_name ASC
    `);

    res.json({
      data: result.rows,
      uiConfig: uiConfig.students
    });

  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).send('Error fetching students');
  }
});


/* ==========================================================
   GET SINGLE STUDENT + CREATED / MODIFIED BY USER DETAILS
========================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const studentQ = `
      SELECT 
        s.*,
        cu.username AS created_by_username,
        cu.email AS created_by_email,
        mu.username AS modified_by_username,
        mu.email AS modified_by_email
      FROM students s
      LEFT JOIN users cu ON s.created_by_user_id = cu.user_id
      LEFT JOIN users mu ON s.modified_by_user_id = mu.user_id
      WHERE s.id = $1
    `;

    const { rows: studentRows } = await db.query(studentQ, [id]);
    if (!studentRows.length)
      return res.status(404).json({ message: "Student not found" });

    const student = studentRows[0];

    // Session Logs
    const logsQ = `
  SELECT
    session_log_id,
    TO_CHAR(session_date, 'DD-MM-YYYY') AS session_date,
    course,
    topic_covered,
    interest_level,
    challenges_faced,
    understanding_level,
    overall_score,
    remarks,
    feedback,
    home_work
  FROM student_session_logs
  WHERE student_id = $1
  ORDER BY session_date DESC
`;

    const { rows: logs } = await db.query(logsQ, [id]);

    student.session_logs = logs;

    res.json(student);

  } catch (err) {
    console.error('Error fetching student details:', err);
    res.status(500).send('Error fetching student details');
  }
});


/* ==========================================================
   CREATE STUDENT
========================================================== */
router.post('/', verifyToken, rbacAccess(), studentValidation, emailValidation('email'), emailValidation('secondary_email'), phoneValidation('parents_contact_number'), runValidation, async (req, res) => {
  try {
    const {
      id,
      student_frf_name,
      student_frf_owner,
      email,
      secondary_email,
      email_opt_out,
      date_of_birth,
      father_name,
      mother_name,
      parents_contact_number,
      address,
      monthly_income,
      permanent_address,
      class: className,
      section,
      medium,
      school
    } = req.body;

    const user_id = req.user.user_id;

    const q = `
      INSERT INTO students (
        id, student_frf_name, student_frf_owner, email, secondary_email, email_opt_out,
        created_by_user_id, created_by_date,
        modified_by_user_id, modified_date,
        date_of_birth, father_name, mother_name, parents_contact_number,
        address, monthly_income, permanent_address, "class", section, medium, school
      ) VALUES (
        $1,$2,$3,$4,$5,COALESCE($6,false),
        $7, NOW(),
        $7, NOW(),
        $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
      )
      RETURNING *;
    `;

    const vals = [
      id, student_frf_name, student_frf_owner, email, secondary_email, email_opt_out,
      user_id,
      date_of_birth, father_name, mother_name, parents_contact_number,
      address, monthly_income, permanent_address, className, section, medium, school
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('Error creating student:', err);
    res.status(500).send('Error creating student');
  }
});


/* ==========================================================
   FULL UPDATE (PUT)
========================================================== */
router.put('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!Object.keys(updates).length)
      return res.status(400).json({ message: 'No fields to update' });

    const setClause = Object.keys(updates)
      .map((k, i) => `${k} = $${i + 1}`)
      .join(', ');

    const q = `
      UPDATE students
      SET ${setClause},
          modified_by_user_id = $${Object.keys(updates).length + 1},
          modified_date = NOW()
      WHERE id = $${Object.keys(updates).length + 2}
      RETURNING *;
    `;

    const params = [...Object.values(updates), req.user.user_id, id];

    const { rows } = await db.query(q, params);

    if (!rows.length)
      return res.status(404).json({ message: 'Student not found' });

    res.json(rows[0]);

  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Error updating student' });
  }
});


/* ==========================================================
   PARTIAL UPDATE (PATCH)
========================================================== */
router.patch('/:id', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'), phoneValidation('parents_contact_number'), runValidation, async (req, res) => {
  try {
    const updates = req.body;
    const { id } = req.params;

    if (!Object.keys(updates).length)
      return res.status(400).json({ error: 'No fields to update' });

    const setClause = Object.keys(updates)
      .map((k, i) => `${k} = $${i + 1}`)
      .join(', ');

    const q = `
      UPDATE students
      SET ${setClause},
          modified_by_user_id = $${Object.keys(updates).length + 1},
          modified_date = NOW()
      WHERE id = $${Object.keys(updates).length + 2}
      RETURNING *;
    `;

    const params = [...Object.values(updates), req.user.user_id, id];

    const { rows } = await db.query(q, params);

    if (!rows.length)
      return res.status(404).json({ error: 'Student not found' });

    res.json(rows[0]);

  } catch (err) {
    console.error('Error patching student:', err);
    res.status(500).json({ error: 'Error patching student' });
  }
});


/* ==========================================================
   PATCH SESSION LOG (CORRECTED)
========================================================== */
router.patch('/session-logs/:log_id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { log_id } = req.params;
    const updates = req.body;

    if (!Object.keys(updates).length)
      return res.status(400).json({ message: "No fields to update" });

    const set = Object.keys(updates)
      .map((k, i) => `${k} = $${i + 1}`)
      .join(", ");

    const values = Object.values(updates);

    const q = `
      UPDATE student_session_logs
      SET ${set}
      WHERE session_log_id = $${Object.keys(updates).length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(q, [...values, log_id]);

    if (!rows.length)
      return res.status(404).json({ message: "Session log not found" });

    res.json(rows[0]);

  } catch (err) {
    console.error("Error patching session log:", err);
    res.status(500).json({ message: "Error patching session log" });
  }
});


/* ==========================================================
   DELETE STUDENT
========================================================== */
router.delete('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(`DELETE FROM student_session_logs WHERE student_id = $1`, [id]);
    const result = await db.query(`DELETE FROM students WHERE id = $1 RETURNING id`, [id]);

    if (!result.rowCount)
      return res.status(404).json({ message: 'Student not found' });

    res.json({ message: 'Student deleted successfully' });

  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Error deleting student' });
  }
});


/* ==========================================================
   ADD SESSION LOG
========================================================== */
router.post('/:id/session-logs', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;

    const {
      session_date,
      course,
      topic_covered,
      interest_level,
      challenges_faced,
      understanding_level,
      overall_score,
      remarks,
      feedback,
      home_work
    } = req.body;

    const q = `
      INSERT INTO student_session_logs (
        student_id, session_date, course, topic_covered, interest_level,
        challenges_faced, understanding_level, overall_score,
        remarks, feedback, home_work
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *;
    `;

    const vals = [
      id, session_date, course, topic_covered, interest_level,
      challenges_faced, understanding_level, overall_score,
      remarks, feedback, home_work
    ];

    const { rows } = await db.query(q, vals);

    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('Error adding session log:', err);
    res.status(500).json({ error: 'Error adding session log' });
  }
});

module.exports = router;
