import express from "express";
import { predictNeetPg2025 } from "../controllers/neetPgPredictorController.js";

const router = express.Router();

router.get("/neet-pg", predictNeetPg2025);

export default router;
