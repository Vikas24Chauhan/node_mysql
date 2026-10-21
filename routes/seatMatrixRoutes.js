import express from "express";

import {
  getPgSeatMatrix2025,
  getPgSeatMatrixFilters2025,
} from "../controllers/seatMatrixController.js";

const router = express.Router();

router.get("/pg/2025", getPgSeatMatrix2025);
router.get("/pg/2025/filters", getPgSeatMatrixFilters2025);

export default router;
