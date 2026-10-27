import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { issue, validate, revoke, history } from "../controllers/qrController.js";

const router = Router();
router.use(authMiddleware);
const ISSUERS = ["admin", "secretary", "chairman", "bhw"];

router.get("/tokens", requireRole(...ISSUERS), history);
router.post("/issue/:beneficiaryId", requireRole(...ISSUERS), issue);
// Alias used by the QR generation screen.
router.post("/generate/:beneficiaryId", requireRole(...ISSUERS), issue);
router.post("/validate", requireRole(...ISSUERS), validate);
router.post("/revoke/:token", requireRole("admin", "secretary"), revoke);
export default router;
