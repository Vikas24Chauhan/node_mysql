import express from "express";
import userRoutes from "./routes/userRoutes.js";
import errorHandler from "./middlewares/errorMiddleware.js";

const app = express();

app.use(express.json());

// Routes
app.use("/users", userRoutes);

// Error Middleware
app.use(errorHandler);

export default app;
