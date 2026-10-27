import { fn, col } from "sequelize";
import { Beneficiary, ClinicalRecord, User, AuditLog } from "../models/index.js";
import { nextCode, fullName } from "../utils/codes.js";

async function audit(action, target, req) {
  try {
    await AuditLog.create({
      actorName: req.user?.email || "system",
      actorRole: req.user?.role || "",
      action,
      target: target || "",
    });
  } catch {
    /* best-effort */
  }
}

function serialize(b) {
  const year = b.birthDate ? parseInt(String(b.birthDate).slice(0, 4), 10) : null;
  const age = year ? new Date().getFullYear() - year : null;
  return {
    id: b.id,
    publicId: b.publicId,
    firstName: b.firstName,
    lastName: b.lastName,
    name: `${b.firstName} ${b.lastName}`,
    birthDate: b.birthDate || "",
    sex: b.sex || "",
    civilStatus: b.civilStatus || "",
    address: b.address || "",
    area: b.area || "",
    program: b.program || (age !== null && age >= 60 ? "Senior Citizen" : "General"),
    phone: b.phone || "",
    status: b.status,
    registeredBy: b.registeredBy || "",
    createdAt: b.createdAt,
  };
}

// Number of clinical records held for each beneficiary, keyed by beneficiary id.
async function recordCounts() {
  const rows = await ClinicalRecord.findAll({
    attributes: ["beneficiaryId", [fn("COUNT", col("id")), "total"]],
    group: ["beneficiaryId"],
    raw: true,
  });
  const map = new Map();
  for (const r of rows) map.set(r.beneficiaryId, Number(r.total) || 0);
  return map;
}

// GET /beneficiaries?q=&status=&area=
export async function list(req, res) {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.area) where.area = req.query.area;
  const rows = await Beneficiary.findAll({
    where,
    order: [["createdAt", "DESC"], ["updatedAt", "DESC"]],
    limit: 500,
  });
  const counts = await recordCounts();
  res.json({
    beneficiaries: rows.map((b) => ({
      ...serialize(b),
      recordsCount: counts.get(b.id) || 0,
    })),
  });
}

// GET /beneficiaries/:id  (numeric id or publicId like BEN-0452)
export async function getById(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? await Beneficiary.findByPk(id)
    : await Beneficiary.findOne({ where: { publicId: id } });
  if (!row) return res.status(404).json({ error: "Beneficiary not found" });

  const records = await ClinicalRecord.findAll({
    where: { beneficiaryId: row.id },
    include: [{ model: User, as: "recorder" }],
    order: [["createdAt", "DESC"]],
    limit: 20,
  });

  res.json({
    beneficiary: { ...serialize(row), recordsCount: records.length },
    records: records.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      findings: r.findings,
      reasonForVisit: r.reasonForVisit || "",
      symptoms: r.symptoms || "",
      medicalHistory: r.medicalHistory || "",
      notes: r.notes || "",
      prescription: r.prescription || "",
      bloodPressure: r.bloodPressure || "",
      weight: r.weight || "",
      // Clinical records are complete as soon as they are saved.
      status: "complete",
      recordedBy: fullName(r.recorder),
      recordedAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}

// POST /beneficiaries
export async function create(req, res) {
  const { firstName, lastName, birthDate, sex, civilStatus, address, area, phone, status, program } =
    req.body || {};
  if (!firstName || !lastName)
    return res.status(400).json({ error: "First name and last name are required." });

  const last = await Beneficiary.findOne({ order: [["publicId", "DESC"]] });
  const n = last ? parseInt(String(last.publicId).replace(/\D/g, ""), 10) + 1 : 452;
  const publicId = `BEN-${String(n).padStart(4, "0")}`;

  const year = birthDate ? parseInt(String(birthDate).slice(0, 4), 10) : null;
  const age = year ? new Date().getFullYear() - year : null;

  const row = await Beneficiary.create({
    publicId,
    firstName,
    lastName,
    birthDate: birthDate || null,
    sex: sex || "",
    civilStatus: civilStatus || "",
    address: address || "",
    area: area || "",
    program: program || (age !== null && age >= 60 ? "Senior Citizen" : "General"),
    phone: phone || "",
    status: status || "active",
    registeredBy: req.user?.email || "",
  });
  await audit(`Registered beneficiary ${publicId}`, `${firstName} ${lastName}`, req);
  try {
    const { Notification } = await import("../models/index.js");
    await Notification.create({
      kind: "beneficiary",
      severity: "info",
      title: "Beneficiary registered",
      body: `${firstName} ${lastName} (${publicId}) added to registry`,
      link: `/admin/beneficiaries/${publicId}`,
    });
  } catch {}
  res.status(201).json({ beneficiary: serialize(row) });
}

// PUT /beneficiaries/:id
export async function update(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? await Beneficiary.findByPk(id)
    : await Beneficiary.findOne({ where: { publicId: id } });
  if (!row) return res.status(404).json({ error: "Beneficiary not found" });
  const { firstName, lastName, birthDate, sex, civilStatus, address, area, phone, status, program } =
    req.body || {};
  const year = birthDate ? parseInt(String(birthDate).slice(0, 4), 10) : (row.birthDate ? parseInt(String(row.birthDate).slice(0, 4), 10) : null);
  const age = year ? new Date().getFullYear() - year : null;
  await row.update({
    firstName: firstName ?? row.firstName,
    lastName: lastName ?? row.lastName,
    birthDate: birthDate || row.birthDate,
    sex: sex ?? row.sex,
    civilStatus: civilStatus ?? row.civilStatus,
    address: address ?? row.address,
    area: area ?? row.area,
    program: program ?? row.program ?? (age !== null && age >= 60 ? "Senior Citizen" : "General"),
    phone: phone ?? row.phone,
    status: status ?? row.status,
  });
  await row.reload();
  await audit(`Updated beneficiary ${row.publicId}`, `${row.firstName} ${row.lastName}`, req);
  try {
    const { Notification } = await import("../models/index.js");
    await Notification.create({
      kind: "beneficiary",
      severity: "info",
      title: "Beneficiary updated",
      body: `${row.firstName} ${row.lastName} (${row.publicId}) record updated`,
      link: `/admin/beneficiaries/${row.publicId}`,
    });
  } catch {}
  res.json({ beneficiary: serialize(row) });
}

// GET /beneficiaries/:id/records
export async function records(req, res) {
  const { id } = req.params;
  const row = /^\d+$/.test(id)
    ? await Beneficiary.findByPk(id)
    : await Beneficiary.findOne({ where: { publicId: id } });
  if (!row) return res.status(404).json({ error: "Beneficiary not found" });
  const list = await ClinicalRecord.findAll({
    where: { beneficiaryId: row.id },
    include: [{ model: User, as: "recorder" }],
    order: [["createdAt", "DESC"]],
  });
  res.json({
    records: list.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      findings: r.findings,
      reasonForVisit: r.reasonForVisit || "",
      symptoms: r.symptoms || "",
      medicalHistory: r.medicalHistory || "",
      notes: r.notes || "",
      prescription: r.prescription || "",
      bloodPressure: r.bloodPressure || "",
      weight: r.weight || "",
      // Clinical records are complete as soon as they are saved.
      status: "complete",
      recordedBy: fullName(r.recorder),
      recordedAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}

export { nextCode };
