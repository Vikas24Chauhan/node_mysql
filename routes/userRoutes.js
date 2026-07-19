import express from "express";
import {
  addUser,
  getUsers,
  getUserById,
  updateUserById,
  deleteUserById,
} from "../controllers/userController.js";
import validateUser from "../middlewares/validateUser.js";

const router = express.Router();

router.post("/", validateUser, addUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", validateUser, updateUserById);
router.delete("/:id", deleteUserById);

export default router;
