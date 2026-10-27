// Real API client for the QR-MedSecure backend (Express + Sequelize).
//
// The backend is the single source of truth. There is no mock/offline data
// layer any more: if the server cannot be reached the call throws an Error
// with `offline = true` so screens can render a "cannot reach the server"
// state with a retry action.
const ORIGIN = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_ORIGIN = ORIGIN;
export const API_BASE = ORIGIN + "/api";

const TOKEN_KEY = "qrmed:token";
const REFRESH_KEY = "qrmed:refresh";
const SESSION_KEY = "qrmed:session";

export function setTokens({ accessToken, refreshToken } = {}) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("token", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem("refreshToken", refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem("accessToken");
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
}

export function getToken() {
  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (token) return token;
    token = localStorage.getItem("accessToken");
    if (token) return token;
    token = localStorage.getItem("token");
    if (token) return token;
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session?.accessToken) return session.accessToken;
      if (session?.token) return session.token;
    }
    const rawGeneric = localStorage.getItem("session");
    if (rawGeneric) {
      const session = JSON.parse(rawGeneric);
      if (session?.accessToken) return session.accessToken;
      if (session?.token) return session.token;
    }
  } catch (err) {
    console.warn("getToken parse failed", err);
  }
  return null;
}

export function getRefreshToken() {
  try {
    return (
      localStorage.getItem(REFRESH_KEY) ||
      localStorage.getItem("refreshToken") ||
      null
    );
  } catch {
    return null;
  }
}

export function isSignedIn() {
  return Boolean(getToken());
}

function offlineError(cause) {
  const err = new Error(
    "Cannot reach the server. Check your connection and try again.",
  );
  err.offline = true;
  err.cause = cause;
  return err;
}

// Exchanges the stored refresh token for a fresh access token. Returns true
// when a new access token was stored.
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(API_BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.accessToken) {
      setTokens({ accessToken: data.accessToken });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Low-level call. Throws on any failure:
//   - network down      -> Error with `offline = true`
//   - 4xx/5xx           -> Error with `status` and `data` from the server
export async function api(
  path,
  { method = "GET", body, auth = true, retry = true } = {},
) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw offlineError(err);
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 300) };
    }
  }

  // Expired access token: refresh once, then replay the request.
  if (res.status === 401 && auth && retry && path !== "/auth/login") {
    if (await refreshAccessToken()) {
      return api(path, { method, body, auth, retry: false });
    }
    clearTokens();
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem("session");
    } catch {}
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const err = new Error(
      data.error || data.message || `Request failed (${res.status})`,
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Downloads a file from an authenticated endpoint (CSV / PDF exports) using
// the stored token, so the browser saves it without exposing the token in a
// URL. When the server sends a Content-Disposition filename that name wins.
export async function downloadFile(path, filename) {
  const token = getToken();
  let res;
  try {
    res = await fetch(API_BASE + path, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
  } catch (err) {
    throw offlineError(err);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(text.slice(0, 200) || `Download failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match ? match[1] : filename;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}