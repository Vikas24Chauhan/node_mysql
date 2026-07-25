import express from "express";
import {
  addUser,
  getUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../controllers/userController.js";
import validateUser from "../middlewares/validateUser.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import authorizeRoles from "../middlewares/authorizeRoles.js";

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

export default router;
