import bcrypt from "bcryptjs";
import { User, UserPref } from "../models/index.js";
import { fullName } from "../utils/codes.js";

const DEFAULT_PREFS = {
  inApp: true,
  email: true,
  sms: false,
  lowStock: true,
  expiry: true,
  device: true,
  reports: true,
};

// GET /users/me — full profile for the signed-in user.
export async function getProfile(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: serialize(user) });
}

// PUT /users/me — update editable profile fields.
export async function updateProfile(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { firstName, lastName, phone, sex, birthDate, address } = req.body || {};
  await user.update({
    firstName: firstName ?? user.firstName,
    lastName: lastName ?? user.lastName,
    phone: phone ?? user.phone,
    sex: sex ?? user.sex,
    birthDate: birthDate || user.birthDate,
    address: address ?? user.address,
  });
  res.json({ user: serialize(user) });
}

// PUT /users/me/password — requires the current password.
export async function changePassword(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { currentPassword, newPassword } = req.body || {};
  const ok = await bcrypt
    .compare(String(currentPassword || ""), user.passwordHash)
    .catch(() => false);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect." });
  if (!newPassword || String(newPassword).length < 8)
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  await user.update({
    passwordHash: await bcrypt.hash(String(newPassword), 12),
    passwordUpdatedAt: new Date(),
  });
  res.json({ ok: true, passwordUpdatedAt: user.passwordUpdatedAt });
}

// GET /users/me/notification-preferences
export async function getPreferences(req, res) {
  let row = await UserPref.findOne({ where: { userId: req.user.id } });
  if (!row) row = await UserPref.create({ userId: req.user.id, prefs: DEFAULT_PREFS });
  res.json({ preferences: { ...DEFAULT_PREFS, ...(row.prefs || {}) } });
}

// PUT /users/me/notification-preferences
export async function updatePreferences(req, res) {
  let row = await UserPref.findOne({ where: { userId: req.user.id } });
  if (!row) row = await UserPref.create({ userId: req.user.id, prefs: DEFAULT_PREFS });
  const merged = { ...DEFAULT_PREFS, ...(row.prefs || {}), ...(req.body || {}) };
  await row.update({ prefs: merged });
  res.json({ preferences: merged });
}



function serialize(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    name: fullName(u),
    firstName: u.firstName,
    lastName: u.lastName,
    isAdmin: !!u.isAdmin,
    status: u.status,
    phone: u.phone || "",
    sex: u.sex || "",
    birthDate: u.birthDate || "",
    address: u.address || "",
    lastSignIn: u.lastSignIn,
    passwordUpdatedAt: u.passwordUpdatedAt,
    createdAt: u.createdAt,
  };
}
