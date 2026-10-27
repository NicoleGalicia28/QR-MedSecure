import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { history, batchDetail, status, run, retry, exportCsv } from "../controllers/syncController.js";

const router = Router();
router.use(authMiddleware);
const STAFF = ["admin", "secretary", "chairman", "bhw"];

router.get("/status", requireRole(...STAFF), status);
router.get("/history", requireRole(...STAFF), history);
router.get("/history/export.csv", requireRole(...STAFF), exportCsv);
router.get("/history/:batchId", requireRole(...STAFF), batchDetail);
router.post("/run", requireRole(...STAFF), run);
router.post("/history/:batchId/retry", requireRole("admin", "secretary", "chairman"), retry);
export default router;
