import pool from "../config/db.js";
import bcrypt from "bcrypt";
import generateToken from "../utils/generateToken.js";
import { sendEmail } from "../services/emailService.js";
import { otpTemplate } from "../templates/otpTemplate.js";

export const register = async (req, res, next) => {
  try {
    const { name, email, age, password } = req.body;

    // Check if email already exists
    const [existingUser] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );

    if (existingUser.length > 0) {
      const error = new Error("Email already exists");
      error.statusCode = 409;
      return next(error);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const [result] = await pool.query(
      `INSERT INTO users (name, email, age, password)
       VALUES (?, ?, ?, ?)`,
      [name, email, age, hashedPassword],
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      userId: result.insertId,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      return next(error);
    }

    const user = rows[0];

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

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check user exists
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
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
       SET otp = ?, otp_expiry = ?
       WHERE email = ?`,
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

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Find user
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    const user = rows[0];

    // Check OTP
    if (user.otp !== otp) {
      const error = new Error("Invalid OTP");
      error.statusCode = 400;
      return next(error);
    }

    // Check Expiry
    if (new Date() > new Date(user.otp_expiry)) {
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

export const resetPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      return next(error);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password = ?,
           otp = NULL,
           otp_expiry = NULL
       WHERE email = ?`,
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
