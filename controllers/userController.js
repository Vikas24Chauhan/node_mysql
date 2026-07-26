import ApiResponse from "../utils/ApiResponse.js";
import {
  createUser,
  getAllUsers,
  getUserByIdService,
  updateUserService,
  deleteUserService,
} from "../services/userService.js";

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
export const getUsers = async (req, res, next) => {
  try {
    const users = await getAllUsers();

    res
      .status(200)
      .json(new ApiResponse(200, "Users fetched successfully", users));
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
