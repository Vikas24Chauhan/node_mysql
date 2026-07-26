import pool from "../config/db.js";
import ApiError from "../utils/ApiError.js";

// Create User
export const createUser = async (name, email, age) => {
  const [existingUser] = await pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
  );

  if (existingUser.length > 0) {
    throw new ApiError(409, "Email already exists");
  }

  const [result] = await pool.query(
    "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
    [name, email, age],
  );

  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [
    result.insertId,
  ]);

  return rows[0];
};

// Get All Users
export const getAllUsers = async () => {
  const [rows] = await pool.query("SELECT * FROM users");
  return rows;
};

// Get User By ID
export const getUserByIdService = async (id) => {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);

  if (rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  return rows[0];
};

// Update User
export const updateUserService = async (id, name, email, age) => {
  const [result] = await pool.query(
    "UPDATE users SET name = ?, email = ?, age = ? WHERE id = ?",
    [name, email, age, id],
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, "User not found");
  }

  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);

  return rows[0];
};

// Delete User
export const deleteUserService = async (id) => {
  const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);

  if (result.affectedRows === 0) {
    throw new ApiError(404, "User not found");
  }

  return;
};
