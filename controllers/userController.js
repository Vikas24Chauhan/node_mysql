import pool from "../config/db.js";

export const addUser = async (req, res) => {
  try {
    const { name, email, age } = req.body;

    const sql = `
            INSERT INTO users
            (name,email,age)
            VALUES(?,?,?)
        `;

    const [result] = await pool.query(sql, [name, email, age]);

    res.status(201).json({
      message: "User Added",
      id: result.insertId,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users");

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, age } = req.body;

    const sql = "UPDATE users SET name=?, email=?, age=? WHERE id=?";

    const [result] = await pool.query(sql, [name, email, age, id]);
    res.json({
      message: "User Updated Successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM users WHERE id=?", [id]);
    res.json({
      message: "User Deleted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
