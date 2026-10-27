import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

// ---------------------------------------------------------------------------
// Users & access
// ---------------------------------------------------------------------------

export const User = sequelize.define(
  "User",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false },
    isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
    // active | suspended (pending accounts live in `requests` until approved)
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    phone: { type: DataTypes.STRING },
    sex: { type: DataTypes.STRING },
    birthDate: { type: DataTypes.DATEONLY },
    address: { type: DataTypes.STRING },
    lastSignIn: { type: DataTypes.DATE },
    passwordUpdatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "users", timestamps: true },
);

// Account requests submitted through /auth/register. Approved requests are
// promoted into `users` by the admin review endpoint.
export const Request = sequelize.define(
  "Request",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    role: { type: DataTypes.STRING, allowNull: false },
    // pending | approved | rejected
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
    reason: { type: DataTypes.TEXT },
    reviewedBy: { type: DataTypes.STRING },
    passwordHash: { type: DataTypes.STRING },
  },
  { tableName: "requests", timestamps: true },
);

// Per-user notification switches, one row per user.
export const UserPref = sequelize.define(
  "UserPref",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    prefs: { type: DataTypes.JSON, defaultValue: {} },
  },
  { tableName: "user_prefs", timestamps: false },
);

// ---------------------------------------------------------------------------
// Beneficiaries & clinical data
// ---------------------------------------------------------------------------

export const Beneficiary = sequelize.define(
  "Beneficiary",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    publicId: { type: DataTypes.STRING, allowNull: false, unique: true },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    birthDate: { type: DataTypes.DATEONLY },
    sex: { type: DataTypes.STRING },
    civilStatus: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    area: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    program: { type: DataTypes.STRING },
    // active | archived
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    registeredBy: { type: DataTypes.STRING },
  },
  { tableName: "beneficiaries", timestamps: true },
);

export const ClinicalRecord = sequelize.define(
  "ClinicalRecord",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    beneficiaryId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    findings: { type: DataTypes.TEXT },
    // Structured visit fields. They are stored separately so a record can be
    // re-opened and edited field-by-field instead of as one opaque blob.
    reasonForVisit: { type: DataTypes.STRING },
    symptoms: { type: DataTypes.TEXT },
    medicalHistory: { type: DataTypes.TEXT },
    notes: { type: DataTypes.TEXT },
    prescription: { type: DataTypes.TEXT },
    bloodPressure: { type: DataTypes.STRING },
    weight: { type: DataTypes.STRING },
    // A record is stored as soon as the form is filled in, so "complete" is
    // the only state a clinical record can be in.
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "complete" },
    recordedById: { type: DataTypes.INTEGER },
  },
  { tableName: "clinical_records", timestamps: true },
);

export const Prescription = sequelize.define(
  "Prescription",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    beneficiaryId: { type: DataTypes.INTEGER, allowNull: false },
    medicineId: { type: DataTypes.INTEGER, allowNull: false },
    dosage: { type: DataTypes.STRING },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    remaining: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    prescribedBy: { type: DataTypes.STRING },
    validUntil: { type: DataTypes.DATEONLY },
    // active | completed | expired
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
  },
  { tableName: "prescriptions", timestamps: true },
);

// ---------------------------------------------------------------------------
// Pharmacy / dispensing
// ---------------------------------------------------------------------------

export const Medicine = sequelize.define(
  "Medicine",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    slot: { type: DataTypes.STRING },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    minimum: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    unit: { type: DataTypes.STRING, allowNull: false, defaultValue: "tablets" },
    category: { type: DataTypes.STRING },
    expiryDate: { type: DataTypes.DATEONLY },
  },
  { tableName: "medicines", timestamps: true },
);

export const Transaction = sequelize.define(
  "Transaction",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    beneficiaryId: { type: DataTypes.INTEGER, allowNull: false },
    medicineId: { type: DataTypes.INTEGER, allowNull: false },
    prescriptionId: { type: DataTypes.INTEGER },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    dispensedById: { type: DataTypes.INTEGER },
    machineCode: { type: DataTypes.STRING },
    cycleKey: { type: DataTypes.STRING },
    // completed | voided
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "completed" },
    note: { type: DataTypes.TEXT },
  },
  { tableName: "transactions", timestamps: true },
);

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export const Machine = sequelize.define(
  "Machine",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    // online | offline | maintenance
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "online" },
    firmware: { type: DataTypes.STRING },
    slotsTotal: { type: DataTypes.INTEGER, defaultValue: 5 },
    temperature: { type: DataTypes.FLOAT },
    door: { type: DataTypes.STRING, defaultValue: "locked" },
    lastHeartbeat: { type: DataTypes.DATE },
  },
  { tableName: "machines", timestamps: true },
);

