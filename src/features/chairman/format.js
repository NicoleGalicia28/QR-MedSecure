// Small display formatters shared by the Chairman workspace pages. They
// turn the backend's ISO timestamps into the strings the static design
// uses ("05 Oct 2026", "05 Oct, 10:15", "05 Oct 2026, 10:15").
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parse(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n) => String(n).padStart(2, "0");

// "05 Oct 2026"
export function fmtDate(iso) {
  const d = parse(iso);
  if (!d) return iso || "—";
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "10:15"
export function fmtTime(iso) {
  const d = parse(iso);
  if (!d) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "05 Oct, 10:15"
export function fmtDateTime(iso) {
  const d = parse(iso);
  if (!d) return iso || "—";
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}, ${fmtTime(iso)}`;
}

// "05 Oct 2026, 10:15"
export function fmtStamp(iso) {
  const d = parse(iso);
  if (!d) return iso || "—";
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

// "Automatic schedule" → "Scheduled"; "Roberto Manalo" → "R. Manalo"
export function shortInitiator(name) {
  if (!name || String(name).toLowerCase() === "automatic schedule") {
    return "Scheduled";
  }
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : parts[0];
}

// Sync batch status → display word used in sync summaries.
export function syncStatusLabel(status) {
  if (status === "success") return "Successful";
  if (status === "failed") return "Failed";
  if (status === "partial") return "Partial";
  return status ? String(status) : "Unknown";
}
