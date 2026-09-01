import pool from "../config/db.js";
import ApiError from "../utils/ApiError.js";
import bcrypt from "bcrypt";

// Create User
export const createUser = async (name, email, age) => {
  const existingUserResult = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email],
  );

  if (existingUserResult.rows.length > 0) {
    throw new ApiError(409, "Email already exists");
  }

  const result = await pool.query(
    `INSERT INTO users (name, email, age)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, email, age],
  );

  return result.rows[0];
};

// ----------------------- Pagination + Search + Filter + Sorting -----------------------------------
export const getAllUsers = async (page, limit, search, age, sortBy, order) => {
  const offset = (page - 1) * limit;

  let whereClause = "WHERE 1=1";
  const values = [];

  // Search by name or email
  if (search) {
    whereClause += " AND (name ILIKE $1 OR email ILIKE $2)";
    values.push(`%${search}%`, `%${search}%`);
  }

  // Filter by age
  if (age) {
    const ageParam = values.length + 1;

    whereClause += ` AND age = $${ageParam}`;
    values.push(age);
  }

  // Allowed sorting fields
  const allowedSortFields = ["id", "name", "email", "age"];
  const allowedOrders = ["ASC", "DESC"];

  const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : "id";

  const finalOrder = allowedOrders.includes(order?.toUpperCase())
    ? order.toUpperCase()
    : "ASC";

  // Count users
  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     ${whereClause}`,
    values,
  );

  const totalUsers = Number(countResult.rows[0].total);

  // Pagination parameters
  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;

  const result = await pool.query(
    `
    SELECT *
    FROM users
    ${whereClause}
    ORDER BY ${finalSortBy} ${finalOrder}
    LIMIT $${limitParam}
    OFFSET $${offsetParam}
    `,
    [...values, limit, offset],
  );

  return {
    users: result.rows,
    pagination: {
      totalUsers,
      currentPage: page,
      limit,
      totalPages: Math.ceil(totalUsers / limit),
    },
  };
};

// Get User By ID
export const getUserByIdService = async (id) => {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);

  if (result.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  return result.rows[0];
};

// Update User
export const updateUserService = async (id, name, email, age) => {
  const result = await pool.query(
    `UPDATE users
     SET name = $1,
         email = $2,
         age = $3
     WHERE id = $4
     RETURNING *`,
    [name, email, age, id],
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, "User not found");
  }

  return result.rows[0];
};

// Delete User
export const deleteUserService = async (id) => {
  const result = await pool.query("DELETE FROM users WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    throw new ApiError(404, "User not found");
  }

  return;
};

// Save OTP
export const saveOTP = async (email, otp) => {
  const result = await pool.query(
    `
    UPDATE users
    SET otp = $1,
        otp_expiry = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
    WHERE email = $2
    `,
    [otp, email],
  );

  return result.rowCount;
};

// Verify OTP
export const verifyOTPService = async (email, otp) => {
  const result = await pool.query(
    `
    SELECT otp, otp_expiry
    FROM users
    WHERE email = $1
    `,
    [email],
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  const user = result.rows[0];

  if (user.otp !== otp) {
    throw new ApiError(400, "Invalid OTP");
  }

  // PostgreSQL returns TIMESTAMP as a JavaScript Date
  if (new Date() > user.otp_expiry) {
    throw new ApiError(400, "OTP has expired");
  }

  return true;
};

// Reset Password
export const resetPasswordService = async (email, newPassword) => {
  // Check if user exists
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);

  if (result.rows.length === 0) {
    throw new ApiError(404, "User not found");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear OTP
  await pool.query(
    `
    UPDATE users
    SET password = $1,
        otp = NULL,
        otp_expiry = NULL
    WHERE email = $2
    `,
    [hashedPassword, email],
  );

  return {
    email,
  };
};
