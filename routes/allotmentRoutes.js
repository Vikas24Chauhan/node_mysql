import express from "express";

import {
  getPgAllotments2025,
  getPgAllotmentFilters2025,
  getUgAllotments2025,
  getUgAllotmentFilters2025,
} from "../controllers/allotmentController.js";

const router = express.Router();

router.get("/pg/2025", getPgAllotments2025);
router.get("/pg/2025/filters", getPgAllotmentFilters2025);
router.get("/ug/2025", getUgAllotments2025);
router.get("/ug/2025/filters", getUgAllotmentFilters2025);

export default router;
