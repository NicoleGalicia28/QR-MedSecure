import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { Request } from "../models/index.js";
import { stats, users, audit, addAudit, adminDashboard, beneficiaryIds } from "../controllers/adminController.js";
import { listRequests, reviewRequest, setAccountStatus, inviteUser, setRole } from "../controllers/authController.js";
import { list as listNotifications, markRead, markAllRead, create as createNotification } from "../controllers/notificationController.js";

const router = Router();
router.use(authMiddleware, requireRole("admin", "secretary"));

router.get("/stats", stats);
router.get("/dashboard", adminDashboard);

// Staff directory + account lifecycle.
router.get("/users", users);
router.get("/users/requests", listRequests);
router.get("/users/requests/:id", async (req, res) => {
  const row = await Request.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Request not found" });
  res.json({
    request: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      reason: row.reason,
      reviewedBy: row.reviewedBy,
      submittedAt: row.createdAt,
    },
  });
});
router.post("/users/requests/:id/review", reviewRequest);
router.post("/users/:id/status", setAccountStatus);
// Convenience aliases used by the user-management screens.
router.post("/users/invite", inviteUser);
router.put("/users/:id/role", setRole);
router.post("/users/:id/suspend", (req, res, next) => {
  req.body = { ...req.body, status: "suspended" };
  setAccountStatus(req, res, next);
});

// ID lifecycle directory.
router.get("/beneficiary-ids", beneficiaryIds);

// Privileged-action trail.
router.get("/audit", audit);
router.post("/audit", addAudit);

// Notifications (admin feed is the full, unscoped list).
router.get("/notifications", listNotifications);
router.post("/notifications", createNotification);
router.post("/notifications/:id/read", markRead);
router.post("/notifications/read-all", markAllRead);

export default router;
