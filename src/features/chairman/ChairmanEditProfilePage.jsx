import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { setSession } from "../auth/authStore";
import { useEndpoint, sendApi } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "../bhw/EditProfile.css";

/* The form is prefilled from the live /users/me record. Only the fields the
   backend accepts (firstName, lastName, phone, sex, birthDate, address) are
   editable; email is read-only. */

const titleCase = (s) =>
  s ? String(s)[0].toUpperCase() + String(s).slice(1) : "";

const SEX_OPTIONS = ["Male", "Female", "Other"];

export default function ChairmanEditProfilePage() {
  // Live account record — the only source of the form's prefill.
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me", (res) => res.user);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    sex: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Apply the live account once it arrives, without clobbering later edits.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!user || prefilled.current) return;
    prefilled.current = true;
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      sex: titleCase(user.sex || ""),
      address: user.address || "",
    });
  }, [user]);

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
        phone: form.phone.trim(),
        sex: form.sex,
        address: form.address,
      },
      "PUT",
    );
    setSaving(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    // Keep the cached session name/email in step with the server.
    setSession(res.data.user);
    setNotice({ kind: "success", text: "Profile updated successfully." });
  };

  const role = user?.role || "Chairman";
  const isChairman = String(role).toLowerCase().includes("chairman");
  const ACCOUNT = {
    status: `${isChairman ? "Chairman" : role} · ${
      titleCase(user?.status) || "Active"
    }`,
    staffId: user?.id ?? "—",
    barangay: "Barangay 354 Tayuman",
    designation: isChairman ? "Barangay Chairman" : role,
  };

  return (
    <>
      {/* Back */}
      <Link to="/chairman/profile" className="ep-back">
        <ArrowLeft size={14} /> Profile &amp; settings
      </Link>

      {/* Header */}
      <div className="ep-header">
        <h1 className="ep-header__title">Edit profile</h1>
        <p className="ep-header__subtitle">
          Profile &amp; settings / Personal information
        </p>
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

      {isLoading ? (
        <Loading label="Loading profile…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !user ? (
        <ErrorState
          title="Profile unavailable"
          message="No profile details were returned for this account."
          onRetry={refetch}
        />
      ) : (
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

            {/* Phone row */}
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
                  <option value="">Not specified</option>
                  {SEX_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="ep-field">
              <label className="ep-label">Email address</label>
              <input
                type="email"
                className="ep-input"
                value={user.email || ""}
                readOnly
              />
              <p className="ep-hint">
                Email address can't be changed here. Contact the Secretary
                (Admin) to request an update.
              </p>
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
              <Link to="/chairman/profile" className="ep-btn ep-btn--outline">
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
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ep-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
