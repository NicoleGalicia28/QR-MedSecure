import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEndpoint, sendApi } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "../bhw/NotificationPreferences.css";

/* Toggles are loaded from /users/me/notification-preferences and saved back
   to the same endpoint. The full matrix is stored under the `categories`
   key; legacy per-kind flags are mapped in when no saved matrix exists. */

// Category rows for the toggle matrix.
const CATEGORIES = [
  {
    key: "medicineStock",
    title: "Medicine stock alerts",
    desc: "Low balances and expiry reminders",
  },
  {
    key: "machineMonitoring",
    title: "Machine monitoring",
    desc: "Refill, maintenance and device updates",
  },
  {
    key: "dispensing",
    title: "Dispensing updates",
    desc: "Receipt and operational transaction notices",
  },
  {
    key: "synchronization",
    title: "Synchronization",
    desc: "Batch status and failed updates",
  },
  {
    key: "barangay",
    title: "Barangay updates",
    desc: "Allocations and health center announcements",
  },
  {
    key: "accountSecurity",
    title: "Account security",
    desc: "Password changes and access decisions",
    locked: true, // cannot be disabled
  },
];

const TABS = [
  { key: "profile", label: "My profile", to: "/chairman/profile" },
  { key: "security", label: "Security", to: "/chairman/profile/security" },
  { key: "notifications", label: "Notifications", to: "/chairman/profile/notifications" },
  { key: "access", label: "Workspace access", to: "/chairman/profile?tab=access" },
];

const EMAIL_DIGEST_OPTIONS = [
  "Daily at 17:00 · Urgent alerts immediately",
  "Daily at 08:00",
  "Weekly summary only",
  "Never (in-app only)",
];

// Legacy server preference flag → category it gates (both channels follow it).
const KIND_FLAG = {
  medicineStock: (p) => p.lowStock !== false && p.expiry !== false,
  machineMonitoring: (p) => p.device !== false,
};

// Build the toggle matrix from the stored preferences.
function matrixFromPrefs(p) {
  return CATEGORIES.reduce((acc, c) => {
    const saved = p?.categories?.[c.key];
    let inApp;
    let email;
    if (saved && typeof saved === "object") {
      inApp = saved.inApp !== false;
      email = saved.email !== false;
    } else {
      const flag = KIND_FLAG[c.key] ? KIND_FLAG[c.key](p || {}) : true;
      inApp = p?.inApp !== false && flag !== false;
      email = p?.email !== false && flag !== false;
    }
    if (c.locked) {
      inApp = true;
      email = true;
    }
    acc[c.key] = { inApp, email };
    return acc;
  }, {});
}

