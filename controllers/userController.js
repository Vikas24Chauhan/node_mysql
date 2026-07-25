import pool from "../config/db.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";

// Add User
export const addUser = async (req, res, next) => {
  try {
    const { name, email, age } = req.body;

    // Check if email already exists
    const [existingUser] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
    );

    if (existingUser.length > 0) {
      return next(new ApiError(409, "Email already exists"));
    }

    const sql = `
      INSERT INTO users (name, email, age)
      VALUES (?, ?, ?)
    `;

    const [result] = await pool.query(sql, [name, email, age]);

    // Fetch newly created user
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ]);

    res
      .status(201)
      .json(new ApiResponse(201, "User Added Successfully", rows[0]));
  } catch (error) {
    next(error);
  }
};

// Get All Users
export const getUsers = async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");

    res
      .status(200)
      .json(new ApiResponse(200, "Users fetched successfully", rows));
  } catch (error) {
    next(error);
  }
};

// Get User By ID
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      return next(new ApiError(404, "User not found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, "User fetched successfully", rows[0]));
  } catch (error) {
    next(error);
  }
};

// Update User
export const updateUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, age } = req.body;

    const sql = `
      UPDATE users
      SET name = ?, email = ?, age = ?
      WHERE id = ?
    `;

    const [result] = await pool.query(sql, [name, email, age, id]);

    if (result.affectedRows === 0) {
      return next(new ApiError(404, "User not found"));
    }

    // Fetch updated user
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);

    res
      .status(200)
      .json(new ApiResponse(200, "User Updated Successfully", rows[0]));
  } catch (error) {
    next(error);
  }
};

// Delete User
export const deleteUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return next(new ApiError(404, "User not found"));
    }

    res.status(200).json(new ApiResponse(200, "User Deleted Successfully"));
  } catch (error) {
    next(error);
  }
};
