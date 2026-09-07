import express from "express";

import {
  getPgAllotments2025,
  getPgAllotmentFilters2025,
} from "../controllers/allotmentController.js";

const router = express.Router();

router.get("/pg/2025", getPgAllotments2025);
router.get("/pg/2025/filters", getPgAllotmentFilters2025);

export default router;
