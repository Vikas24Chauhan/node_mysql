import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  try {
    // Read Authorization header
    const authHeader = req.headers.authorization;

    // Check if header exists
    if (!authHeader) {
      const error = new Error("Access denied. No token provided.");
      error.statusCode = 401;
      return next(error);
    }

    // Header format: Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      const error = new Error("Invalid authorization format");
      error.statusCode = 401;
      return next(error);
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Store logged-in user
    req.user = decoded;

    next();
  } catch (error) {
    error.statusCode = 401;
    next(error);
  }
};

export default authMiddleware;
