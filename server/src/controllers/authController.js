import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { Request, User, UserPref, AuditLog } from "../models/index.js";
import { fullName } from "../utils/codes.js";

// Records a privileged action in the audit trail. Failures never break the
// main operation — the trail is best-effort.
async function audit(action, target, req, reason = "") {
  try {
    await AuditLog.create({
      actorName: req.user?.email || "system",
      actorRole: req.user?.role || "",
      action,
      target: target || "",
      reason,
    });
  } catch {
    /* non-fatal */
  }
}

const DEFAULT_PREFS = {
  inApp: true,
  email: true,
  sms: false,
  lowStock: true,
  expiry: true,
  device: true,
  reports: true,
};

function issueTokens(user, res) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    isAdmin: !!user.isAdmin,
  });
  const refreshToken = signRefreshToken({ id: user.id });
  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: fullName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: !!user.isAdmin,
    },
  });
}

export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const email = String(req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Not a user yet — check if an account request explains why.
    const pending = await Request.findOne({ where: { email } });
    if (pending?.status === "pending")
      return res
        .status(403)
        .json({ error: "Your account request is still awaiting chairman approval." });
    if (pending?.status === "rejected")
      return res.status(403).json({ error: "Your account request was rejected. Contact the administrator." });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash).catch(() => false);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  if (user.status === "suspended")
    return res.status(403).json({ error: "This account has been suspended. Contact the administrator." });

  await user.update({ lastSignIn: new Date() });
  issueTokens(user, res);
}

// Public signup. Creates a pending account request; the admin approves it
// from user & role management, which promotes it into a real user row.
export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, role, reason } = req.body;
  const email = String(req.body.email || "").trim().toLowerCase();
  const { password } = req.body;

  if (!password || String(password).length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser)
    return res.status(409).json({ error: "An account with that email already exists." });
  const existingRequest = await Request.findOne({ where: { email } });
  if (existingRequest)
    return res.status(409).json({ error: "An account request for that email is already on file." });

  const row = await Request.create({
    name,
    email,
    role: role || "BHW",
    status: "pending",
    reason: reason || "",
    passwordHash: await bcrypt.hash(String(password), 12),
  });
  res.status(201).json({
    request: { id: row.id, name: row.name, email: row.email, role: row.role, status: row.status },
  });
}

// Public: an applicant checks the status of their own request. The email must
// match the row so the endpoint cannot be used to enumerate the queue.
export async function requestStatus(req, res) {
  const email = String(req.query.email || "").trim().toLowerCase();
  let row = null;
  try {
    row = await Request.findByPk(req.params.id);
  } catch {
    row = null;
  }
  if (!row || !email || String(row.email || "").toLowerCase() !== email)
    return res.status(404).json({ error: "Request not found" });

  res.json({
    request: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      reason: row.reason,
      reviewedBy: row.reviewedBy,
      submittedAt: row.createdAt,
    },
  });
}

// Admin/secretary: list pending + historical account requests.
export async function listRequests(req, res) {
  const rows = await Request.findAll({ order: [["createdAt", "DESC"]] });
  res.json({
    requests: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      status: r.status,
      reason: r.reason,
      reviewedBy: r.reviewedBy,
      submittedAt: r.createdAt,
    })),
  });
}

// Admin/secretary: approve or reject. Approval creates the real user account.
export async function reviewRequest(req, res) {
  const { id } = req.params;
  const decision = req.body?.decision === "approved" ? "approved" : "rejected";

  const row = await Request.findByPk(id);
  if (!row) return res.status(404).json({ error: "Request not found" });
  if (row.status !== "pending")
    return res.status(409).json({ error: `This request was already ${row.status}.` });

  let user = null;
  if (decision === "approved") {
    const [firstName, ...rest] = String(row.name || "").trim().split(/\s+/);
    user = await User.create({
      email: row.email,
      passwordHash: row.passwordHash || (await bcrypt.hash("ChangeMe@123", 12)),
      firstName: firstName || row.name,
      lastName: rest.join(" ") || "—",
      role: row.role,
      isAdmin: false,
      status: "active",
    });
    await UserPref.create({ userId: user.id, prefs: DEFAULT_PREFS });
  }

  await row.update({ status: decision, reviewedBy: req.user?.email || "admin" });
  await audit(
    decision === "approved" ? "Approved account request" : "Rejected account request",
    row.email,
    req,
    row.reason || "",
  );
  res.json({
    request: { id: row.id, status: row.status, reviewedBy: row.reviewedBy },
    user: user ? { id: user.id, email: user.email, role: user.role } : null,
  });
}

// Admin/secretary: suspend or reactivate an existing account.
export async function setAccountStatus(req, res) {
  const { id } = req.params;
  const status = req.body?.status === "suspended" ? "suspended" : "active";
  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.isAdmin && status === "suspended")
    return res.status(400).json({ error: "Administrator accounts cannot be suspended." });
  await user.update({ status });
  await audit(
    status === "suspended" ? "Suspended account" : "Reactivated account",
    user.email,
    req,
    req.body?.reason || "",
  );
  res.json({ user: { id: user.id, email: user.email, status: user.status } });
}

// Admin/secretary: invite a staff member — creates an active account with a
// one-time temporary password (returned once, never stored in plain text)
// so the admin can hand it over out of band. No approval round-trip needed
// because the admin is creating it personally.
export async function inviteUser(req, res) {
  const { name, role, email } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!name || !cleanEmail || !role)
    return res.status(400).json({ error: "name, email and role are required." });

  if (await User.findOne({ where: { email: cleanEmail } }))
    return res.status(409).json({ error: "An account with that email already exists." });
  if (await Request.findOne({ where: { email: cleanEmail } }))
    return res.status(409).json({ error: "An account request for that email is already on file." });

  // One-time password: readable, meets policy, changed at first sign-in.
  const tempPassword = `Temp-${Math.random().toString(36).slice(2, 8)}!`;
  const [firstName, ...rest] = String(name).trim().split(/\s+/);
  const user = await User.create({
    email: cleanEmail,
    passwordHash: await bcrypt.hash(tempPassword, 12),
    firstName: firstName || name,
    lastName: rest.join(" ") || "—",
    role,
    isAdmin: false,
    status: "active",
  });
  await UserPref.create({ userId: user.id, prefs: DEFAULT_PREFS });
  await audit("Invited staff account", cleanEmail, req, `Role: ${role}`);

  res.status(201).json({
    user: { id: user.id, email: user.email, name: fullName(user), role: user.role, status: user.status },
    tempPassword, // shown once — the admin shares it with the staff member
  });
}

// Admin/secretary: change an account's role.
export async function setRole(req, res) {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!role) return res.status(400).json({ error: "role is required." });
  if (String(req.user?.id) === String(id))
    return res.status(400).json({ error: "You cannot change your own role." });

  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const previous = user.role;
  await user.update({ role });
  await audit("Changed account role", user.email, req, `${previous} → ${role}`);
  res.json({ user: { id: user.id, email: user.email, role: user.role } });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken required" });
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);
    if (!user || user.status !== "active")
      return res.status(401).json({ error: "Account is not active" });
    const accessToken = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: !!user.isAdmin,
    });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
}

// The session endpoint: returns the full profile for the signed-in user.
export async function me(req, res) {
  const user = await User.findByPk(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: fullName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: !!user.isAdmin,
      status: user.status,
      phone: user.phone || "",
      sex: user.sex || "",
      birthDate: user.birthDate || "",
      address: user.address || "",
      lastSignIn: user.lastSignIn,
      passwordUpdatedAt: user.passwordUpdatedAt,
      createdAt: user.createdAt,
    },
  });
}
