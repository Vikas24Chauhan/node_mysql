import express from "express";
import cors from "cors";

import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import errorHandler from "./middlewares/errorMiddleware.js";

const app = express();

app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  "https://frontend-eight-psi-62.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Medical Counselling API is running",
  });
});

// Routes
app.use("/users", userRoutes);
app.use("/auth", authRoutes);

// Error handler
app.use(errorHandler);

export default app;
