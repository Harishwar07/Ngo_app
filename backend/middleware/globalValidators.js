const { body, validationResult } = require("express-validator");

/* -----------------------------------------------------
   EMAIL VALIDATION
----------------------------------------------------- */
const emailValidation = (field = "email") =>
  body(field)
    .optional({ checkFalsy: true })
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("Invalid email format");

/* -----------------------------------------------------
   USERNAME VALIDATION
----------------------------------------------------- */
const usernameValidation = body("username")
  .trim()
  .matches(/^[A-Za-z0-9_]{3,30}$/)
  .withMessage("Username must be 3–30 chars (letters, numbers, underscore)");

/* -----------------------------------------------------
   PASSWORD VALIDATION
----------------------------------------------------- */
const passwordValidation = body("password")
  .optional()
  .isStrongPassword({
    minLength: 8,
    minUppercase: 1,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  .withMessage(
    "Password must be 8+ chars and include uppercase, lowercase, number, symbol"
  );

/* -----------------------------------------------------
   NAME VALIDATION
----------------------------------------------------- */
const nameValidation = (field) =>
  body(field)
    .trim()
    .matches(/^[A-Za-z\s.'-]{2,60}$/)
    .withMessage("Invalid name");

/* -----------------------------------------------------
   PHONE NUMBER VALIDATION
----------------------------------------------------- */
const phoneValidation = (field = "contact_number") =>
  body(field)
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage("Phone number must be 10 digits");

/* -----------------------------------------------------
   AMOUNT VALIDATION
----------------------------------------------------- */
const amountValidation = (field = "amount") =>
  body(field)
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount must be a positive number");

/* -----------------------------------------------------
   GLOBAL VALIDATION HANDLER
----------------------------------------------------- */
const runValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "fail",
      errors: errors.array().map((e) => ({
        field: e.param,
        message: e.msg,
      })),
    });
  }

  next();
};

module.exports = {
  emailValidation,
  usernameValidation,
  passwordValidation,
  nameValidation,
  phoneValidation,
  amountValidation,
  runValidation,
};
