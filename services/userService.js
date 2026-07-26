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
// export const getAllUsers = async () => {
//   const [rows] = await pool.query("SELECT * FROM users");
//   return rows;
// };

// ------------------ Pagination ------------------------------------------------
// export const getAllUsers = async (page, limit) => {
//   const offset = (page - 1) * limit;

//   const [[count]] = await pool.query("SELECT COUNT(*) AS total FROM users");

//   const [rows] = await pool.query(
//     `SELECT * FROM users
//      LIMIT ?
//      OFFSET ?`,
//     [limit, offset],
//   );

//   return {
//     users: rows,
//     pagination: {
//       totalUsers: count.total,
//       currentPage: page,
//       limit,
//       totalPages: Math.ceil(count.total / limit),
//     },
//   };
// };

// ----------------------- Pagination + Search + Filter -----------------------------------
// export const getAllUsers = async (page, limit, search, age) => {
//   const offset = (page - 1) * limit;

//   let whereClause = "WHERE 1=1";

//   const values = [];

//   // Search by name or email
//   if (search) {
//     whereClause += " AND (name LIKE ? OR email LIKE ?)";
//     values.push(`%${search}%`, `%${search}%`);
//   }

//   // Filter by age
//   if (age) {
//     whereClause += " AND age = ?";
//     values.push(age);
//   }

//   // Count query
//   const [countRows] = await pool.query(
//     `SELECT COUNT(*) AS total
//      FROM users
//      ${whereClause}`,
//     values,
//   );

//   // Fetch data
//   const [rows] = await pool.query(
//     `
//       SELECT *
//       FROM users
//       ${whereClause}
//       LIMIT ?
//       OFFSET ?
//     `,
//     [...values, limit, offset],
//   );

//   return {
//     users: rows,
//     pagination: {
//       totalUsers: countRows[0].total,
//       currentPage: page,
//       limit,
//       totalPages: Math.ceil(countRows[0].total / limit),
//     },
//   };
// };

// ----------------------- Pagination + Search + Filter + Sorting -----------------------------------
export const getAllUsers = async (page, limit, search, age, sortBy, order) => {
  const offset = (page - 1) * limit;

  let whereClause = "WHERE 1=1";
  const values = [];

  if (search) {
    whereClause += " AND (name LIKE ? OR email LIKE ?)";
    values.push(`%${search}%`, `%${search}%`);
  }

  if (age) {
    whereClause += " AND age = ?";
    values.push(age);
  }

  const allowedSortFields = ["id", "name", "email", "age"];
  const allowedOrders = ["ASC", "DESC"];

  const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : "id";

  const finalOrder = allowedOrders.includes(order) ? order : "ASC";

  const [[count]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     ${whereClause}`,
    values,
  );

  const [rows] = await pool.query(
    `
    SELECT *
    FROM users
    ${whereClause}
    ORDER BY ${finalSortBy} ${finalOrder}
    LIMIT ?
    OFFSET ?
    `,
    [...values, limit, offset],
  );

  return {
    users: rows,
    pagination: {
      totalUsers: count.total,
      currentPage: page,
      limit,
      totalPages: Math.ceil(count.total / limit),
    },
  };
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

export const saveOTP = async (email, otp) => {
  const expiry = Date.now() + 5 * 60 * 1000;

  const [result] = await pool.query(
    `
      UPDATE users
      SET otp = ?,
          otp_expiry = ?
      WHERE email = ?
    `,
    [otp, expiry, email],
  );

  return result.affectedRows;
};

export const verifyOTPService = async (email, otp) => {
  const [rows] = await pool.query(
    `
      SELECT otp, otp_expiry
      FROM users
      WHERE email = ?
    `,
    [email],
  );

  if (rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  const user = rows[0];

  if (user.otp !== otp) {
    throw new ApiError(400, "Invalid OTP");
  }

  if (Date.now() > user.otp_expiry) {
    throw new ApiError(400, "OTP has expired");
  }

  return true;
};
