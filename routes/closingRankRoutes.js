import express from "express";

import {
  getPgClosingRanks2025,
  getPgClosingRankFilters2025,
} from "../controllers/closingRankController.js";

const router = express.Router();

router.get("/pg/2025", getPgClosingRanks2025);
router.get("/pg/2025/filters", getPgClosingRankFilters2025);

export default router;
