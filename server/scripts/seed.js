// Seeds a fresh database with the barangay's starting records: staff
// accounts, the medicine formulary and the dispensing unit. Run once after
// `sequelize.sync()` on a new install:
//
//   node scripts/seed.js
//
// Idempotent: does nothing if the users table already has accounts.
//
// No example/demo data is created. Beneficiaries, clinical records,
// prescriptions, dispensing transactions, notifications, QR codes and sync
// batches all start empty — they are produced by real use of the system, and
// every admin page renders its own empty state until then.

import bcrypt from "bcryptjs";
import { sequelize } from "../src/config/db.js";
import {
  User,
  UserPref,
  Beneficiary,
  Medicine,
  Machine,
  MachineEvent,
  SyncBatch,
  ClinicalRecord,
  Prescription,
  Transaction,
  Notification,
  QrToken,
} from "../src/models/index.js";

const DEFAULT_PREFS = {
  inApp: true,
  email: true,
  sms: false,
  lowStock: true,
  expiry: true,
  device: true,
  reports: true,
};

async function seedUsers() {
  if ((await User.count()) > 0) {
    console.log("[seed] users already present — skipping accounts");
    return;
  }
  const hash = await bcrypt.hash("Admin@123", 12);
  const demoHash = await bcrypt.hash("Demo@1234", 12);
  const rows = [
    { firstName: "Barangay", lastName: "Admin", email: "admin@example.com", passwordHash: hash, role: "Secretary (Admin)", isAdmin: true },
    { firstName: "Roberto", lastName: "Manalo", email: "roberto.manalo@example.com", passwordHash: demoHash, role: "Chairman" },
    { firstName: "Maria", lastName: "Santos", email: "maria.santos@example.com", passwordHash: demoHash, role: "BHW" },
    { firstName: "Elena", lastName: "Villanueva", email: "elena.villanueva@example.com", passwordHash: demoHash, role: "BHW" },
  ];
  for (const u of rows) {
    const user = await User.create({ ...u, status: "active" });
    await UserPref.create({ userId: user.id, prefs: DEFAULT_PREFS });
  }
  console.log(`[seed] ${rows.length} staff accounts created`);
}

async function seedMedicines() {
  if ((await Medicine.count()) > 0) return;
  const rows = [
    { code: "MED-001", name: "Amlodipine 5 mg", slot: "Slot C", stock: 38, minimum: 150, unit: "tablets", category: "Antihypertensive", expiryDate: "2027-04-30" },
    { code: "MED-003", name: "Metformin 500 mg", slot: "Slot B", stock: 210, minimum: 120, unit: "tablets", category: "Antidiabetic", expiryDate: "2027-08-31" },
    { code: "MED-006", name: "Losartan 50 mg", slot: "Slot A", stock: 150, minimum: 100, unit: "tablets", category: "Antihypertensive", expiryDate: "2027-12-31" },
  ];
  await Medicine.bulkCreate(rows);
  console.log(`[seed] ${rows.length} medicines on the formulary`);
}

async function seedBeneficiaries() {
  if ((await Beneficiary.count()) > 0) return;
  // No demo beneficiaries - start empty
  console.log(`[seed] 0 beneficiaries registered`);
}

async function seedMachine() {
  if ((await Machine.count()) > 0) return;
  const m = await Machine.create({
    code: "TY-DM-01",
    name: "Health center lobby dispenser",
    status: "online",
    firmware: "2.4.1",
    slotsTotal: 5,
    temperature: 24.5,
    door: "locked",
    lastHeartbeat: new Date(),
  });
  await MachineEvent.bulkCreate([
    { machineId: m.id, kind: "installation", note: "Unit commissioned at the health center lobby.", recordedBy: "admin@example.com" },
    { machineId: m.id, kind: "firmware", note: "Upgraded to firmware 2.4.1.", recordedBy: "admin@example.com" },
  ]);
  console.log("[seed] dispensing unit TY-DM-01 registered");
}

async function seedSyncHistory() {
  if ((await SyncBatch.count()) > 0) return;
  // Sync batches are written by the client when it synchronises. A fresh
  // install has none, so the Sync history page starts empty.
  console.log("[seed] 0 sync batches");
}

async function seedClinicalRecords() {
  if ((await ClinicalRecord.count()) > 0) return;
  console.log(`[seed] 0 clinical records`);
}

async function seedPrescriptions() {
  if ((await Prescription.count()) > 0) return;
  console.log(`[seed] 0 prescriptions`);
}

async function seedTransactions() {
  if ((await Transaction.count()) > 0) return;
  console.log(`[seed] 0 dispensing transactions`);
}

async function seedNotifications() {
  if ((await Notification.count()) > 0) return;
  console.log(`[seed] 0 notifications`);
}

async function seedQrTokens() {
  if ((await QrToken.count()) > 0) return;
  // QR codes are issued from the Beneficiary ID directory against a real
  // beneficiary. Nothing is issued until one is registered.
  console.log("[seed] 0 QR tokens");
}

try {
  await sequelize.authenticate();
  try {
    await sequelize.sync();
  } catch (e) {
    console.error("[seed] sync warning:", e.message);
  }
  await seedUsers();
  await seedMedicines();
  await seedBeneficiaries();
  await seedMachine();
  await seedSyncHistory();
  await seedClinicalRecords();
  await seedPrescriptions();
  await seedTransactions();
  await seedNotifications();
  await seedQrTokens();
  console.log("[seed] done");
} catch (e) {
  console.error("[seed] failed:", e);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
