import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./NotificationPreferences.css";

// Toggle rows mapped onto the saved server preferences
// (GET/PUT /users/me/notification-preferences).
const CATEGORIES = [
  {
    key: "inApp",
    title: "In-app notifications",
    desc: "Alerts shown inside the application",
    locked: false,
  },
  {
    key: "email",
    title: "Email notifications",
    desc: "Delivered to your account email address",
    locked: false,
  },
  {
    key: "sms",
    title: "SMS notifications",
    desc: "Text messages for urgent alerts",
    locked: false,
  },
  {
    key: "lowStock",
    title: "Medicine stock alerts",
    desc: "Low balances and expiry reminders",
    locked: false,
  },
  {
    key: "expiry",
    title: "Expiry alerts",
    desc: "Medicines approaching their expiry date",
    locked: false,
  },
  {
    key: "device",
    title: "Machine monitoring",
    desc: "Refill, maintenance and device updates",
    locked: false,
  },
  {
    key: "reports",
    title: "Operational reports",
    desc: "Reports and summaries for your role",
    locked: false,
  },
];

const TABS = [
  { key: "profile", label: "My profile", to: "/bhw/profile" },
  { key: "security", label: "Security", to: "/bhw/profile/security" },
  { key: "notifications", label: "Notifications", to: "/bhw/profile/notifications" },
  { key: "access", label: "Workspace access", to: "/bhw/profile?tab=access" },
];

export default function NotificationPreferencesPage() {
  const refresh = useApiRefresh();

  // Saved preferences + account identity from the server.
  const {
    data: serverPrefs,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me/notification-preferences", (res) => res.preferences);
  const { data: account } = useEndpoint("/users/me", (res) => res.user);

  const user = {
    name: account?.name || "…",
    role: account?.role || "",
    email: account?.email || "—",
  };

  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  // Seed the local toggle state from the saved server copy.
  useEffect(() => {
    if (serverPrefs) setPrefs({ ...serverPrefs });
  }, [serverPrefs]);

  const toggle = (key) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving || !prefs) return;
    setSaving(true);
    setNotice(null);
    const res = await sendApi(
      "/users/me/notification-preferences",
      prefs,
      "PUT"
    );
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
    } else {
      setNotice({ kind: "success", text: "Notification preferences saved." });
      await refresh("/users/me/notification-preferences");
    }
    setSaving(false);
  };

  return (
    <>
      {/* Back */}
      <Link to="/bhw/profile" className="np-back">
        <ArrowLeft size={14} /> Profile &amp; settings
      </Link>

      {/* Header */}
      <div className="np-header">
        <h1 className="np-header__title">Notification preferences</h1>
        <p className="np-header__subtitle">
          Choose how you receive categories relevant to your assigned role.
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

      {isLoading && !prefs ? (
        <Loading label="Loading preferences…" />
      ) : error && !prefs ? (
        <ErrorState
          title="Could not load your preferences"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <form className="np-panel" onSubmit={handleSave}>
          <h2 className="np-panel__title">Alert delivery</h2>
          <p className="np-panel__subtitle">
            {user.name} · {user.role} · In-app and email channels
          </p>

          {notice ? (
            <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
          ) : null}

          {/* Matrix header */}
          <div className="np-matrix-header">
            <span className="np-matrix-header__label">Category</span>
            <span className="np-matrix-header__col">Enabled</span>
          </div>

          {/* Category rows */}
          {CATEGORIES.map((c) => (
            <div className="np-row" key={c.key}>
              <div className="np-row__left">
                <p className="np-row__title">{c.title}</p>
                <p className="np-row__desc">{c.desc}</p>
              </div>

              <div className="np-row__cell">
                <label className="np-toggle">
                  <input
                    type="checkbox"
                    checked={!!prefs?.[c.key]}
                    onChange={() => toggle(c.key)}
                    disabled={c.locked || saving}
                  />
                  <span className="np-toggle__track" />
                </label>
              </div>
            </div>
          ))}

          {/* Delivery email (account email, managed by the administrator) */}
          <div className="np-delivery" style={{ marginTop: 24 }}>
            <div className="np-field">
              <label className="np-label">Delivery email</label>
              <input
                type="email"
                className="np-input"
                value={user.email}
                disabled
              />
              <p className="np-row__desc" style={{ marginTop: 6 }}>
                Your account email · Contact the Secretary (Admin) to change it.
              </p>
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
              disabled={saving || !prefs}
            >
              {saving ? "Saving…" : "Save preferences"}
            </button>
            <Link to="/bhw/profile" className="np-btn np-btn--outline">
              Cancel · Profile &amp; settings
            </Link>
          </div>
        </form>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="np-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
