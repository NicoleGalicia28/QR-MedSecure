import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { chairmanDashboard } from "../controllers/adminController.js";
import { report, listReports, preview, exportCsv } from "../controllers/reportController.js";
import {
  status as syncStatus,
  history as syncHistory,
  batchDetail as syncBatchDetail,
} from "../controllers/syncController.js";
import { issue } from "../controllers/qrController.js";

const router = Router();
router.use(authMiddleware, requireRole("chairman", "admin", "secretary"));

router.get("/overview", chairmanDashboard);
router.get("/dashboard", chairmanDashboard);

// Reports: list of available reports, live preview figures, CSV export.
router.get("/reports", listReports);
router.get("/reports/preview", preview);
router.get("/reports/export.csv", exportCsv);
router.get("/reports/:period", report);

// Sync oversight: reuses the shared sync tables (read-only for the chairman;
// retry lives on the admin/BHW workspaces).
router.get("/sync/status", syncStatus);
router.get("/sync/history", syncHistory);
router.get("/sync/history/:batchId", syncBatchDetail);

// The chairman may issue a beneficiary QR from the directory view.
router.get("/beneficiaries/:beneficiaryId/qr", issue);

export default router;
