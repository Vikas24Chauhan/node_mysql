import pool from "../config/db.js";
import crypto from "crypto";
import bcrypt from "bcrypt";

// Normalize phone numbers to digits only
const normalizePhone = (phone) => phone.replace(/\D/g, "");

// Step 1: Match email and phone
export const verifyRecoveryDetails = async (email, phone) => {
  const normalizedPhone = normalizePhone(phone);

  const result = await pool.query(
    `SELECT id
     FROM users
     WHERE LOWER(email) = LOWER($1)
       AND regexp_replace(phone, '[^0-9]', '', 'g') = $2
     LIMIT 1`,
    [email.trim(), normalizedPhone],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const userId = result.rows[0].id;

  // Generate a cryptographically random token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Token expires in 10 minutes
  await pool.query(
    `UPDATE users
     SET reset_token_hash = $1,
         reset_token_expiry = NOW() + INTERVAL '10 minutes'
     WHERE id = $2`,
    [tokenHash, userId],
  );

  // Return the raw token to the frontend, not the hash
  return resetToken;
};

// Step 2: Set a new password using the temporary token
export const resetPasswordWithToken = async (resetToken, newPassword) => {
  const tokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const result = await pool.query(
    `SELECT id
     FROM users
     WHERE reset_token_hash = $1
       AND reset_token_expiry > NOW()
     LIMIT 1`,
    [tokenHash],
  );

  if (result.rows.length === 0) {
    return false;
  }

  const userId = result.rows[0].id;
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Consume the token when changing the password
  const updated = await pool.query(
    `UPDATE users
     SET password = $1,
         reset_token_hash = NULL,
         reset_token_expiry = NULL,
         updated_at = NOW()
     WHERE id = $2
       AND reset_token_hash = $3
       AND reset_token_expiry > NOW()
     RETURNING id`,
    [hashedPassword, userId, tokenHash],
  );

  return updated.rowCount > 0;
};
