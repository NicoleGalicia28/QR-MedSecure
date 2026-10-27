import { User, Beneficiary, Notification, Request, Medicine, Transaction, ClinicalRecord, SyncBatch, Machine, QrToken, AuditLog } from "../models/index.js";
import { Op } from "sequelize";
import { fullName } from "../utils/codes.js";

// GET /admin/stats — live counts for the admin dashboard.
export async function stats(req, res) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);
  res.json({
    stats: {
      users: await User.count(),
      activeUsers: await User.count({ where: { status: "active" } }),
      beneficiaries: await Beneficiary.count(),
      activeBeneficiaries: await Beneficiary.count({ where: { status: "active" } }),
      pending: await Request.count({ where: { status: "pending" } }),
      notifications: await Notification.count({ where: { read: false } }),
      medicines: await Medicine.count(),
      lowStock: await Medicine.count({ where: { stock: { [Op.lt]: Medicine.sequelize.col("minimum") } } }).catch(() => 0),
      transactions: await Transaction.count(),
      transactionsThisMonth: await Transaction.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      records: await ClinicalRecord.count(),
      syncBatches: await SyncBatch.count(),
      machines: await Machine.count(),
      machinesOnline: await Machine.count({ where: { status: "online" } }),
      qrTokensActive: await QrToken.count({ where: { status: "active" } }),
    },
  });
}

// GET /admin/users — the staff directory for user & role management.
export async function users(req, res) {
  const rows = await User.findAll({ order: [["lastName", "ASC"]] });
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      name: fullName(u),
      email: u.email,
      role: u.role,
      isAdmin: !!u.isAdmin,
      status: u.status,
      lastSignIn: u.lastSignIn,
      createdAt: u.createdAt,
    })),
  });
}

// GET /admin/beneficiary-ids — the ID lifecycle directory. An ID counts as
// "issued" once a QR token has been generated for the beneficiary, "pending"
// before that, and "inactive" for archived records.
export async function beneficiaryIds(req, res) {
  const rows = await Beneficiary.findAll({
    include: [{ model: QrToken, as: "qrTokens" }],
    order: [["updatedAt", "DESC"], ["createdAt", "DESC"]],
    limit: 500,
  });
  res.json({
    ids: rows.map((b) => {
      const year = b.birthDate ? parseInt(String(b.birthDate).slice(0, 4), 10) : null;
      const age = year ? new Date().getFullYear() - year : null;
      return {
        publicId: b.publicId,
        name: `${b.firstName} ${b.lastName}`,
        area: b.area || "—",
        program: b.program || (age !== null && age >= 60 ? "Senior Citizen" : "General"),
        status:
          b.status === "archived"
            ? "inactive"
            : b.qrTokens && b.qrTokens.length
              ? "issued"
              : "pending",
      };
    }),
  });
}

// GET /admin/audit — privileged-action trail.
export async function audit(req, res) {
  const rows = await AuditLog.findAll({ order: [["createdAt", "DESC"]], limit: 200 });
  res.json({
    entries: rows.map((a) => ({
      id: a.id,
      actor: a.actorName,
      actorRole: a.actorRole || "",
      action: a.action,
      target: a.target || "",
      reason: a.reason || "",
      at: a.createdAt,
    })),
  });
}

// POST /admin/audit — record a privileged action (wired from approve,
// suspend, reject and other review flows).
export async function addAudit(req, res) {
  const { action, target, reason } = req.body || {};
  if (!action) return res.status(400).json({ error: "action is required." });
  const row = await AuditLog.create({
    actorName: req.user?.email || "system",
    actorRole: req.user?.role || "",
    action,
    target: target || "",
    reason: reason || "",
  });
  res.status(201).json({ entry: { id: row.id, action: row.action, at: row.createdAt } });
}

// GET /dashboard — admin landing KPIs.
export async function adminDashboard(req, res) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);
  const [beneficiaries, newThisMonth, records, txToday, lowStock, openAlerts, machinesOnline, machinesTotal] =
    await Promise.all([
      Beneficiary.count({ where: { status: "active" } }),
      Beneficiary.count({ where: { createdAt: { [Op.gte]: new Date(Date.now() - 30 * 864e5) } } }),
      ClinicalRecord.count(),
      Transaction.count({ where: { createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
      Medicine.count({ where: { stock: { [Op.lt]: Medicine.sequelize.col("minimum") } } }).catch(() => 0),
      Notification.count({ where: { read: false } }),
      Machine.count({ where: { status: "online" } }),
      Machine.count(),
    ]);
  res.json({
    kpis: [
      { label: "Active beneficiaries", value: String(beneficiaries), hint: `${newThisMonth} registered in the last 30 days` },
      { label: "Clinical records", value: String(records), hint: "Records entered by health workers" },
      { label: "Transactions today", value: String(txToday), hint: "Dispensing activity since midnight" },
      { label: "Open alerts", value: String(openAlerts), hint: `${lowStock} medicine(s) below minimum stock` },
    ],
    machine: {
      id: "TY-DM-01",
      status: machinesOnline > 0 ? "Online" : "Offline",
      slots: `${machinesOnline}/${machinesTotal} online`,
    },
  });
}

// GET /bhw/dashboard
export async function bhwDashboard(req, res) {
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
  const [patientsToday, recordsToday, recordsTotal, lowStock, scansToday, txToday] = await Promise.all([
    Transaction.count({ where: { createdAt: { [Op.gte]: startOfDay } } }),
    ClinicalRecord.count({ where: { createdAt: { [Op.gte]: startOfDay } } }),
    ClinicalRecord.count(),
    Medicine.count({ where: { stock: { [Op.lt]: Medicine.sequelize.col("minimum") } } }).catch(() => 0),
    QrToken.count({ where: { status: "used", usedAt: { [Op.gte]: startOfDay } } }),
    Transaction.count({ where: { createdAt: { [Op.gte]: startOfDay } } }),
  ]);
  res.json({
    kpis: [
      { label: "Patients served today", value: String(patientsToday), hint: `${recordsToday} clinical record(s) entered` },
      { label: "Clinical records", value: String(recordsTotal), hint: "Total records on file" },
      { label: "Low stock items", value: String(lowStock), hint: "Below minimum level" },
      { label: "Scans today", value: String(scansToday), hint: `${txToday} dispensing transaction(s)` },
    ],
    machine: { id: "TY-DM-01", status: "Online", slots: "—" },
  });
}

// GET /chairman/overview + dashboard — governance-level numbers.
export async function chairmanDashboard(req, res) {
  const [population, beneficiaries, openAlerts, batches, success] = await Promise.all([
    Beneficiary.count(),
    Beneficiary.count({ where: { status: "active" } }),
    Notification.count({ where: { read: false } }),
    SyncBatch.count(),
    SyncBatch.count({ where: { status: "success" } }),
  ]);
  const rate = batches > 0 ? Math.round((success / batches) * 100) : 100;
  res.json({
    overview: {
      population: String(population),
      beneficiaries,
      openAlerts,
      syncSuccessRate: `${rate}%`,
    },
    kpis: [
      { label: "Beneficiaries served", value: String(population), hint: `${beneficiaries} active records` },
      { label: "Open alerts", value: String(openAlerts), hint: "Stock, device and system notifications" },
      { label: "Sync success rate", value: `${rate}%`, hint: `Across ${batches} batch(es)` },
      { label: "Medicines on formulary", value: String(await Medicine.count()), hint: "Tracked in the dispensing unit" },
    ],
    machine: { id: "TY-DM-01", status: "Online", slots: "—" },
  });
}
