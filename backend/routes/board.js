// backend/routes/board.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const uiConfig = require('./uiConfig');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, rbacAccess, requireOwnerOrAdmin } = require('../middleware/auth');
const { boardValidation } = require('../middleware/validators');
const { emailValidation, nameValidation, phoneValidation, runValidation } = require('../middleware/globalValidators');


/* ==========================================================
   🔹 GET ALL BOARD MEMBERS (Members and above)
========================================================== */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, board_frf_name, email, board_frf_owner, modified_date
      FROM board_members
      ORDER BY board_frf_name ASC
    `);
    res.json({ data: result.rows, uiConfig: uiConfig.board });
  } catch (err) {
    console.error('Error fetching board members:', err);
    res.status(500).send('Error fetching board members');
  }
});

/* ==========================================================
   🔹 GET SINGLE BOARD MEMBER (Owner or Admin/Staff)
========================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const boardQ = `
      SELECT 
        b.*,

        -- CREATED BY USER
        cu.username AS created_by_username,
        cu.email    AS created_by_email,

        -- MODIFIED BY USER
        mu.username AS modified_by_username,
        mu.email    AS modified_by_email

      FROM board_members b
      LEFT JOIN users cu ON b.created_by_user_id = cu.user_id
      LEFT JOIN users mu ON b.modified_by_user_id = mu.user_id
      WHERE b.id = $1
    `;

    const { rows: boardRows } = await db.query(boardQ, [id]);
    if (boardRows.length === 0)
      return res.status(404).json({ message: 'Board Member not found' });

    const member = boardRows[0];


    res.json(member);

  } catch (err) {
    console.error('Error fetching board member details:', err);
    res.status(500).send('Error fetching board member details');
  }
});


/* ==========================================================
   🔹 CREATE NEW BOARD MEMBER (Admin / Staff / Super Admin)
========================================================== */
router.post('/', verifyToken, rbacAccess(), boardValidation, emailValidation('email'), emailValidation('secondary_email'), phoneValidation('contact_number'), nameValidation('board_frf_name'), runValidation, async (req, res) => {
  try {
    // Use user's ID from request body
    let { id } = req.body;

    const {
      board_frf_name,
      board_frf_owner,
      email,
      secondary_email,
      email_opt_out,

      gender,
      date_of_birth,
      contact_number,
      emergency_contact_number,
      blood_group,

      father_name,
      mother_name,
      address,

      id_proof_type,
      id_number,
      joining_date,
      proof_file_upload,

      designation,
      role_description,
      tenure_end
    } = req.body;

    const userId = req.user.user_id; // creator + modifier

    const q = `
      INSERT INTO board_members (
        id, board_frf_name, board_frf_owner, email, secondary_email, email_opt_out,
        created_by_user_id, created_by_date,
        modified_by_user_id, modified_date,

        gender, date_of_birth, contact_number, emergency_contact_number, blood_group,
        father_name, mother_name, address,
        id_proof_type, id_number, joining_date, proof_file_upload,
        designation, role_description, tenure_end
      )
      VALUES (
        $1,$2,$3,$4,$5,COALESCE($6,false),
        $7, NOW(),
        $7, NOW(),
        $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      RETURNING *;
    `;

    const vals = [
      id, board_frf_name, board_frf_owner, email, secondary_email, email_opt_out,
      userId,
      gender, date_of_birth, contact_number, emergency_contact_number, blood_group,
      father_name, mother_name, address,
      id_proof_type, id_number, joining_date, proof_file_upload,
      designation, role_description, tenure_end
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);

  } catch (err) {
    console.error("Error creating board member:", err);
    res.status(500).json({ error: "Error creating board member", details: err.message });
  }
});


/* ==========================================================
   🔹 UPDATE BOARD MEMBER (PUT - Full Update)
========================================================== */
router.put('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      board_frf_name,
      board_frf_owner,
      email,
      secondary_email,
      email_opt_out,
      gender,
      date_of_birth,
      contact_number,
      emergency_contact_number,
      blood_group,
      father_name,
      mother_name,
      address,
      id_proof_type,
      id_number,
      joining_date,
      proof_file_upload,
      designation,
      role_description,
      tenure_end
    } = req.body;

    const q = `
      UPDATE board_members
      SET
        board_frf_name = $1,
        board_frf_owner = $2,
        email = $3,
        secondary_email = $4,
        email_opt_out = COALESCE($5, email_opt_out),
        gender = $6,
        date_of_birth = $7,
        contact_number = $8,
        emergency_contact_number = $9,
        blood_group = $10,
        father_name = $11,
        mother_name = $12,
        address = $13,
        id_proof_type = $14,
        id_number = $15,
        joining_date = $16,
        proof_file_upload = $17,
        designation = $18,
        role_description = $19,
        tenure_end = $20,
        modified_date = NOW()
      WHERE id = $21
      RETURNING *;
    `;

    const vals = [
      board_frf_name, board_frf_owner, email, secondary_email, email_opt_out,
      gender, date_of_birth, contact_number, emergency_contact_number, blood_group,
      father_name, mother_name, address, id_proof_type, id_number, joining_date,
      proof_file_upload, designation, role_description, tenure_end, id
    ];

    const { rows } = await db.query(q, vals);
    if (!rows.length) return res.status(404).json({ error: 'Board member not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating board member:', err);
    res.status(500).json({ error: 'Error updating board member', details: err.message });
  }
});

/* ==========================================================
   🔹 PARTIAL UPDATE BOARD MEMBER (PATCH)
========================================================== */
router.patch('/:id', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'), phoneValidation('contact_number'), runValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(req.body)) {
      updates.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    const q = `
      UPDATE board_members
      SET ${updates.join(', ')}, modified_date = NOW()
      WHERE id = $${index}
      RETURNING *;
    `;
    values.push(id);

    const { rows } = await db.query(q, values);
    if (!rows.length) return res.status(404).json({ error: 'Board member not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error patching board member:', err);
    res.status(500).json({ error: 'Error patching board member', details: err.message });
  }
});

/* ==========================================================
   🔹 DELETE BOARD MEMBER (Admin, Staff, Super Admin)
========================================================== */
router.delete('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM board_members WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Board member not found' });
    res.json({ message: 'Board member deleted successfully' });
  } catch (err) {
    console.error('Error deleting board member:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete — dependent records exist' });
    }
    res.status(500).json({ error: 'Error deleting board member', details: err.message });
  }
});

module.exports = router;
