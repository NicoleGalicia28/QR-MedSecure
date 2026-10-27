import { verifyAccessToken } from "../utils/jwt.js";

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Maps the JWT's role (a display string from login) onto canonical slugs so
// requireRole can match reliably regardless of formatting.
const ROLE_SLUGS = {
  "admin": "admin",
  "secretary": "secretary",
  "secretary (admin)": "secretary",
  "bhw": "bhw",
  "chairman": "chairman",
  "doctor": "doctor",
  "nurse": "nurse",
};

export function roleSlug(role) {
  const key = String(role || "").trim().toLowerCase();
  return ROLE_SLUGS[key] || key;
}

export function requireRole(...roles) {
  const allowed = roles.map(roleSlug);
  return (req, res, next) => {
    if (!req.user || !allowed.includes(roleSlug(req.user.role))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
