// Sequential human-readable codes (CR-2026-0001, TXN-2026-0001, …) generated
// from the database so they are unique and gap-free per year.

export function codePrefix(kind) {
  return kind;
}

export async function nextCode(Model, kind) {
  const year = new Date().getFullYear();
  const prefix = `${kind}-${year}-`;
  // Scan every existing code for the year — cheap at this scale and immune
  // to createdAt ordering quirks (backfilled/imported rows).
  const rows = await Model.findAll({ attributes: ["code"], raw: true });
  let n = 0;
  for (const r of rows) {
    if (r.code && r.code.startsWith(prefix)) {
      const v = parseInt(r.code.slice(prefix.length), 10) || 0;
      if (v > n) n = v;
    }
  }
  return `${prefix}${String(n + 1).padStart(4, "0")}`;
}

// Human-friendly display names shared across controllers.
export function fullName(u) {
  if (!u) return "—";
  if (u.firstName || u.lastName) return `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return u.name || u.email || "—";
}

export function isoOrNull(d) {
  return d ? new Date(d).toISOString() : null;
}
