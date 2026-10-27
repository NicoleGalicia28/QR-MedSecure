import { ClinicalRecord, Beneficiary, User } from "../models/index.js";
import { nextCode, fullName } from "../utils/codes.js";

function serialize(r) {
  return {
    id: r.id,
    code: r.code,
    beneficiaryId: r.beneficiary?.publicId || r.beneficiaryId,
    beneficiary: r.beneficiary ? `${r.beneficiary.firstName} ${r.beneficiary.lastName}` : "—",
    type: r.type,
    findings: r.findings || "",
    reasonForVisit: r.reasonForVisit || "",
    symptoms: r.symptoms || "",
    medicalHistory: r.medicalHistory || "",
    notes: r.notes || "",
    prescription: r.prescription || "",
    bloodPressure: r.bloodPressure || "",
    weight: r.weight || "",
    // A record is complete the moment it is saved, so the status is a fixed
    // value rather than something that can be flipped.
    status: "complete",
    recordedBy: fullName(r.recorder),
    recordedAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

const INCLUDE = [
  { model: Beneficiary, as: "beneficiary" },
  { model: User, as: "recorder" },
];

// GET /clinical-records?status=&beneficiaryId=&limit=
export async function list(req, res) {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.beneficiaryId) {
    // Accept both the internal id and the public id (BEN-0452).
    const b = /^\d+$/.test(String(req.query.beneficiaryId))
      ? await Beneficiary.findByPk(req.query.beneficiaryId)
      : await Beneficiary.findOne({ where: { publicId: req.query.beneficiaryId } });
    if (!b) return res.json({ records: [] });
    where.beneficiaryId = b.id;
  }
  const limit = Math.min(Number(req.query.limit) || 300, 300);
  const rows = await ClinicalRecord.findAll({
    where,
    include: INCLUDE,
    order: [["createdAt", "DESC"]],
    limit,
  });
  res.json({ records: rows.map(serialize) });
}

// GET /clinical-records/:id  (numeric id or code like CR-2026-0001)
export async function getById(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? await ClinicalRecord.findByPk(id, { include: INCLUDE })
    : await ClinicalRecord.findOne({ where: { code: id }, include: INCLUDE });
  if (!row) return res.status(404).json({ error: "Record not found" });
  res.json({ record: serialize(row) });
}

// POST /clinical-records
export async function create(req, res) {
  const {
    beneficiaryId,
    type,
    findings,
    reasonForVisit,
    symptoms,
    medicalHistory,
    notes,
    prescription,
    bloodPressure,
    weight,
  } = req.body || {};
  if (!beneficiaryId || !type)
    return res.status(400).json({ error: "beneficiaryId and type are required." });

  const beneficiary = /^\d+$/.test(String(beneficiaryId))
    ? await Beneficiary.findByPk(beneficiaryId)
    : await Beneficiary.findOne({ where: { publicId: beneficiaryId } });
  if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });

  const row = await ClinicalRecord.create({
    code: await nextCode(ClinicalRecord, "CR"),
    beneficiaryId: beneficiary.id,
    type,
    findings: findings || "",
    reasonForVisit: reasonForVisit || "",
    symptoms: symptoms || "",
    medicalHistory: medicalHistory || "",
    notes: notes || "",
    prescription: prescription || "",
    bloodPressure: bloodPressure || "",
    weight: weight || "",
    // The record is saved as soon as the form is filled in — there is no
    // separate "for review" queue to move it through.
    status: "complete",
    recordedById: req.user?.id || null,
  });
  const full = await ClinicalRecord.findByPk(row.id, { include: INCLUDE });
  try {
    const { Notification } = await import("../models/index.js");
    await Notification.create({
      kind: "clinical",
      severity: "info",
      title: "Clinical record added",
      body: `${full.beneficiary?.firstName || ""} ${full.beneficiary?.lastName || ""} · ${full.type}`,
      link: `/bhw/clinical-records/${full.id}`,
    });
  } catch {}
  res.status(201).json({ record: serialize(full) });
}

// PUT /clinical-records/:id
export async function update(req, res) {
  const row = await ClinicalRecord.findByPk(req.params.id, { include: INCLUDE });
  if (!row) return res.status(404).json({ error: "Record not found" });
  const {
    type,
    findings,
    reasonForVisit,
    symptoms,
    medicalHistory,
    notes,
    prescription,
    bloodPressure,
    weight,
  } = req.body || {};
  await row.update({
    type: type ?? row.type,
    findings: findings ?? row.findings,
    reasonForVisit: reasonForVisit ?? row.reasonForVisit,
    symptoms: symptoms ?? row.symptoms,
    medicalHistory: medicalHistory ?? row.medicalHistory,
    notes: notes ?? row.notes,
    prescription: prescription ?? row.prescription,
    bloodPressure: bloodPressure ?? row.bloodPressure,
    weight: weight ?? row.weight,
    // Editing a filled-in record keeps it complete.
    status: "complete",
  });
  const full = await ClinicalRecord.findByPk(row.id, { include: INCLUDE });
  try {
    const { Notification } = await import("../models/index.js");
    await Notification.create({
      kind: "clinical",
      severity: "info",
      title: "Clinical record updated",
      body: `${full.beneficiary?.firstName || ""} ${full.beneficiary?.lastName || ""} · ${full.type}`,
      link: `/bhw/clinical-records/${full.id}`,
    });
  } catch {}
  res.json({ record: serialize(full) });
}
