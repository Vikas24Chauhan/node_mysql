import express from "express";

import {
  getPgFeeStipendBond2025,
  getPgFeeStipendBondFilters2025,
} from "../controllers/feeStipendBondController.js";

const router = express.Router();

router.get("/pg/2025", getPgFeeStipendBond2025);
router.get("/pg/2025/filters", getPgFeeStipendBondFilters2025);

export default router;
