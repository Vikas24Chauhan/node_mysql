import express from "express";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middlewares/errorMiddleware.js";
import cors from "cors";

const app = express();

app.use(express.json());

// Enable CORS
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// Routes
app.use("/users", userRoutes);
app.use("/auth", authRoutes);

// Error Middleware
app.use(errorHandler);

app.use("/uploads", express.static("uploads"));

export default app;
