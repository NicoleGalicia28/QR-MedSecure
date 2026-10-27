import { Router } from "express";
import { body } from "express-validator";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { Notification, QrToken, Beneficiary } from "../models/index.js";
import {
  getProfile,
  updateProfile,
  changePassword,
  getPreferences,
  updatePreferences,
} from "../controllers/profileController.js";
import {
  list as listRecords,
  getById as getRecord,
  create as createRecord,
  update as updateRecord,
} from "../controllers/clinicalController.js";
import {
  list as listTransactions,
  getById as getTransaction,
  create as createTransaction,
  voidTransaction,
} from "../controllers/transactionController.js";
import { receiptPdf } from "../controllers/receiptPdfController.js";
import {
  list as listInventory,
  medicines,
  getById as getMedicine,
  create as createMedicine,
  restock,
  restockByAny,
  update as updateMedicine,
  restockLogs,
} from "../controllers/inventoryController.js";
import {
  list as listMachines,
  getById as getMachine,
  update as updateMachine,
  events as machineEvents,
  addEvent as addMachineEvent,
} from "../controllers/machineController.js";
import {
  list as listPrescriptions,
  activeForBeneficiary,
  create as createPrescription,
  update as updatePrescription,
} from "../controllers/prescriptionController.js";
import { adminDashboard } from "../controllers/adminController.js";

const router = Router();
router.use(authMiddleware);

const STAFF = ["admin", "secretary", "chairman", "bhw"];
const HEALTH = ["admin", "secretary", "bhw"];

// ---- Profile -------------------------------------------------------------
router.get("/users/me", getProfile);
router.put("/users/me", updateProfile);
router.put("/users/me/password", changePassword);
router.get("/users/me/notification-preferences", getPreferences);
router.put("/users/me/notification-preferences", updatePreferences);

// ---- Admin landing KPIs --------------------------------------------------
// The admin dashboard screen calls /dashboard directly.
router.get("/dashboard", requireRole("admin", "secretary"), adminDashboard);

// ---- Clinical records ----------------------------------------------------
router.get("/clinical-records", requireRole(...STAFF), listRecords);
router.get("/clinical-records/:id", requireRole(...STAFF), getRecord);
router.post("/clinical-records", requireRole(...HEALTH), createRecord);
router.put("/clinical-records/:id", requireRole(...HEALTH), updateRecord);

// ---- Dispensing ----------------------------------------------------------
router.get("/transactions", requireRole(...STAFF), listTransactions);
// PDF receipt download (must be registered before /transactions/:id so the
// ".pdf" suffix is not swallowed by the :id param).
router.get("/transactions/:id/receipt.pdf", requireRole(...STAFF), receiptPdf);
router.get("/transactions/:id", requireRole(...STAFF), getTransaction);
router.post("/transactions", requireRole(...HEALTH), createTransaction);
router.post("/transactions/:id/void", requireRole("admin", "secretary"), voidTransaction);

// ---- Inventory -----------------------------------------------------------
router.get("/inventory", requireRole(...HEALTH), listInventory);
router.get("/medicines", requireRole(...STAFF), medicines);
router.get("/inventory/restock-logs", requireRole(...HEALTH), restockLogs);
// The restock form posts here; /inventory/:id/restock is the RESTful form.
router.post("/inventory/restock", requireRole(...HEALTH), restockByAny);
router.get("/inventory/:id", requireRole(...HEALTH), getMedicine);
router.post("/inventory", requireRole("admin", "secretary"), createMedicine);
router.put("/inventory/:id", requireRole("admin", "secretary"), updateMedicine);
router.post("/inventory/:id/restock", requireRole(...HEALTH), restock);

// ---- Machine -------------------------------------------------------------
router.get("/machine", requireRole(...STAFF), listMachines);
router.get("/machine/:id", requireRole(...STAFF), getMachine);
router.put("/machine/:id", requireRole(...HEALTH), updateMachine);
router.get("/machine/:id/events", requireRole(...STAFF), machineEvents);
router.post("/machine/:id/events", requireRole(...HEALTH), addMachineEvent);

// ---- Prescriptions -------------------------------------------------------
router.get("/prescriptions", requireRole(...STAFF), listPrescriptions);
router.get("/prescriptions/active/:beneficiaryId", requireRole(...STAFF), activeForBeneficiary);
router.post("/prescriptions", requireRole(...HEALTH), createPrescription);
router.put("/prescriptions/:id", requireRole(...HEALTH), updatePrescription);

// ---- Alerts & scan activity ---------------------------------------------
// An alert is a notification: the detail pages read the same row.
router.get("/alerts/:id", requireRole(...STAFF), async (req, res) => {
  const row = await Notification.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Alert not found" });
  res.json({
    alert: {
      id: row.id,
      kind: row.kind,
      severity: row.severity || "info",
      title: row.title,
      body: row.body || "",
      machine: row.machineCode || "",
      at: row.createdAt,
      status: row.read ? "Resolved" : "Open",
    },
  });
});

// Acknowledging an alert marks the underlying notification as read.
router.post("/alerts/:id/acknowledge", requireRole(...STAFF), async (req, res) => {
  const row = await Notification.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Alert not found" });
  await row.update({ read: true });
  res.json({ alert: { id: row.id, status: "Resolved" } });
});

// The most recent completed scan on this deployment — the scanner page
// shows it as the current verification state.
router.get("/scan/latest", requireRole(...STAFF), async (req, res) => {
  const row = await QrToken.findOne({
    where: { status: "used" },
    include: [{ model: Beneficiary, as: "beneficiary" }],
    order: [["usedAt", "DESC"]],
  });
  if (!row) return res.json({ scan: null });
  res.json({
    scan: {
      scanId: `SCAN-${row.id}`,
      beneficiaryId: row.beneficiary.publicId,
      beneficiary: `${row.beneficiary.firstName} ${row.beneficiary.lastName}`,
      verifiedAt: row.usedAt,
      method: "QR (AES-256-GCM)",
    },
  });
});

export default router;
