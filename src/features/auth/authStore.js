// Real authentication against the backend (Express + Sequelize + JWT).
//
// The browser stores only the access/refresh tokens and a lightweight copy of
// the profile used by route guards. Passwords are never kept client-side and
// there is no mock/offline account store any more — if the server cannot be
// reached, sign-in fails with a clear message.
import { api as request, setTokens, clearTokens } from "../../lib/api";

const SESSION_KEY = "qrmed:session";

// Maps a backend user row onto the shape the rest of the app expects.
function normalizeBackendUser(u) {
  if (!u) return u;
  const name = u.name || [u.firstName, u.lastName].filter(Boolean).join(" ");
  return {
    id: u.id,
    firstName: u.firstName || (name || "").split(" ")[0] || "",
    lastName: u.lastName || (name || "").split(" ").slice(1).join(" ") || "",
    email: u.email,
    role: u.role,
    isAdmin: u.isAdmin === true || String(u.role || "").toLowerCase().includes("admin"),
  };
}

function messageFor(err) {
  if (err?.offline) {
    return "Cannot reach the server. Check your connection and try again.";
  }
  return err?.message || "Something went wrong. Please try again.";
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Stores the profile copy used by the layouts and route guards. Called after
// sign-in, after a profile edit, and by refreshSession().
export function setSession(user, tokens = {}) {
  try {
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const normalized = normalizeBackendUser(user);
    const payload = {
      ...normalized,
      ...(tokens.accessToken ? { accessToken: tokens.accessToken } : {}),
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {}
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("session");
  clearTokens();
}

export function isAdmin(user) {
  return !!user && user.isAdmin === true;
}

// Maps a signed-in user to their workspace: "admin", "bhw", "chairman",
// "other" (a role without its own workspace, e.g. Doctor), or null when
// signed out.
export function roleKey(user) {
  if (!user) return null;
  if (user.isAdmin === true) return "admin";
  const role = String(user.role || "").toLowerCase();
  if (role.includes("bhw")) return "bhw";
  if (role.includes("secretary") || role.includes("admin")) return "admin";
  if (role.includes("chairman")) return "chairman";
  return "other";
}

// Where a user should land right after signing in.
export function homePathFor(user) {
  switch (roleKey(user)) {
    case "admin":
      return "/admin/dashboard";
    case "bhw":
      return "/bhw/dashboard";
    case "chairman":
      return "/chairman/dashboard";
    case "other":
      return "/account-pending";
    default:
      return "/login";
  }
}

// Signs in against the backend. Returns { ok, user } or { ok: false, error }.
export async function login(email, password) {
  const normalized = String(email || "").trim().toLowerCase();
  const pw = String(password || "");
  if (!normalized || !pw) {
    return { ok: false, error: "Enter your email and password." };
  }
  try {
    const res = await request("/auth/login", {
      method: "POST",
      auth: false,
      body: { email: normalized, password: pw },
    });
    setTokens(res);
    const user = normalizeBackendUser(res.user);
    setSession(user, { accessToken: res.accessToken, refreshToken: res.refreshToken });
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: messageFor(err) };
  }
}

// Public sign-up: files a pending account request the admin reviews before a
// real account is created.
export async function submitAccountRequest({
  firstName,
  lastName,
  email,
  mobile,
  role,
  reason,
  password,
}) {
  const name = [firstName, lastName].map((p) => String(p || "").trim()).filter(Boolean).join(" ");
  if (!name || !email || !password) {
    return { ok: false, error: "Name, email and password are required." };
  }
  try {
    const res = await request("/auth/register", {
      method: "POST",
      auth: false,
      body: {
        name,
        email: String(email).trim().toLowerCase(),
        role,
        reason: reason || (mobile ? `Mobile: ${mobile}` : ""),
        password,
      },
    });
    return { ok: true, request: res.request };
  } catch (err) {
    return { ok: false, error: messageFor(err) };
  }
}

// Public status lookup used by the "request submitted" screen so the
// applicant can watch their request move from pending to approved/rejected.
export async function getRequestStatus(id) {
  if (!id) return { ok: false, error: "Missing request id." };
  try {
    const res = await request(`/auth/requests/${encodeURIComponent(id)}`, { auth: false });
    return { ok: true, request: res.request };
  } catch (err) {
    return { ok: false, error: messageFor(err) };
  }
}

// Re-validates the stored token against the backend and refreshes the cached
// profile (name/role may have changed server-side). Returns the user or null.
export async function refreshSession() {
  try {
    const res = await request("/auth/me");
    const user = normalizeBackendUser(res.user);
    setSession(user);
    return user;
  } catch {
    return null;
  }
}