export const MachineEvent = sequelize.define(
  "MachineEvent",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    machineId: { type: DataTypes.INTEGER, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false },
    note: { type: DataTypes.TEXT },
    recordedBy: { type: DataTypes.STRING },
  },
  { tableName: "machine_events", timestamps: true },
);

// ---------------------------------------------------------------------------
// QR tokens, notifications, sync, audit
// ---------------------------------------------------------------------------

// Single-use QR tokens. Generated per dispensing visit, consumed on scan.
export const QrToken = sequelize.define(
  "QrToken",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    token: { type: DataTypes.STRING, allowNull: false, unique: true },
    beneficiaryId: { type: DataTypes.INTEGER, allowNull: false },
    // active | used | revoked | expired
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    issuedById: { type: DataTypes.INTEGER },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE },
  },
  { tableName: "qr_tokens", timestamps: true },
);

export const Notification = sequelize.define(
  "Notification",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kind: { type: DataTypes.STRING, allowNull: false },
    severity: { type: DataTypes.STRING, defaultValue: "info" },
    title: { type: DataTypes.STRING, allowNull: false },
    body: { type: DataTypes.TEXT },
    forRole: { type: DataTypes.STRING },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    link: { type: DataTypes.STRING },
    machineCode: { type: DataTypes.STRING },
  },
  { tableName: "notifications", timestamps: true },
);

export const RestockLog = sequelize.define(
  "RestockLog",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    medicineId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    previousStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    newStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expiryDate: { type: DataTypes.DATEONLY },
    receivedById: { type: DataTypes.INTEGER },
    receivedByName: { type: DataTypes.STRING },
    note: { type: DataTypes.TEXT },
  },
  { tableName: "restock_logs", timestamps: true },
);

export const SyncBatch = sequelize.define(
  "SyncBatch",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    batchId: { type: DataTypes.STRING, allowNull: false, unique: true },
    // success | partial | failed | running
    status: { type: DataTypes.STRING, allowNull: false },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    completedAt: { type: DataTypes.DATE },
    records: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    failed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    initiatedBy: { type: DataTypes.STRING },
    device: { type: DataTypes.STRING },
  },
  { tableName: "sync_batches", timestamps: true },
);

// Immutable trail of privileged admin/chairman actions.
export const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    actorName: { type: DataTypes.STRING, allowNull: false },
    actorRole: { type: DataTypes.STRING },
    action: { type: DataTypes.STRING, allowNull: false },
    target: { type: DataTypes.STRING },
    reason: { type: DataTypes.STRING },
  },
  { tableName: "audit_log", timestamps: true },
);

// ---------------------------------------------------------------------------
// Associations
// ---------------------------------------------------------------------------

Beneficiary.hasMany(ClinicalRecord, { foreignKey: "beneficiaryId", as: "records" });
ClinicalRecord.belongsTo(Beneficiary, { foreignKey: "beneficiaryId", as: "beneficiary" });
ClinicalRecord.belongsTo(User, { foreignKey: "recordedById", as: "recorder" });

Beneficiary.hasMany(Prescription, { foreignKey: "beneficiaryId", as: "prescriptions" });
Prescription.belongsTo(Beneficiary, { foreignKey: "beneficiaryId", as: "beneficiary" });
Prescription.belongsTo(Medicine, { foreignKey: "medicineId", as: "medicine" });

Beneficiary.hasMany(Transaction, { foreignKey: "beneficiaryId", as: "transactions" });
Transaction.belongsTo(Beneficiary, { foreignKey: "beneficiaryId", as: "beneficiary" });
Transaction.belongsTo(Medicine, { foreignKey: "medicineId", as: "medicine" });
Transaction.belongsTo(User, { foreignKey: "dispensedById", as: "dispenser" });
Transaction.belongsTo(Prescription, { foreignKey: "prescriptionId", as: "prescription" });

Machine.hasMany(MachineEvent, { foreignKey: "machineId", as: "events" });
MachineEvent.belongsTo(Machine, { foreignKey: "machineId", as: "machine" });

Medicine.hasMany(RestockLog, { foreignKey: "medicineId", as: "restocks" });
RestockLog.belongsTo(Medicine, { foreignKey: "medicineId", as: "medicine" });
RestockLog.belongsTo(User, { foreignKey: "receivedById", as: "receivedBy" });

Beneficiary.hasMany(QrToken, { foreignKey: "beneficiaryId", as: "qrTokens" });
QrToken.belongsTo(Beneficiary, { foreignKey: "beneficiaryId", as: "beneficiary" });
