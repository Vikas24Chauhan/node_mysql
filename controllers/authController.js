import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { randomInt } from "node:crypto";
import generateToken from "../utils/generateToken.js";
import { sendEmail } from "../services/emailService.js";
import { otpTemplate } from "../templates/otpTemplate.js";

// Normalize email consistently across all authentication endpoints.
const normalizeEmail = (email) => email.trim().toLowerCase();

// --------------- Register ------------------------------

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // bcrypt supports passwords up to 72 bytes.
    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must not exceed 72 bytes.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [cleanName, cleanEmail, cleanPhone, hashedPassword],
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: result.rows[0].id,
    });
  } catch (error) {
    console.error("Registration failed:", {
      code: error.code,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      message: error.message,
    });

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with these details already exists.",
      });
    }

    if (error.code === "23502" || error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Registration details could not be saved.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

// --------------------------------------------------
// Login
// --------------------------------------------------

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const cleanEmail = normalizeEmail(email);

    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [cleanEmail],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = generateToken(user);

    // Never return the password hash to the client.
    delete user.password;
    delete user.otp;
    delete user.otp_expiry;
    delete user.reset_token_hash;
    delete user.reset_token_expiry;

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    return next(error);
  }
};

// --------------------------------------------------
// Forgot Password
// --------------------------------------------------

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body ?? {};

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const cleanEmail = normalizeEmail(email);

    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [cleanEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const otp = randomInt(100000, 1000000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users
       SET otp = $1,
           otp_expiry = $2
       WHERE id = $3`,
      [otp, expiry, userResult.rows[0].id],
    );

    await sendEmail(cleanEmail, "Password Reset OTP", otpTemplate(otp));

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

// --------------------------------------------------
// Verify OTP
// --------------------------------------------------

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      (typeof otp !== "string" && typeof otp !== "number") ||
      !/^\d{6}$/.test(String(otp))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email and six-digit OTP are required.",
      });
    }

    const cleanEmail = normalizeEmail(email);

    const result = await pool.query(
      `SELECT otp, otp_expiry
       FROM users
       WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [cleanEmail],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = result.rows[0];

    if (!user.otp || String(user.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    if (!user.otp_expiry || new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
    });
  } catch (error) {
    return next(error);
  }
};

// --------------------------------------------------
// Reset Password
// --------------------------------------------------

export const resetPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must not exceed 72 bytes.",
      });
    }

    const cleanEmail = normalizeEmail(email);

    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [cleanEmail],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password = $1,
           otp = NULL,
           otp_expiry = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, userResult.rows[0].id],
    );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    return next(error);
  }
};
