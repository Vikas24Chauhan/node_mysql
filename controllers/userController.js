import connection from "../config/db.js";

export const addUser = (req, res) => {
  const { name, email, age } = req.body;

  const sql = "INSERT INTO users(name,email,age) VALUES(?,?,?)";

  connection.query(sql, [name, email, age], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.status(201).json({
      message: "User Added",
      id: result.insertId,
    });
  });
};

export const getUsers = (req, res) => {
  connection.query("SELECT * FROM users", (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);
  });
};

export const getUserById = (req, res) => {
  const { id } = req.params;

  connection.query("SELECT * FROM users WHERE id = ?", [id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);
  });
};

export const updateUserById = (req, res) => {
  const { id } = req.params;
  const { name, email, age } = req.body;

  const sql = "UPDATE users SET name=?, email=?, age=? WHERE id=?";

  connection.query(sql, [name, email, age, id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      message: "User Updated Successfully",
    });
  });
};

export const deleteUserById = (req, res) => {
  const { id } = req.params;

  connection.query("DELETE FROM users WHERE id=?", [id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      message: "User Deleted Successfully",
    });
  });
};
