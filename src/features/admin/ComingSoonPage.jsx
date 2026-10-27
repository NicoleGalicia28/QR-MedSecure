import { Link, useLocation } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { getSession, homePathFor } from "../auth/authStore";

// 404 fallback inside the workspaces: an unknown URL shows a clear
// "page not found" with a way back, never a dead or unfinished screen.
export default function ComingSoonPage() {
  const { pathname } = useLocation();
  const home = homePathFor(getSession()) || "/login";

  return (
    <div
      style={{
        maxWidth: 560,
        background: "#ffffff",
        border: "1px dashed #d1d5db",
        borderRadius: 12,
        padding: "48px 24px",
        textAlign: "center",
        color: "#6b7280",
      }}
    >
      <FileQuestion size={28} strokeWidth={1.6} />
      <p
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#1a1a1a",
          margin: "12px 0 4px",
        }}
      >
        Page not found
      </p>
      <p style={{ fontSize: 12.5, margin: "0 0 16px" }}>
        <code>{pathname}</code> doesn't match any workspace page.
      </p>
      <Link
        to={home}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#2563eb",
          textDecoration: "none",
        }}
      >
        ← Back to my dashboard
      </Link>
    </div>
  );
}
