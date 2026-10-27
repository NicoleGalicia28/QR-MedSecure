import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { bhwDashboard } from "../controllers/adminController.js";
import { list as clinicalRecords } from "../controllers/clinicalController.js";
import { restockLogs } from "../controllers/inventoryController.js";

const router = Router();
router.use(authMiddleware, requireRole("bhw", "admin", "secretary"));

router.get("/dashboard", bhwDashboard);
// A clinical record is saved the moment the form is filled in, so the BHW
// dashboard shows the most recently recorded entries instead of a review queue.
router.get("/recent-records", (req, res, next) => {
  clinicalRecords(req, res, next);
});
router.get("/restock-logs", restockLogs);
export default router;