export default function ChairmanNotificationPreferencesPage() {
  // Live account for the header line + delivery email default.
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useEndpoint("/users/me", (res) => res.user);

  // Live preferences from /users/me/notification-preferences.
  const {
    data: serverPrefs,
    isLoading: prefsLoading,
    error: prefsError,
    refetch: refetchPrefs,
  } = useEndpoint(
    "/users/me/notification-preferences",
    (res) => res.preferences,
  );

  const [draft, setDraft] = useState(null);
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [emailDigest, setEmailDigest] = useState(EMAIL_DIGEST_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Apply the live preferences once, without clobbering edits made here.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!user || !serverPrefs || prefilled.current) return;
    prefilled.current = true;
    setDraft(matrixFromPrefs(serverPrefs));
    setDeliveryEmail(serverPrefs.deliveryEmail || user.email || "");
    setEmailDigest(
      EMAIL_DIGEST_OPTIONS.includes(serverPrefs.emailDigest)
        ? serverPrefs.emailDigest
        : EMAIL_DIGEST_OPTIONS[0],
    );
  }, [user, serverPrefs]);

  const toggle = (key, channel) => {
    setDraft((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    const res = await sendApi(
      "/users/me/notification-preferences",
      {
        categories: draft,
        deliveryEmail,
        emailDigest,
        inApp: Object.values(draft).some((c) => c.inApp),
        email: Object.values(draft).some((c) => c.email),
      },
      "PUT",
    );
    setSaving(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    await refetchPrefs();
    setNotice({ kind: "success", text: "Notification preferences saved." });
  };

  const loading = userLoading || prefsLoading;
  const error = userError || prefsError;
  const retryAll = () => {
    refetchUser();
    refetchPrefs();
  };

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.name ||
      "Chairman"
    : "Chairman";
  const userRole = user?.role || "Chairman";

  return (
    <>
      {/* Back */}
      <Link to="/chairman/profile" className="np-back">
        <ArrowLeft size={14} /> Profile &amp; settings
      </Link>

      {/* Header */}
      <div className="np-header">
        <h1 className="np-header__title">Notification preferences</h1>
        <p className="np-header__subtitle">
          Choose how you receive categories relevant to your Chairman oversight
          role.
        </p>
      </div>

      {/* Tabs */}
      <div className="np-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.to}
            className={
              "np-tab" +
              (t.key === "notifications" ? " np-tab--active" : "")
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

      {error ? (
        <ErrorState message={error} onRetry={retryAll} />
      ) : loading || !draft ? (
        <Loading label="Loading notification preferences…" />
      ) : (
        /* ---------- MAIN FORM ---------- */
        <form className="np-panel" onSubmit={handleSave}>
          <h2 className="np-panel__title">Alert delivery</h2>
          <p className="np-panel__subtitle">
            {userName} · {userRole} · In-app and email channels
          </p>

          {/* Matrix header */}
          <div className="np-matrix-header">
            <span className="np-matrix-header__label">Category</span>
            <span className="np-matrix-header__col">In-app</span>
            <span className="np-matrix-header__col">Email</span>
          </div>

          {/* Category rows */}
          {CATEGORIES.map((c) => (
            <div className="np-row" key={c.key}>
              <div className="np-row__left">
                <p className="np-row__title">{c.title}</p>
                <p className="np-row__desc">{c.desc}</p>
              </div>

              {/* In-app toggle */}
              <div className="np-row__cell">
                <label className="np-toggle">
                  <input
                    type="checkbox"
                    checked={draft[c.key].inApp}
                    onChange={() => toggle(c.key, "inApp")}
                    disabled={c.locked || saving}
                  />
                  <span className="np-toggle__track" />
                </label>
              </div>

              {/* Email toggle */}
              <div className="np-row__cell">
                <label className="np-toggle">
                  <input
                    type="checkbox"
                    checked={draft[c.key].email}
                    onChange={() => toggle(c.key, "email")}
                    disabled={c.locked || saving}
                  />
                  <span className="np-toggle__track" />
                </label>
              </div>
            </div>
          ))}

          {/* Delivery + digest row */}
          <div className="np-delivery" style={{ marginTop: 24 }}>
            <div className="np-field">
              <label className="np-label">Delivery email</label>
              <input
                type="email"
                className="np-input"
                value={deliveryEmail}
                onChange={(e) => setDeliveryEmail(e.target.value)}
              />
            </div>

            <div className="np-field">
              <label className="np-label">Email digest</label>
              <select
                className="np-select"
                value={emailDigest}
                onChange={(e) => setEmailDigest(e.target.value)}
              >
                {EMAIL_DIGEST_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Info box */}
          <div className="np-info">
            <strong>Essential account notices</strong>
            Access decisions and critical security notices remain enabled. Email
            messages omit confidential beneficiary details.
          </div>

          {/* Actions */}
          <div className="np-actions">
            <button
              type="submit"
              className="np-btn np-btn--primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save preferences"}
            </button>
            <Link to="/chairman/profile" className="np-btn np-btn--outline">
              Cancel · Profile &amp; settings
            </Link>
          </div>
        </form>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="np-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
