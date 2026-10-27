import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { list, markRead, markAllRead } from "../controllers/notificationController.js";

const router = Router();
router.use(authMiddleware);
router.get("/", list);
router.post("/read-all", markAllRead);
router.post("/:id/read", markRead);
export default router;
