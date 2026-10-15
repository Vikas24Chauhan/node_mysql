import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";

import {
  verifyRecoveryDetails,
  resetPasswordWithToken,
} from "../services/passwordResetService.js";

// Verify email + phone
export const verifyRecovery = async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      throw new ApiError(400, "Email and phone number are required");
    }

    const resetToken = await verifyRecoveryDetails(email, phone);

    if (!resetToken) {
      throw new ApiError(
        400,
        "The email and phone number could not be verified",
      );
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

// Save new password
export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      throw new ApiError(400, "All fields are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must contain at least 8 characters");
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
