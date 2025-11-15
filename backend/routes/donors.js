// backend/routes/donors.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, rbacAccess, requireOwnerOrAdmin } = require('../middleware/auth');
const { donorValidation } = require('../middleware/validators');
const { emailValidation, phoneValidation, nameValidation, amountValidation, runValidation } = require('../middleware/globalValidators');


router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM donors ORDER BY donor_frf_name ASC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching donors:', err);
    res.status(500).send('Error fetching donors');
  }
});

// GET /:id — return donor + normalized donations array under `donations`
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const donorQ = `
      SELECT 
        d.*,

        cu.username AS created_by_username,
        cu.email AS created_by_email,

        mu.username AS modified_by_username,
        mu.email AS modified_by_email

      FROM donors d
      LEFT JOIN users cu ON d.created_by_user_id = cu.user_id
      LEFT JOIN users mu ON d.modified_by_user_id = mu.user_id
      WHERE d.id = $1;
    `;

    const { rows } = await db.query(donorQ, [id]);
    if (!rows.length) return res.status(404).json({ message: "Donor not found" });

    const donor = rows[0];

    // donor transactions
    const txQ = `
  SELECT 
    donation_id,
    transaction_id,
    TO_CHAR(donation_date, 'YYYY-MM-DD') AS donation_date,
    purpose,
    receipt_number,
    CASE WHEN "80g_receipt_issued" = true THEN 'Yes' ELSE 'No' END AS "80g_receipt_issued",
    CASE WHEN acknowledgment_sent = true THEN 'Yes' ELSE 'No' END AS acknowledgment_sent,
    donor_feedback,
    remarks,
    amount
  FROM donations
  WHERE donor_id = $1
  ORDER BY donation_date DESC;
`;

    const { rows: txns } = await db.query(txQ, [id]);

    donor.donations = txns;

    res.json(donor);

  } catch (err) {
    console.error("Error fetching donor details:", err);
    res.status(500).send("Error fetching donor details");
  }
});




// POST / — create donor (insert only actual donor table columns)
router.post('/', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'), phoneValidation('contact_number'), nameValidation('donor_frf_name'), donorValidation, runValidation, async (req, res) => {
  try {
    const {
      id,
      donor_frf_name,
      donor_frf_owner,
      donor_id,
      email,
      secondary_email,
      email_opt_out,
      contact_person,
      contact_number,
      address,
      donor_type,
      created_by_date,
      modified_by_user_id,
      modified_date
    } = req.body;

    const q = `
      INSERT INTO donors (
        id, donor_frf_name, donor_frf_owner, donor_id, email, secondary_email,
        email_opt_out, contact_person, contact_number, address,
        donor_type, created_by_date, modified_by_user_id, modified_date
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        COALESCE($7, false), $8, $9, $10,
        $11, COALESCE($12, NOW()), COALESCE($13::int, NULL), COALESCE($14, NOW())
      )
      RETURNING *;
    `;

    const vals = [
      id,
      donor_frf_name,
      donor_frf_owner,
      donor_id,
      email,
      secondary_email,
      email_opt_out,
      contact_person,
      contact_number,
      address,
      donor_type,
      created_by_date,
      modified_by_user_id,
      modified_date
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating donor:', err);
    res.status(500).send('Error creating donor');
  }
});



// POST /:id/donations — insert into donations table (singular -> plural fix) and return inserted row
router.post('/:id/donations', verifyToken, rbacAccess(), amountValidation('amount'), runValidation, async (req, res) => {
  try {
    const {
      donation_date,
      transaction_id,
      purpose,
      receipt_number,
      amount,
      remarks,
      donor_feedback,
      acknowledgment_sent,
      "80g_receipt_issued": eightyG // get using bracket notation
    } = req.body;

    const donor_id = req.params.id;

    const q = `
      INSERT INTO donations (
        donor_id,
        donation_date,
        transaction_id,
        purpose,
        receipt_number,
        "80g_receipt_issued",
        acknowledgment_sent,
        donor_feedback,
        remarks,
        amount
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *;
    `;

    const vals = [
      donor_id,
      donation_date,
      transaction_id,
      purpose,
      receipt_number,
      eightyG === true || eightyG === "true",
      acknowledgment_sent === true || acknowledgment_sent === "true",
      donor_feedback,
      remarks,
      amount
    ];

    const { rows } = await db.query(q, vals);

    res.status(201).json(rows[0]);

  } catch (err) {
    console.error("Error creating donation:", err);
    res.status(500).json({ error: "Error creating donation" });
  }
});



// UPDATE a donor by ID
router.put('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      donor_frf_name,
      donor_frf_owner,
      donor_id,
      email,
      secondary_email,
      email_opt_out,
      donor_type,
      contact_person,
      contact_number,
      address
    } = req.body;

    const q = `
      UPDATE donors
      SET donor_frf_name = $1,
          donor_frf_owner = $2,
          donor_id = $3,
          email = $4,
          secondary_email = $5,
          email_opt_out = COALESCE($6, false),
          modified_by_user_id = $2,
          modified_date = NOW(),
          donor_type = $7,
          contact_person = $8,
          contact_number = $9,
          address = $10
      WHERE id = $11
      RETURNING *;
    `;

    const vals = [
      donor_frf_name,
      donor_frf_owner,
      donor_id,
      email,
      secondary_email,
      email_opt_out,
      donor_type,
      contact_person,
      contact_number,
      address,
      id
    ];

    const { rows } = await db.query(q, vals);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    res.json({ message: 'Donor updated successfully', donor: rows[0] });
  } catch (err) {
    console.error('Error updating donor:', err);
    res.status(500).send('Error updating donor');
  }
});

// DELETE a donor by ID
router.delete('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;

    // Delete related donations first (if your DB has foreign key constraints)
    await db.query('DELETE FROM donations WHERE donor_id = $1', [id]);

    // Then delete the donor record
    const result = await db.query('DELETE FROM donors WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Donor not found' });
    }

    res.json({ message: 'Donor deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Error deleting donor:', err);
    res.status(500).send('Error deleting donor');
  }
});

router.patch('/:id', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'), phoneValidation('contact_number'), runValidation, async (req, res) => {
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

    values.push(id);
    const query = `UPDATE donors SET ${updates.join(', ')}, modified_date = NOW() WHERE id = $${i} RETURNING *`;
    const { rows } = await db.query(query, values);

    if (rows.length === 0) return res.status(404).json({ message: 'Donor not found' });

    res.json({ message: 'Donor updated successfully', donor: rows[0] });
  } catch (err) {
    console.error('Error updating donor:', err);
    res.status(500).send('Error updating donor');
  }
});

router.patch('/donations/:donation_id', verifyToken, rbacAccess(), amountValidation('amount'), runValidation, async (req, res) => {
  try {
    const { donation_id } = req.params;
    const updates = req.body;

    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ message: "Nothing to update" });

    const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const values = Object.values(updates);

    const q = `
      UPDATE donations
      SET ${set}
      WHERE donation_id = $${keys.length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(q, [...values, donation_id]);
    if (!rows.length) return res.status(404).json({ message: "Donation not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Error patching donation:", err);
    res.status(500).json({ error: "Error updating donation" });
  }
});


module.exports = router;
