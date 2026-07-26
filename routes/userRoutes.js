import express from "express";
import {
  addUser,
  getUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  uploadProfile,
  sendWelcomeMail,
  forgotPassword,
  verifyOTP,
  resetPassword,
} from "../controllers/userController.js";
import validateUser from "../middlewares/validateUser.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  authorizeRoles("admin"),
  validateUser,
  addUser,
);
router.get("/", authMiddleware, getUsers);
router.get("/:id", authMiddleware, getUserById);
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("admin"),
  validateUser,
  updateUserById,
);
router.delete("/:id", authMiddleware, authorizeRoles("admin"), deleteUserById);

router.post("/upload", upload.single("image"), uploadProfile);

router.post("/send-email", sendWelcomeMail);

router.post("/forgot-password", forgotPassword);

router.post("/verify-otp", verifyOTP);

router.post("/reset-password", resetPassword);

export default router;
