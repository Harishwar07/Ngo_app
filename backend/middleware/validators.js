const { body, validationResult } = require("express-validator");
const db = require("../db");

/* ---------------------------------------------------------
   CENTRAL VALIDATION HANDLER
--------------------------------------------------------- */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({
      status: "fail",
      errors: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
    });
  next();
};

/* ---------------------------------------------------------
   USERS VALIDATION
--------------------------------------------------------- */
const registerValidation = [
  body("username")
    .trim()
    .matches(/^[A-Za-z0-9_]{3,30}$/)
    .withMessage("Username must be 3–30 chars letters, numbers, underscore")
    .custom(async (value) => {
      const { rows } = await db.query(
        "SELECT 1 FROM users WHERE username=$1",
        [value]
      );
      if (rows.length) throw new Error("Username already exists");
      return true;
    }),

  body("email")
    .normalizeEmail()
    .isEmail()
    .withMessage("Valid email is required")
    .custom(async (value) => {
      const { rows } = await db.query(
        "SELECT 1 FROM users WHERE email=$1",
        [value]
      );
      if (rows.length) throw new Error("Email already exists");
      return true;
    }),

  body("password")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage(
      "Password must be 8+ chars and include uppercase, lowercase, number, symbol"
    ),

  handleValidation,
];

const loginValidation = [
  body("email").normalizeEmail().isEmail().withMessage("Valid email required"),
  body("password").notEmpty(),
  handleValidation,
];

/* ---------------------------------------------------------
   STUDENTS VALIDATION
--------------------------------------------------------- */
const studentValidation = [
  body("id")
    .notEmpty()
    .withMessage("Student ID is required")
    .custom(async (value) => {
      const { rows } = await db.query(
        "SELECT 1 FROM students WHERE id=$1",
        [value]
      );
      if (rows.length) throw new Error("Student ID already exists");
      return true;
    }),

  body("student_frf_name").trim().notEmpty().withMessage("Student name required"),

  body("email").optional().isEmail().withMessage("Invalid email"),

  handleValidation,
];

/* ---------------------------------------------------------
   VOLUNTEERS VALIDATION
--------------------------------------------------------- */
const volunteerValidation = [
  body("id")
    .notEmpty()
    .withMessage("Volunteer ID is required")
    .custom(async (value) => {
      const { rows } = await db.query(
        "SELECT 1 FROM volunteers WHERE id=$1",
        [value]
      );
      if (rows.length) throw new Error("Volunteer ID exists already");
      return true;
    }),

  body("volunteer_frf_name")
    .trim()
    .notEmpty()
    .withMessage("Volunteer name required"),

  body("email").optional().isEmail().withMessage("Invalid email"),

  handleValidation,
];

/* ---------------------------------------------------------
   DONORS VALIDATION
--------------------------------------------------------- */
const donorValidation = [
  body("id").notEmpty().withMessage("Donor ID is required"),

  body("donor_frf_name")
    .trim()
    .notEmpty()
    .withMessage("Donor name required"),

  body("email").optional().isEmail().withMessage("Invalid email"),

  handleValidation,
];

/* ---------------------------------------------------------
   BOARD VALIDATION (NO ID CHECK)
--------------------------------------------------------- */
const boardValidation = [
  body("board_frf_name")
    .trim()
    .notEmpty()
    .withMessage("Board member name required"),

  body("email").optional().isEmail().withMessage("Invalid email"),

  handleValidation,
];

/* ---------------------------------------------------------
   PROJECT VALIDATION
--------------------------------------------------------- */
const projectValidation = [
  body("id")
    .notEmpty()
    .withMessage("Project ID required")
    .custom(async (value) => {
      const { rows } = await db.query(
        "SELECT 1 FROM projects WHERE id=$1",
        [value]
      );
      if (rows.length) throw new Error("Project ID already exists");
      return true;
    }),

  body("project_frf_name")
    .notEmpty()
    .withMessage("Project name required"),

  handleValidation,
];

/* ---------------------------------------------------------
   FINANCE VALIDATION
--------------------------------------------------------- */
const financeValidation = [
  body("id")
    .notEmpty()
    .withMessage("Finance report ID required")
    .custom(async (value) => {
      const { rows } = await db.query(
        "SELECT 1 FROM finance_reports WHERE id=$1",
        [value]
      );
      if (rows.length) throw new Error("Finance ID already exists");
      return true;
    }),

  body("finance_report_frf_name")
    .notEmpty()
    .withMessage("Report name is required"),

  handleValidation,
];

module.exports = {
  registerValidation,
  loginValidation,
  studentValidation,
  volunteerValidation,
  donorValidation,
  boardValidation,
  projectValidation,
  financeValidation,
};
