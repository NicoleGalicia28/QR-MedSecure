import { Transaction, Medicine, Beneficiary, Prescription, User, Notification } from "../models/index.js";
import { nextCode, fullName } from "../utils/codes.js";

const INCLUDE = [
  { model: Beneficiary, as: "beneficiary" },
  { model: Medicine, as: "medicine" },
  { model: User, as: "dispenser" },
];

function serialize(t) {
  return {
    id: t.id,
    code: t.code,
    beneficiaryId: t.beneficiary?.publicId || t.beneficiaryId,
    beneficiary: t.beneficiary ? `${t.beneficiary.firstName} ${t.beneficiary.lastName}` : "—",
    medicineId: t.medicineId,
    medicine: t.medicine?.name || "—",
    quantity: t.quantity,
    dispensedBy: fullName(t.dispenser),
    machine: t.machineCode || "—",
    at: t.createdAt,
    status: t.status,
    note: t.note || "",
  };
}

// GET /transactions?beneficiaryId=&medicineId=&status=
export async function list(req, res) {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.beneficiaryId) {
    const b = /^\d+$/.test(req.query.beneficiaryId)
      ? await Beneficiary.findByPk(req.query.beneficiaryId)
      : await Beneficiary.findOne({ where: { publicId: req.query.beneficiaryId } });
    if (!b) return res.json({ transactions: [] });
    where.beneficiaryId = b.id;
  }
  if (req.query.medicineId) where.medicineId = req.query.medicineId;
  const rows = await Transaction.findAll({
    where,
    include: INCLUDE,
    order: [["createdAt", "DESC"]],
    limit: 300,
  });
  res.json({ transactions: rows.map(serialize) });
}

// GET /transactions/:id (numeric id or code like TXN-2026-0001)
export async function getById(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? await Transaction.findByPk(id, { include: INCLUDE })
    : await Transaction.findOne({ where: { code: id }, include: INCLUDE });
  if (!row) return res.status(404).json({ error: "Transaction not found" });
  res.json({ transaction: serialize(row) });
}

// POST /transactions — dispense medicine to a beneficiary.
// Validates stock, decrements inventory, follows the prescription when
// given, and raises a low-stock notification when a slot drops below its
// minimum. This is the real dispensing workflow.
export async function create(req, res) {
  const { beneficiaryId, medicineId, quantity, prescriptionId, machineCode, note } =
    req.body || {};
  const qty = Number(quantity);
  if (!beneficiaryId || !medicineId || !qty || qty <= 0)
    return res.status(400).json({ error: "beneficiaryId, medicineId and a positive quantity are required." });

  const beneficiary = /^\d+$/.test(String(beneficiaryId))
    ? await Beneficiary.findByPk(beneficiaryId)
    : await Beneficiary.findOne({ where: { publicId: beneficiaryId } });
  if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });
  const medicine = await Medicine.findByPk(medicineId);
  if (!medicine) return res.status(404).json({ error: "Medicine not found" });
  if (medicine.stock < qty)
    return res.status(409).json({
      error: `Insufficient stock: only ${medicine.stock} ${medicine.unit} of ${medicine.name} remain.`,
    });

  let prescription = null;
  if (prescriptionId) {
    prescription = await Prescription.findByPk(prescriptionId);
    if (!prescription) return res.status(404).json({ error: "Prescription not found" });
    if (prescription.remaining < qty)
      return res.status(409).json({
        error: `Prescription ${prescription.code} only has ${prescription.remaining} units remaining.`,
      });
  }

  // QR code locking per cycle to limit duplicate claims
  const now = new Date();
  const cycleKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const existing = await Transaction.findOne({
    where: { beneficiaryId: beneficiary.id, cycleKey, status: "completed" },
  });
  if (existing) {
    return res.status(409).json({
      error: "This beneficiary already claimed medicine for this cycle. Duplicate claims are not allowed.",
    });
  }

  const row = await Transaction.create({
    code: await nextCode(Transaction, "TXN"),
    beneficiaryId: beneficiary.id,
    medicineId: medicine.id,
    prescriptionId: prescription ? prescription.id : null,
    quantity: qty,
    dispensedById: req.user?.id || null,
    machineCode: machineCode || null,
    cycleKey,
    status: "completed",
    note: note || "",
  });

  await medicine.update({ stock: medicine.stock - qty });
  if (prescription) {
    const remaining = prescription.remaining - qty;
    await prescription.update({
      remaining,
      status: remaining <= 0 ? "completed" : prescription.status,
    });
  }

  // Below minimum → raise an alert for the BHW/admin feed.
  if (medicine.stock < medicine.minimum) {
    await Notification.create({
      kind: "stock",
      severity: "warning",
      title: `${medicine.name} is below minimum stock`,
      body: `${medicine.stock} ${medicine.unit} remaining in ${medicine.slot || "unassigned slot"} · Minimum ${medicine.minimum}`,
      link: "/bhw/inventory",
      machineCode: machineCode || null,
    });
  }
  try {
    await Notification.create({
      kind: "dispensing",
      severity: "info",
      title: `Medicine dispensed — ${medicine.name}`,
      body: `${qty} ${medicine.unit || "units"} to ${beneficiary.firstName} ${beneficiary.lastName} (${beneficiary.publicId})`,
      link: "/bhw/transactions",
    });
  } catch {}

  const full = await Transaction.findByPk(row.id, { include: INCLUDE });
  res.status(201).json({ transaction: serialize(full) });
}

// POST /transactions/:id/void — reverses a dispensing entry and restores stock.
export async function voidTransaction(req, res) {
  const row = await Transaction.findByPk(req.params.id, { include: INCLUDE });
  if (!row) return res.status(404).json({ error: "Transaction not found" });
  if (row.status === "voided") return res.status(409).json({ error: "Already voided." });

  await row.update({ status: "voided", note: row.note ? `${row.note} · Voided` : "Voided" });
  const medicine = await Medicine.findByPk(row.medicineId);
  if (medicine) await medicine.update({ stock: medicine.stock + row.quantity });
  if (row.prescriptionId) {
    const p = await Prescription.findByPk(row.prescriptionId);
    if (p) await p.update({ remaining: p.remaining + row.quantity, status: "active" });
  }
  const full = await Transaction.findByPk(row.id, { include: INCLUDE });
  res.json({ transaction: serialize(full) });
}
