import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { getSession, setSession } from "../../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../../lib/ui";
import "../DashboardPage.css";
import "./EditProfile.css";

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r.includes("bhw")) return "Barangay Health Worker";
  if (r.includes("chairman")) return "Barangay Chairman";
  if (r.includes("secretary") || r.includes("admin")) return "Secretary (Admin)";
  if (!r) return "—";
  return String(role).charAt(0).toUpperCase() + String(role).slice(1);
}

function cap(value) {
  return value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : "";
}

export default function EditProfilePage() {
  const refresh = useApiRefresh();

  // Live `GET /users/me` payload, seeded into the form once it answers.
  const {
    data: me,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me", (raw) => raw?.user ?? null);

  const session = getSession();
  const ACCOUNT = {
    status: me?.status
      ? `${roleLabel(me?.role)} · ${cap(me.status)}`
      : roleLabel(me?.role || session?.role),
    staffId: me?.id || session?.id || "—",
    barangay: "Barangay 354 Tayuman",
    designation: roleLabel(me?.role || session?.role),
  };

  const [form, setForm] = useState({
    firstName: session?.firstName || "",
    lastName: session?.lastName || "",
    mobile: "",
    alternate: "",
    email: session?.email || "",
    address: "",
  });

  // Overlay the server profile once, before the user starts editing.
  const seeded = useRef(false);
  useEffect(() => {
    if (!me || seeded.current) return;
    seeded.current = true;
    setForm({
      firstName: me.firstName || "",
      lastName: me.lastName || "",
      mobile: me.phone || "",
      alternate: "",
      email: me.email || "",
      address: me.address || "",
    });
  }, [me]);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    const res = await sendApi(
      "/users/me",
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.mobile.trim(),
        address: form.address,
      },
      "PUT"
    );
    setSaving(false);
    if (res.ok) {
      setSession(res.data?.user);
      refresh("/users/me");
      setNotice({ kind: "success", message: "Profile changes saved." });
    } else {
      setNotice({
        kind: "error",
        message: res.error || "Could not save your profile changes.",
      });
    }
  };

  if (isLoading && !me) return <Loading label="Loading profile…" />;

  if (error && !me) {
    return (
      <ErrorState
        title="Could not load your profile"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!me) {
    return (
      <EmptyState
        title="Profile unavailable"
        message="No account record was returned for this session."
        action={
          <Link to="/admin/profile" className="ep-btn ep-btn--outline">
            Back to profile
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Back */}
      <Link to="/admin/profile" className="ep-back">
        <ArrowLeft size={14} /> Profile &amp; settings
      </Link>

      {/* Header */}
      <div className="ep-header">
        <h1 className="ep-header__title">Edit profile</h1>
        <p className="ep-header__subtitle">
          Profile &amp; settings / Personal information
        </p>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="ep-layout">
        {/* ============ LEFT: FORM ============ */}
        <form className="ep-panel" onSubmit={handleSubmit}>
          <h2 className="ep-panel__title">Personal details</h2>
          <p className="ep-panel__subtitle">
            Keep your contact information up to date.
          </p>

          {notice && (
            <div style={{ marginBottom: "0.75rem" }}>
              <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>
            </div>
          )}

          {/* Name row */}
          <div className="ep-row">
            <div className="ep-field">
              <label className="ep-label" htmlFor="ep-first">
                First name <span className="req">*</span>
              </label>
              <input
                id="ep-first"
                type="text"
                className="ep-input"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                required
              />
            </div>
            <div className="ep-field">
              <label className="ep-label" htmlFor="ep-last">
                Last name <span className="req">*</span>
              </label>
              <input
                id="ep-last"
                type="text"
                className="ep-input"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Phone row */}
          <div className="ep-row">
            <div className="ep-field">
              <label className="ep-label" htmlFor="ep-mobile">
                Mobile number <span className="req">*</span>
              </label>
              <input
                id="ep-mobile"
                type="text"
                className="ep-input"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                required
              />
            </div>
            <div className="ep-field">
              <label className="ep-label" htmlFor="ep-alt">
                Alternate number
              </label>
              <input
                id="ep-alt"
                type="text"
                className="ep-input"
                value={form.alternate}
                readOnly
                title="Alternate numbers are recorded on your staff record, not editable here."
              />
              <p className="ep-hint">
                Ask the Secretary (Admin) to record an alternate number.
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="ep-field">
            <label className="ep-label" htmlFor="ep-email">
              Email address <span className="req">*</span>
            </label>
            <input
              id="ep-email"
              type="email"
              className="ep-input"
              value={form.email}
              readOnly
            />
            <p className="ep-hint">
              Your sign-in email is managed by the Secretary (Admin).
            </p>
          </div>

          {/* Address */}
          <div className="ep-field">
            <label className="ep-label" htmlFor="ep-address">Address</label>
            <textarea
              id="ep-address"
              className="ep-textarea"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="ep-actions">
            <button
              type="submit"
              className="ep-btn ep-btn--primary"
              disabled={saving}
            >
              <Save size={14} strokeWidth={2.5} />
              {saving ? "Saving…" : "Save profile changes"}
            </button>
            <Link to="/admin/profile" className="ep-btn ep-btn--outline">
              Cancel
            </Link>
          </div>
        </form>

        {/* ============ RIGHT: ASSIGNED ACCOUNT ============ */}
        <div>
          <div className="ep-panel">
            <h2 className="ep-panel__title">Assigned account</h2>

            <span className="ep-acct-status">• {ACCOUNT.status}</span>

            <div className="ep-acct-row">
              <p className="ep-acct__label">Staff ID</p>
              <p className="ep-acct__value">{ACCOUNT.staffId}</p>
            </div>

            <div className="ep-acct-row">
              <p className="ep-acct__label">Barangay</p>
              <p className="ep-acct__value">{ACCOUNT.barangay}</p>
            </div>

            <div className="ep-acct-row">
              <p className="ep-acct__label">Designation</p>
              <p className="ep-acct__value">{ACCOUNT.designation}</p>
            </div>

            <p className="ep-acct-note">
              Role, staff ID and barangay assignment are read-only here.
              Contact the Secretary (Admin) to request a change.
            </p>
          </div>

          {/* Privacy note */}
          <div className="ep-privacy">
            <strong>Your information stays private.</strong>
            Contact details are visible only to authorized Secretary (Admin)
            staff and your assigned workspace.
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ep-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
