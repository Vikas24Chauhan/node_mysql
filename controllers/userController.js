import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  createUser,
  getAllUsers,
  getUserByIdService,
  updateUserService,
  deleteUserService,
  saveOTP,
  verifyOTPService,
  resetPasswordService,
} from "../services/userService.js";
import { sendEmail } from "../services/emailService.js";
import { welcomeTemplate } from "../templates/welcomeEmail.js";
import { otpTemplate } from "../templates/otpTemplate.js";
import { generateOTP } from "../utils/otpGenerator.js";

// Add User
export const addUser = async (req, res, next) => {
  try {
    const { name, email, age } = req.body;

    const user = await createUser(name, email, age);

    res.status(201).json(new ApiResponse(201, "User Added Successfully", user));
  } catch (error) {
    next(error);
  }
};

// Get All Users
// export const getUsers = async (req, res, next) => {
//   try {
//     const users = await getAllUsers();

//     res
//       .status(200)
//       .json(new ApiResponse(200, "Users fetched successfully", users));
//   } catch (error) {
//     next(error);
//   }
// };

// ------------------ Pagination ------------------------------------------------
// export const getUsers = async (req, res, next) => {
//   try {
//     // Read query parameters
//     const page = Math.max(1, Number(req.query.page) || 1);

//     const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

//     // Pass to service
//     const result = await getAllUsers(page, limit);

//     res
//       .status(200)
//       .json(new ApiResponse(200, "Users fetched successfully", result));
//   } catch (error) {
//     next(error);
//   }
// };

// ----------------------- Pagination + Search + Filter -----------------------------------
// export const getUsers = async (req, res, next) => {
//   try {
//     const page = Math.max(1, Number(req.query.page) || 1);

//     const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

//     const search = req.query.search || "";

//     const age = req.query.age || null;

//     const result = await getAllUsers(page, limit, search, age);

//     res
//       .status(200)
//       .json(new ApiResponse(200, "Users fetched successfully", result));
//   } catch (error) {
//     next(error);
//   }
// };

// ----------------------- Pagination + Search + Filter + Sorting -----------------------------------
export const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const search = req.query.search || "";

    const age = req.query.age || null;

    // Sorting
    const sortBy = req.query.sortBy || "id";
    const order = req.query.order?.toUpperCase() || "ASC";

    const result = await getAllUsers(page, limit, search, age, sortBy, order);

    res
      .status(200)
      .json(new ApiResponse(200, "Users fetched successfully", result));
  } catch (error) {
    next(error);
  }
};

// Get User By ID
export const getUserById = async (req, res, next) => {
  try {
    const user = await getUserByIdService(req.params.id);

    res
      .status(200)
      .json(new ApiResponse(200, "User fetched successfully", user));
  } catch (error) {
    next(error);
  }
};

// Update User
export const updateUserById = async (req, res, next) => {
  try {
    const { name, email, age } = req.body;

    const user = await updateUserService(req.params.id, name, email, age);

    res
      .status(200)
      .json(new ApiResponse(200, "User Updated Successfully", user));
  } catch (error) {
    next(error);
  }
};

// Delete User
export const deleteUserById = async (req, res, next) => {
  try {
    await deleteUserService(req.params.id);

    res.status(200).json(new ApiResponse(200, "User Deleted Successfully"));
  } catch (error) {
    next(error);
  }
};

export const uploadProfile = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ApiError(400, "Please upload an image."));
    }

    res.status(200).json(
      new ApiResponse(200, "Image uploaded successfully", {
        filename: req.file.filename,
        path: req.file.path,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const sendWelcomeMail = async (req, res, next) => {
  try {
    const { email } = req.body;

    await sendEmail(email, "Welcome", welcomeTemplate("Vikas"));
    res.status(200).json(new ApiResponse(200, "Email sent successfully"));
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const otp = generateOTP();

    const updated = await saveOTP(email, otp);

    if (!updated) {
      return next(new ApiError(404, "User not found"));
    }

    await sendEmail(email, "Password Reset OTP", otpTemplate(otp));

    res.status(200).json(new ApiResponse(200, "OTP sent successfully"));
  } catch (error) {
    next(error);
  }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    await verifyOTPService(email, otp);

    res.status(200).json(new ApiResponse(200, "OTP verified successfully"));
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;

    const result = await resetPasswordService(email, newPassword);

    res
      .status(200)
      .json(new ApiResponse(200, "Password reset successfully", result));
  } catch (error) {
    next(error);
  }
};
