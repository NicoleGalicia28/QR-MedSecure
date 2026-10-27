import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Info, Mail, Copy, Check } from "lucide-react";
import { sendApi, useApiRefresh } from "../../lib/useApi";
import { InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./InviteStaff.css";

const TABS = [
  { key: "invite", label: "Invite staff", path: "/admin/users/invite" },
  { key: "manage", label: "Manage access", path: "/admin/users/manage-access" },
  { key: "roles", label: "Role permissions", path: "/admin/users/role-permissions" },
  { key: "audit", label: "Access audit", path: "/admin/users/access-audit" },
];

const ROLES = [
  { name: "BHW", scope: "Inventory, clinical history, dispensing and medicine updates" },
  { name: "Chairman", scope: "Aggregate reports, synchronization and oversight alerts" },
  { name: "Secretary (Admin)", scope: "Registry, medical history, IDs, reports and user administration" },
];

export default function InviteStaffPage() {
  const [form, setForm] = useState({ name: "", email: "", role: "BHW" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const refresh = useApiRefresh();

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleInvite = async (e) => {
    e.preventDefault();
    setError("");
    setCopied(false);
    setSubmitting(true);
    try {
      const res = await sendApi("/admin/users/invite", {
        name: form.name,
        email: form.email,
        role: form.role,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInvite(res.data);
      setForm({ name: "", email: "", role: "BHW" });
      await refresh("/admin/users");
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!invite?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(invite.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      {/* Back */}
      <Link to="/admin/users" className="is-back">
        <ArrowLeft size={14} /> User &amp; role management
      </Link>

      {/* Header */}
      <div className="is-header">
        <h1 className="is-header__title">Invite staff &amp; manage access</h1>
        <p className="is-header__subtitle">
          Secretary (Admin) · Assign one role per staff account within Barangay
          354 Tayuman, Manila.
        </p>
      </div>

      {/* Tabs */}
      <div className="is-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.path}
            className={"is-tab" + (t.key === "invite" ? " is-tab--active" : "")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="is-layout">
        {/* ============ LEFT ============ */}
        <div>
          {/* --- STAFF INVITATION --- */}
          <form className="is-panel" onSubmit={handleInvite}>
            <h2 className="is-panel__title">Staff invitation</h2>
            <p className="is-panel__subtitle">
              Creates an active account with a one-time temporary password.
            </p>

            {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}

            {/* Full name + Email */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <div className="is-field" style={{ marginBottom: 0 }}>
                <label className="is-label">
                  Full name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="is-input"
                  placeholder="Carla Navarro"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div className="is-field" style={{ marginBottom: 0 }}>
                <label className="is-label">
                  Email address <span className="req">*</span>
                </label>
                <input
                  type="email"
                  className="is-input"
                  placeholder="carla.navarro@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div className="is-field" style={{ marginTop: 16 }}>
              <label className="is-label">
                Selected role <span className="req">*</span>
              </label>
              <select
                className="is-select"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                required
              >
                {ROLES.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role scope table */}
            <table className="is-roletable">
              <thead>
                <tr>
                  <th>Role option</th>
                  <th>Scope</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r.name}>
                    <td className="is-roletable__role">{r.name}</td>
                    <td className="is-roletable__scope">{r.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="is-roletable__footer">
              <span>Showing {ROLES.length} roles</span>
            </div>

            {/* Helper */}
            <div className="is-helper">
              <Info size={14} />
              <span>
                Appointment required; permissions limited to the assigned role.
              </span>
            </div>

            {/* Actions */}
            <div className="is-actions">
              <button
                type="submit"
                className="is-btn is-btn--primary"
                disabled={submitting}
              >
                <Mail size={14} strokeWidth={2.5} />
                {submitting ? "Sending…" : "Send staff invitation"}
              </button>
              <Link to="/admin/users" className="is-btn is-btn--outline">
                Cancel · Staff directory
              </Link>
            </div>
          </form>
        </div>

        {/* ============ RIGHT ============ */}
        <div>
          {/* One-time temporary password */}
          {invite ? (
            <div className="is-panel" style={{ borderColor: "#86efac", background: "#f0fdf4" }}>
              <h2 className="is-panel__title">Account created</h2>
              <p className="is-panel__subtitle">
                Share this temporary password with {invite.user?.email} now.
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  fontFamily: "monospace",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#065f46",
                  background: "#ffffff",
                  border: "1px solid #86efac",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 12,
                  wordBreak: "break-all",
                }}
              >
                <span>{invite.tempPassword}</span>
                <button
                  type="button"
                  className="is-btn is-btn--outline"
                  onClick={copyPassword}
                  style={{ flexShrink: 0 }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="is-warning">
                <strong>Shown only once</strong>
                This password is not stored or shown again. The staff member
                should change it after their first sign-in.
              </div>

              <div className="is-actions">
                <Link to="/admin/users" className="is-btn is-btn--primary">
                  View staff directory
                </Link>
              </div>
            </div>
          ) : null}

          {/* Info boxes */}
          <div className="is-info">
            <strong>Three distinct roles</strong>
            Secretary (Admin) is a single role, not separate Secretary and Admin
            accounts. Only Secretary (Admin) performs staff approvals.
          </div>

          <div className="is-info">
            <strong>Prescriber boundary</strong>
            None of these staff roles author prescriptions. Clinical
            authorization remains with the prescribing clinician.
          </div>

          <div style={{ marginTop: 16 }}>
            <Link to="/admin/users" className="is-side-btn is-side-btn--outline">
              Return to staff directory
            </Link>
          </div>
        </div>
      </div>

      {/* Page footer */}
      <div className="is-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
