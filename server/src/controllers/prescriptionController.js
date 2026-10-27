import { Prescription, Medicine, Beneficiary } from "../models/index.js";
import { nextCode } from "../utils/codes.js";

const INCLUDE = [
  { model: Beneficiary, as: "beneficiary" },
  { model: Medicine, as: "medicine" },
];

function serialize(p) {
  return {
    id: p.id,
    code: p.code,
    beneficiaryId: p.beneficiary?.publicId || p.beneficiaryId,
    beneficiary: p.beneficiary ? `${p.beneficiary.firstName} ${p.beneficiary.lastName}` : "—",
    medicineId: p.medicineId,
    medicine: p.medicine?.name || "—",
    dosage: p.dosage || "",
    quantity: p.quantity,
    remaining: p.remaining,
    prescribedBy: p.prescribedBy || "",
    validUntil: p.validUntil || "",
    status: p.status,
  };
}

// GET /prescriptions?beneficiaryId=&status=
export async function list(req, res) {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.beneficiaryId) {
    const b = /^\d+$/.test(req.query.beneficiaryId)
      ? await Beneficiary.findByPk(req.query.beneficiaryId)
      : await Beneficiary.findOne({ where: { publicId: req.query.beneficiaryId } });
    if (!b) return res.json({ prescriptions: [] });
    where.beneficiaryId = b.id;
  }
  const rows = await Prescription.findAll({
    where,
    include: INCLUDE,
    order: [["createdAt", "DESC"]],
    limit: 200,
  });
  res.json({ prescriptions: rows.map(serialize) });
}

// GET /prescriptions/active/:beneficiaryId — what the dispenser shows after
// a successful scan.
export async function activeForBeneficiary(req, res) {
  const { beneficiaryId } = req.params;
  const b = /^\d+$/.test(String(beneficiaryId))
    ? await Beneficiary.findByPk(beneficiaryId)
    : await Beneficiary.findOne({ where: { publicId: beneficiaryId } });
  if (!b) return res.status(404).json({ error: "Beneficiary not found" });
  const rows = await Prescription.findAll({
    where: { beneficiaryId: b.id, status: "active" },
    include: INCLUDE,
    order: [["createdAt", "DESC"]],
  });
  res.json({ prescriptions: rows.map(serialize) });
}

// POST /prescriptions
export async function create(req, res) {
  const { beneficiaryId, medicineId, dosage, quantity, prescribedBy, validUntil } =
    req.body || {};
  const qty = Number(quantity) || 0;
  if (!beneficiaryId || !medicineId || qty <= 0)
    return res.status(400).json({ error: "beneficiaryId, medicineId and a positive quantity are required." });

  const b = /^\d+$/.test(String(beneficiaryId))
    ? await Beneficiary.findByPk(beneficiaryId)
    : await Beneficiary.findOne({ where: { publicId: beneficiaryId } });
  if (!b) return res.status(404).json({ error: "Beneficiary not found" });
  const medicine = await Medicine.findByPk(medicineId);
  if (!medicine) return res.status(404).json({ error: "Medicine not found" });

  const row = await Prescription.create({
    code: await nextCode(Prescription, "RX"),
    beneficiaryId: b.id,
    medicineId: medicine.id,
    dosage: dosage || "",
    quantity: qty,
    remaining: qty,
    prescribedBy: prescribedBy || req.user?.email || "",
    validUntil: validUntil || null,
    status: "active",
  });
  const full = await Prescription.findByPk(row.id, { include: INCLUDE });
  try {
    const { Notification } = await import("../models/index.js");
    await Notification.create({
      kind: "prescription",
      severity: "info",
      title: "Prescription issued",
      body: `${full.beneficiary?.firstName || ""} ${full.beneficiary?.lastName || ""} · ${full.medicine?.name || ""} ${full.quantity} ${full.medicine?.unit || "units"}`,
      link: "/bhw/transactions",
    });
  } catch {}
  res.status(201).json({ prescription: serialize(full) });
}

// PUT /prescriptions/:id
export async function update(req, res) {
  const row = await Prescription.findByPk(req.params.id, { include: INCLUDE });
  if (!row) return res.status(404).json({ error: "Prescription not found" });
  const { dosage, validUntil, status } = req.body || {};
  await row.update({
    dosage: dosage ?? row.dosage,
    validUntil: validUntil || row.validUntil,
    status: ["active", "completed", "expired"].includes(status) ? status : row.status,
  });
  const full = await Prescription.findByPk(row.id, { include: INCLUDE });
  res.json({ prescription: serialize(full) });
}
