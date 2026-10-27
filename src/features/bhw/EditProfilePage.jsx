import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { getSession, setSession } from "../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./EditProfile.css";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  sex: "",
  birthDate: "",
  address: "",
};

export default function EditProfilePage() {
  const refresh = useApiRefresh();

  // Prefill the form from GET /users/me — the server record is the only
  // source of truth for these fields.
  const {
    data: account,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me", (res) => res.user);

  const session = getSession();
  const role = account?.role || session?.role || "BHW";
  const isBhw = String(role).toLowerCase().includes("bhw");
  const ACCOUNT = {
    status: `${isBhw ? "BHW" : role} · ${account?.status ? account.status[0].toUpperCase() + account.status.slice(1) : "—"}`,
    staffId: account?.id ?? "—",
    barangay: "Barangay 354 Tayuman",
    designation: isBhw ? "Barangay Health Worker" : role,
  };

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Apply live account fields once they arrive (before any local edit).
  useEffect(() => {
    if (!account) return;
    setForm({
      firstName: account.firstName || "",
      lastName: account.lastName || "",
      phone: account.phone || "",
      sex: account.sex || "",
      birthDate: account.birthDate ? String(account.birthDate).slice(0, 10) : "",
      address: account.address || "",
    });
  }, [account]);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    const res = await sendApi("/users/me", form, "PUT");
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
    } else {
      setSession(res.data?.user);
      setNotice({ kind: "success", text: "Profile changes saved." });
      await refresh("/users/me");
    }
    setSaving(false);
  };

  if (isLoading && !account) {
    return <Loading label="Loading your profile…" />;
  }
  if (error && !account) {
    return (
      <ErrorState
        title="Could not load your profile"
        message={error}
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      {/* Back */}
      <Link to="/bhw/profile" className="ep-back">
        <ArrowLeft size={14} /> Profile &amp; settings
      </Link>

      {/* Header */}
      <div className="ep-header">
        <h1 className="ep-header__title">Edit profile</h1>
        <p className="ep-header__subtitle">
          Profile &amp; settings / Personal information
        </p>
      </div>

      {notice ? (
        <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
      ) : null}

      {/* ---------- LAYOUT ---------- */}
      <div className="ep-layout">
        {/* ============ LEFT: FORM ============ */}
        <form className="ep-panel" onSubmit={handleSubmit}>
          <h2 className="ep-panel__title">Personal details</h2>
          <p className="ep-panel__subtitle">
            Keep your contact information up to date.
          </p>

          {/* Name row */}
          <div className="ep-row">
            <div className="ep-field">
              <label className="ep-label">
                First name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="ep-input"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                required
              />
            </div>
            <div className="ep-field">
              <label className="ep-label">
                Last name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="ep-input"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Phone + sex row */}
          <div className="ep-row">
            <div className="ep-field">
              <label className="ep-label">
                Mobile number <span className="req">*</span>
              </label>
              <input
                type="text"
                className="ep-input"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
              />
            </div>
            <div className="ep-field">
              <label className="ep-label">Sex</label>
              <select
                className="ep-input"
                value={form.sex}
                onChange={(e) => update("sex", e.target.value)}
              >
                <option value="">Not set</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>

          {/* Birth date */}
          <div className="ep-field">
            <label className="ep-label">Birth date</label>
            <input
              type="date"
              className="ep-input"
              value={form.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="ep-field">
            <label className="ep-label">Address</label>
            <textarea
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
            <Link to="/bhw/profile" className="ep-btn ep-btn--outline">
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
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
