import { Notification, User, Beneficiary, Medicine, Transaction, ClinicalRecord, Request, SyncBatch, QrToken, AuditLog } from "../models/index.js";
import { Op } from "sequelize";
import { fullName } from "../utils/codes.js";

function serialize(n) {
  return {
    id: n.id,
    kind: n.kind,
    severity: n.severity || "info",
    title: n.title,
    body: n.body || "",
    forRole: n.forRole,
    read: n.read,
    link: n.link || "",
    machine: n.machineCode || "",
    at: n.createdAt,
  };
}

// GET /notifications — role-scoped feed for the signed-in user.
export async function list(req, res) {
  const role = String(req.user?.role || "").toLowerCase();
  const adminish = req.user?.isAdmin === true || role.includes("secretary") || role.includes("admin");
  const where = adminish ? {} : { [Op.or]: [{ forRole: null }, { forRole: role }] };
  const rows = await Notification.findAll({ where, order: [["createdAt", "DESC"]], limit: 200 });
  res.json({ notifications: rows.map(serialize) });
}

// POST /notifications/:id/read
export async function markRead(req, res) {
  const row = await Notification.findByPk(req.params.id);
  if (!row) return res.status(404).json({ error: "Notification not found" });
  await row.update({ read: true });
  res.json({ notification: serialize(row) });
}

// POST /notifications/read-all
export async function markAllRead(req, res) {
  await Notification.update({ read: true }, { where: { read: false } });
  res.json({ ok: true });
}

// POST /notifications — create (used by the app itself: low stock, device).
export async function create(req, res) {
  const { kind, severity, title, body, forRole, link, machineCode } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required." });
  const row = await Notification.create({
    kind: kind || "system",
    severity: severity || "info",
    title,
    body: body || "",
    forRole: forRole || null,
    link: link || "",
    machineCode: machineCode || null,
  });
  res.status(201).json({ notification: serialize(row) });
}
