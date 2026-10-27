import crypto from "crypto";
import { QrToken, Beneficiary, Prescription, ClinicalRecord } from "../models/index.js";
import { encryptJSON, decryptJSON } from "../utils/crypto.js";

const TTL_MINUTES = 10;

function serialize(t) {
  return {
    id: t.id,
    token: t.token,
    beneficiaryId: t.beneficiary?.publicId || t.beneficiaryId,
    beneficiary: t.beneficiary ? `${t.beneficiary.firstName} ${t.beneficiary.lastName}` : "—",
    status: t.status,
    issuedAt: t.createdAt,
    expiresAt: t.expiresAt,
    usedAt: t.usedAt,
  };
}

// POST /qr/issue — generate QR containing the beneficiary ID for dispensing/cross-checking.
export async function issue(req, res) {
  const { beneficiaryId } = req.params;
  const beneficiary = /^\d+$/.test(String(beneficiaryId))
    ? await Beneficiary.findByPk(beneficiaryId)
    : await Beneficiary.findOne({ where: { publicId: beneficiaryId } });
  if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });

  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);
  const row = await QrToken.create({
    token,
    beneficiaryId: beneficiary.id,
    status: "active",
    issuedById: req.user?.id || null,
    expiresAt,
  });

  // Store beneficiary ID directly in QR payload for easy scanning
  const payload = { v: 1, type: "beneficiary", bid: beneficiary.publicId, beneficiaryId: beneficiary.publicId };
  const text = JSON.stringify(payload);
  const QRCode = (await import("qrcode")).default;
  const dataUrl = await QRCode.toDataURL(text, { width: 280, margin: 1 });

  res.status(201).json({ qr: serialize(row), dataUrl, expiresAt: expiresAt.toISOString() });
}

// POST /qr/validate — scan QR and return full beneficiary information for dispensing/cross-checking.
export async function validate(req, res) {
  const { qrData } = req.body || {};
  if (!qrData) return res.status(400).json({ error: "qrData is required." });

  let payload;
  try {
    const parsed = typeof qrData === "string" ? JSON.parse(qrData) : qrData;
    // Support both new format (plain beneficiary ID) and legacy encrypted format
    if (parsed?.type === "beneficiary" && (parsed.bid || parsed.beneficiaryId)) {
      payload = { bid: parsed.bid || parsed.beneficiaryId };
    } else {
      payload = decryptJSON(parsed);
    }
  } catch {
    return res.status(400).json({ valid: false, reason: "invalid", error: "Malformed or tampered QR payload." });
  }

  const beneficiaryId = payload?.bid || payload?.beneficiaryId || payload?.tid;
  if (!beneficiaryId) return res.status(400).json({ valid: false, reason: "invalid" });

  // Try to find by publicId first (new format)
  let beneficiary = await Beneficiary.findOne({ where: { publicId: beneficiaryId } });
  
  // Fallback to token lookup for legacy format
  if (!beneficiary && payload?.tid) {
    const row = await QrToken.findOne({
      where: { token: payload.tid },
      include: [{ model: Beneficiary, as: "beneficiary" }],
    });
    if (!row) return res.status(404).json({ valid: false, reason: "unknown", error: "Token not recognized." });
    if (row.status === "used")
      return res.status(409).json({ valid: false, reason: "used", error: "This QR code was already used." });
    if (row.status === "revoked")
      return res.status(410).json({ valid: false, reason: "revoked", error: "This QR code was revoked." });
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await row.update({ status: "expired" });
      return res.status(410).json({ valid: false, reason: "expired", error: "This QR code has expired." });
    }
    await row.update({ status: "used", usedAt: new Date() });
    beneficiary = row.beneficiary;
  }

  if (!beneficiary) return res.status(404).json({ valid: false, reason: "unknown", error: "Beneficiary not found." });

  // Fetch prescriptions and clinical records for dispensing/cross-checking
  const prescriptions = await Prescription.findAll({
    where: { beneficiaryId: beneficiary.id },
    order: [["createdAt", "DESC"]],
    limit: 10,
  });
  const records = await ClinicalRecord.findAll({
    where: { beneficiaryId: beneficiary.id },
    order: [["createdAt", "DESC"]],
    limit: 10,
  });

  res.json({
    valid: true,
    beneficiary: {
      id: beneficiary.id,
      publicId: beneficiary.publicId,
      name: `${beneficiary.firstName} ${beneficiary.lastName}`,
      firstName: beneficiary.firstName,
      lastName: beneficiary.lastName,
      middleName: beneficiary.middleName || "",
      birthDate: beneficiary.birthDate,
      sex: beneficiary.sex,
      address: beneficiary.address,
      area: beneficiary.area,
      phone: beneficiary.phone,
      program: beneficiary.program,
      status: beneficiary.status,
      createdAt: beneficiary.createdAt,
    },
    prescriptions: prescriptions.map((p) => ({
      id: p.id,
      code: p.code,
      medicine: p.medicine,
      dosage: p.dosage,
      quantity: p.quantity,
      remaining: p.remaining,
      status: p.status,
      prescribedBy: p.prescribedBy,
      validUntil: p.validUntil,
      createdAt: p.createdAt,
    })),
    clinicalRecords: records.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      findings: r.findings,
      reasonForVisit: r.reasonForVisit,
      symptoms: r.symptoms,
      medicalHistory: r.medicalHistory,
      notes: r.notes,
      prescription: r.prescription,
      bloodPressure: r.bloodPressure,
      weight: r.weight,
      status: r.status,
      recordedAt: r.createdAt,
    })),
  });
}

// POST /qr/revoke — invalidate an active token (lost phone, suspected leak).
export async function revoke(req, res) {
  const row = await QrToken.findOne({ where: { token: req.params.token } });
  if (!row) return res.status(404).json({ error: "Token not found" });
  if (row.status !== "active") return res.status(409).json({ error: `Token is already ${row.status}.` });
  await row.update({ status: "revoked" });
  res.json({ qr: serialize(row) });
}

// GET /qr/tokens?beneficiaryId= — issuance history for the audit trail.
export async function history(req, res) {
  const where = {};
  if (req.query.beneficiaryId) {
    const b = /^\d+$/.test(req.query.beneficiaryId)
      ? await Beneficiary.findByPk(req.query.beneficiaryId)
      : await Beneficiary.findOne({ where: { publicId: req.query.beneficiaryId } });
    if (!b) return res.json({ tokens: [] });
    where.beneficiaryId = b.id;
  }
  const rows = await QrToken.findAll({
    where,
    include: [{ model: Beneficiary, as: "beneficiary" }],
    order: [["createdAt", "DESC"]],
    limit: 100,
  });
  res.json({ tokens: rows.map(serialize) });
}
