import pool from "../config/db.js";
import bcrypt from "bcrypt";

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
