import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

import {
  verifyRecoveryDetails,
  resetPasswordWithToken,
} from "../services/passwordResetService.js";

// Verify recovery details
export const verifyRecovery = async (req, res, next) => {
  try {
    const { email, phone } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof phone !== "string" ||
      !email.trim() ||
      !phone.trim()
    ) {
      throw new ApiError(400, "Email and phone number are required");
    }

    const resetToken = await verifyRecoveryDetails(
      email.trim().toLowerCase(),
      phone.trim(),
    );

    if (!resetToken) {
      throw new ApiError(400, "Unable to verify recovery details");
    }

    return res.status(200).json(
      new ApiResponse(200, "Details verified successfully", {
        resetToken,
      }),
    );
  } catch (error) {
    next(error);
  }
};

// Reset password using a valid recovery token
export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body ?? {};

    if (
      typeof resetToken !== "string" ||
      !resetToken.trim() ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !newPassword ||
      !confirmPassword
    ) {
      throw new ApiError(400, "All fields are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must contain at least 8 characters");
    }

    if (Buffer.byteLength(newPassword, "utf8") > 72) {
      throw new ApiError(400, "Password is too long");
    }

    if (newPassword !== confirmPassword) {
      throw new ApiError(400, "Passwords do not match");
    }

    const updated = await resetPasswordWithToken(resetToken, newPassword);

    if (!updated) {
      throw new ApiError(
        400,
        "Reset session expired or invalid. Please start again.",
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successfully"));
  } catch (error) {
    next(error);
  }
};
