import pool from "../config/db.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
import { sendEmail } from "../services/emailService.js";
import { otpTemplate } from "../templates/otpTemplate.js";

// --------------- Register ------------------------------

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check required fields
    if (!name || !email || !phone || !password) {
      const error = new Error("Name, email, phone and password are required");
      error.statusCode = 400;
      return next(error);
    }

    // Check if email already exists
    const existingUserResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (existingUserResult.rows.length > 0) {
      const error = new Error("Email already exists");
      error.statusCode = 409;
      return next(error);
    }

    // Check if phone already exists
    const existingPhoneResult = await pool.query(
      "SELECT id FROM users WHERE phone = $1",
      [phone],
    );

    if (existingPhoneResult.rows.length > 0) {
      const error = new Error("Phone number already exists");
      error.statusCode = 409;
      return next(error);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, email, phone, hashedPassword],
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: result.rows[0].id,
    });
  } catch (error) {
    next(error);
  }
};

// --------------- Login ------------------------------

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error("Email and password are required");
      error.statusCode = 400;
      return next(error);
    }

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    const user = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    // Generate Token
    const token = generateToken(user);

    // Remove password before sending user data
    delete user.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// --------------- Forgot Password ------------------------------

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      const error = new Error("Email is required");
      error.statusCode = 400;
      return next(error);
    }

    // Check user exists
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (userResult.rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // OTP expires after 10 minutes
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP
    await pool.query(
      `UPDATE users
       SET otp = $1,
           otp_expiry = $2
       WHERE email = $3`,
      [otp, expiry, email],
    );

    // Send Email
    await sendEmail(email, "Password Reset OTP", otpTemplate(otp));

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// --------------- Verify OTP ------------------------------

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      const error = new Error("Email and OTP are required");
      error.statusCode = 400;
      return next(error);
    }

    // Find user
    const result = await pool.query(
      `SELECT otp, otp_expiry
       FROM users
       WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    const user = result.rows[0];

    // Check OTP
    if (user.otp !== otp) {
      const error = new Error("Invalid OTP");
      error.statusCode = 400;
      return next(error);
    }

    // Check expiry
    if (!user.otp_expiry || new Date() > new Date(user.otp_expiry)) {
      const error = new Error("OTP has expired");
      error.statusCode = 400;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

// --------------- Reset Password ------------------------------

export const resetPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error = new Error("Email and password are required");
      error.statusCode = 400;
      return next(error);
    }

    // Check user exists
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (userResult.rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear OTP
    await pool.query(
      `UPDATE users
       SET password = $1,
           otp = NULL,
           otp_expiry = NULL
       WHERE email = $2`,
      [hashedPassword, email],
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};
