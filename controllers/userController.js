import pool from "../config/db.js";

export const addUser = async (req, res, next) => {
  try {
    const { name, email, age } = req.body;

    const sql = `
      INSERT INTO users (name, email, age)
      VALUES (?, ?, ?)
    `;

    const [result] = await pool.query(sql, [name, email, age]);

    res.status(201).json({
      success: true,
      message: "User Added Successfully",
      id: result.insertId,
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;

      return next(error);
    }

    res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, age } = req.body;

    const sql = "UPDATE users SET name = ?, email = ?, age = ? WHERE id = ?";

    const [result] = await pool.query(sql, [name, email, age, id]);

    if (result.affectedRows === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;

      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "User Updated Successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;

      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "User Deleted Successfully",
    });
  } catch (error) {
    next(error);
  }
};
