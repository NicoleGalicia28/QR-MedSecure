import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { report, exportCsv } from "../controllers/reportController.js";

const router = Router();
router.use(authMiddleware, requireRole("admin", "secretary", "chairman"));
router.get("/", report);
router.get("/export.csv", exportCsv);
export default router;
