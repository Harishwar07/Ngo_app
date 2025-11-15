// backend/routes/finance.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const uiConfig = require('./uiConfig');
const { verifyToken, rbacAccess, requireOwnerOrAdmin } = require('../middleware/auth');
const { financeValidation } = require('../middleware/validators');
const { emailValidation, amountValidation, runValidation } = require('../middleware/globalValidators');


/* ==========================================================
   🔹 GET ALL FINANCE REPORTS (Members and above can view)
========================================================== */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, finance_report_frf_name, email, finance_report_frf_owner, modified_date
      FROM finance_reports
      ORDER BY finance_report_frf_name ASC
    `);
    res.json({ data: result.rows, uiConfig: uiConfig.finance });
  } catch (err) {
    console.error('Error fetching finance reports:', err);
    res.status(500).send('Error fetching finance reports');
  }
});

/* ==========================================================
   🔹 GET SINGLE FINANCE REPORT (Owner or Admin/Staff)
========================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const financeQ = `
      SELECT 
        f.*,
        cu.username AS created_by_username,
        cu.email AS created_by_email,
        mu.username AS modified_by_username,
        mu.email AS modified_by_email
      FROM finance_reports f
      LEFT JOIN users cu ON f.created_by_user_id = cu.user_id
      LEFT JOIN users mu ON f.modified_by_user_id = mu.user_id
      WHERE f.id = $1
    `;

    const { rows: reportRows } = await db.query(financeQ, [id]);
    if (reportRows.length === 0)
      return res.status(404).json({ message: 'Finance report not found' });

    const report = reportRows[0];

    // transactions
    const txnQ = `
  SELECT 
    transaction_id,
    TO_CHAR(transaction_date, 'DD-MM-YYYY') AS transaction_date,
    name,
    income_amount,
    expense_amount,
    bill_transaction_id,
    gst,
    remarks,
    other_details
  FROM finance_transactions
  WHERE finance_report_id = $1
  ORDER BY transaction_date DESC
`;


    const { rows: transactions } = await db.query(txnQ, [id]);

    report.transactions = transactions;

    res.json(report);

  } catch (err) {
    console.error('Error fetching finance report details:', err);
    res.status(500).send('Error fetching finance report details');
  }
});


/* ==========================================================
   🔹 CREATE FINANCE REPORT (Finance/Staff/Admin/SuperAdmin)
========================================================== */
router.post('/', verifyToken, rbacAccess(), financeValidation, emailValidation('email'), emailValidation('secondary_email'), runValidation, async (req, res) => {
  try {
    const {
      id,
      finance_report_frf_name,
      finance_report_frf_owner,
      project_name,
      email,
      secondary_email,
      email_opt_out,
      modified_by_user_id
    } = req.body;

    const q = `
      INSERT INTO finance_reports (
        id, finance_report_frf_name, finance_report_frf_owner,
        project_name, email, secondary_email, email_opt_out,
        created_by_date, modified_by_user_id, modified_date
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, COALESCE($7, false),
        NOW(), $8, NOW()
      )
      RETURNING *;
    `;

    const vals = [
      id,
      finance_report_frf_name,
      finance_report_frf_owner,
      project_name,
      email,
      secondary_email,
      email_opt_out,
      Number(modified_by_user_id) || 1
    ];

    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating finance report:', err);
    res.status(500).send('Error creating finance report');
  }
});

/* ==========================================================
   🔹 ADD TRANSACTION TO FINANCE REPORT (Ledger Entry)
========================================================== */
router.post('/:id/transactions', verifyToken, rbacAccess(), amountValidation('income_amount', 'expense_amount'), runValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_date, name, income_amount, expense_amount, bill_transaction_id, gst, remarks, other_details } = req.body;

    const q = `
      INSERT INTO finance_transactions (
        finance_report_id, transaction_date, name, income_amount, expense_amount,
        bill_transaction_id, gst, remarks, other_details
      )
      VALUES ($1,$2,$3,COALESCE($4,0),COALESCE($5,0),$6,$7,$8,$9)
      RETURNING *;
    `;

    const vals = [id, transaction_date, name, income_amount, expense_amount, bill_transaction_id, gst, remarks, other_details];
    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating transaction:', err);
    res.status(500).send('Error creating transaction');
  }
});

/* ==========================================================
   🔹 UPDATE FINANCE REPORT (PUT - Full Update)
========================================================== */
router.put('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      finance_report_frf_name,
      finance_report_frf_owner,
      project_name,
      email,
      secondary_email,
      email_opt_out
    } = req.body;

    const q = `
      UPDATE finance_reports
      SET
        finance_report_frf_name = $1,
        finance_report_frf_owner = $2,
        project_name = $3,
        email = $4,
        secondary_email = $5,
        email_opt_out = COALESCE($6, email_opt_out),
        modified_date = NOW()
      WHERE id = $7
      RETURNING *;
    `;

    const vals = [
      finance_report_frf_name,
      finance_report_frf_owner,
      project_name,
      email,
      secondary_email,
      email_opt_out,
      id
    ];

    const { rows } = await db.query(q, vals);
    if (!rows.length) return res.status(404).json({ error: 'Finance report not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating finance report:', err);
    res.status(500).send('Error updating finance report');
  }
});

/* ==========================================================
   🔹 PARTIAL UPDATE FINANCE REPORT (PATCH)
========================================================== */
router.patch('/:id', verifyToken, rbacAccess(), emailValidation('email'), emailValidation('secondary_email'),runValidation, async (req, res) => {
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
      UPDATE finance_reports
      SET ${updates.join(', ')}, modified_date = NOW()
      WHERE id = $${i}
      RETURNING *;
    `;
    values.push(id);

    const { rows } = await db.query(q, values);
    if (!rows.length) return res.status(404).json({ error: 'Finance report not found' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error patching finance report:', err);
    res.status(500).send('Error patching finance report');
  }
});

router.patch('/transactions/:txn_id', verifyToken, rbacAccess(), amountValidation('income_amount', 'expense_amount'), runValidation, async (req, res) => {
  try {
    const { txn_id } = req.params;
    const updates = req.body;

    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ message: "Nothing to update" });

    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = [...Object.values(updates), txn_id];

    const q = `
      UPDATE finance_transactions
      SET ${set}
      WHERE finance_transaction_id = $${keys.length + 1}
      RETURNING *;
    `;

    const { rows } = await db.query(q, values);

    if (!rows.length)
      return res.status(404).json({ message: "Transaction not found" });

    res.json(rows[0]);

  } catch (err) {
    console.error("Error patching finance transaction:", err);
    res.status(500).json({ error: "Error updating finance transaction" });
  }
});



/* ==========================================================
   🔹 DELETE FINANCE REPORT (Finance/Admin/Staff/SuperAdmin)
========================================================== */
router.delete('/:id', verifyToken, rbacAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM finance_reports WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Finance report not found' });
    res.json({ message: 'Finance report deleted successfully' });
  } catch (err) {
    console.error('Error deleting finance report:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete finance report — dependent transactions exist' });
    }
    res.status(500).send('Error deleting finance report');
  }
});

module.exports = router;
