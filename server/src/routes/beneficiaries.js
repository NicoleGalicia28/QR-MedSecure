import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  list,
  getById,
  create,
  update,
  records,
} from "../controllers/beneficiaryController.js";

const router = Router();
router.use(authMiddleware);
const STAFF = ["admin", "secretary", "chairman", "bhw"];

router.get("/", requireRole(...STAFF), list);
router.get("/:id", requireRole(...STAFF), getById);
router.get("/:id/records", requireRole(...STAFF), records);
router.post("/", requireRole("admin", "secretary"), create);
router.put("/:id", requireRole("admin", "secretary"), update);
export default router;
