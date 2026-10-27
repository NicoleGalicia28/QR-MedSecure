import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getSession } from "../../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../../lib/ui";
import "../DashboardPage.css";
import "./NotificationPreferences.css";

/* Preferences come from `GET /users/me/notification-preferences`, which exposes
   a flat flag set (inApp, email, sms, lowStock, expiry, device, reports).
   The matrix below maps those flags onto per-category rows, and the saved
   matrix is written back alongside them (the server merges the body into the
   stored preference JSON) so every toggle round-trips exactly. */

// Category rows for the toggle matrix
const CATEGORIES = [
  {
    key: "medicineStock",
    title: "Medicine stock alerts",
    desc: "Low balances and expiry reminders",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    key: "machineMonitoring",
    title: "Machine monitoring",
    desc: "Refill, maintenance and device updates",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    key: "dispensing",
    title: "Dispensing updates",
    desc: "Receipt and operational transaction notices",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    key: "synchronization",
    title: "Synchronization",
    desc: "Batch status and failed updates",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    key: "barangay",
    title: "Barangay updates",
    desc: "Allocations and health center announcements",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    key: "accountSecurity",
    title: "Account security",
    desc: "Password changes and access decisions",
    defaultInApp: true,
    defaultEmail: true,
    locked: true, // cannot be disabled
  },
];

const TABS = [
  { key: "profile", label: "My profile", to: "/admin/profile" },
  { key: "security", label: "Security", to: "/admin/profile/security" },
  { key: "notifications", label: "Notifications", to: "/admin/profile/notifications" },
  { key: "access", label: "Workspace access", to: "/admin/profile?tab=access" },
];

const EMAIL_DIGEST_OPTIONS = [
  "Daily at 17:00 · Urgent alerts immediately",
  "Daily at 08:00",
  "Weekly summary only",
  "Never (in-app only)",
];

// The server stores one flat flag set; map it onto the per-category matrix.
// A saved matrix (written by this page) wins when it is present.
function selectPrefs(raw) {
  const p = raw?.preferences;
  if (!p || typeof p !== "object") return null;
  const on = (v) => v !== false;

  if (p.matrix && typeof p.matrix === "object") {
    const categories = {};
    CATEGORIES.forEach((c) => {
      const cell = p.matrix[c.key];
      categories[c.key] = c.locked
        ? { inApp: true, email: true }
        : { inApp: on(cell?.inApp), email: on(cell?.email) };
    });
    return {
      categories,
      emailDigest: EMAIL_DIGEST_OPTIONS.includes(p.emailDigest)
        ? p.emailDigest
        : EMAIL_DIGEST_OPTIONS[0],
    };
  }

  const on2 = (inApp, email, flag) => ({
    inApp: on(inApp) && on(flag),
    email: on(email) && on(flag),
  });
  return {
    categories: {
      medicineStock: on2(p.inApp, p.email, p.lowStock),
      machineMonitoring: on2(p.inApp, p.email, p.device),
      dispensing: on2(p.inApp, p.email, true),
      synchronization: on2(p.inApp, p.email, true),
      barangay: on2(p.inApp, p.email, p.reports),
      // Account security is locked on in both channels.
      accountSecurity: { inApp: true, email: true },
    },
    emailDigest: EMAIL_DIGEST_OPTIONS.includes(p.emailDigest)
      ? p.emailDigest
      : EMAIL_DIGEST_OPTIONS[0],
  };
}

// Flatten the matrix back onto the server's documented flags, plus the matrix
// itself so the exact per-category/per-channel state round-trips.
function toServerBody(categories, emailDigest) {
  const catOn = (key) =>
    Boolean(categories[key]?.inApp || categories[key]?.email);
  return {
    inApp: CATEGORIES.some((c) => categories[c.key]?.inApp),
    email: CATEGORIES.some((c) => categories[c.key]?.email),
    lowStock: catOn("medicineStock"),
    expiry: catOn("medicineStock"),
    device: catOn("machineMonitoring"),
    reports: catOn("barangay"),
    matrix: categories,
    emailDigest,
  };
}

export default function NotificationPreferencesPage() {
  const refresh = useApiRefresh();

  // Account identity used in the header line.
  const { data: me } = useEndpoint("/users/me", (raw) => raw?.user ?? null);
  const session = getSession();
  const user = {
    name: me
      ? [me.firstName, me.lastName].filter(Boolean).join(" ")
      : session
        ? `${session.firstName} ${session.lastName}`
        : "—",
    role: me?.role || session?.role || "—",
    email: me?.email || session?.email || "",
  };

  // Live preferences from the server.
  const {
    data: loaded,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me/notification-preferences", selectPrefs);

  // Local edits win over the loaded copy once the user toggles anything.
  const [draft, setDraft] = useState(null);
  const state = draft ?? loaded;
  const prefs = state?.categories;
  const emailDigest = state?.emailDigest ?? EMAIL_DIGEST_OPTIONS[0];

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const toggle = (key, channel) => {
    setNotice(null);
    setDraft((prev) => {
      const base = prev ?? loaded;
      if (!base) return prev;
      return {
        ...base,
        categories: {
          ...base.categories,
          [key]: { ...base.categories[key], [channel]: !base.categories[key]?.[channel] },
        },
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!prefs) return;
    setSaving(true);
    setNotice(null);
    const res = await sendApi(
      "/users/me/notification-preferences",
      toServerBody(prefs, emailDigest),
      "PUT"
    );
    setSaving(false);
    if (res.ok) {
      setDraft(null);
      refresh("/users/me/notification-preferences");
      setNotice({ kind: "success", message: "Notification preferences saved." });
    } else {
      setNotice({
        kind: "error",
        message: res.error || "Could not save your preferences.",
      });
    }
  };

  let channelLabel = "No channels enabled";
  if (prefs) {
    const hasInApp = CATEGORIES.some((c) => prefs[c.key]?.inApp);
    const hasEmail = CATEGORIES.some((c) => prefs[c.key]?.email);
    channelLabel =
      hasInApp && hasEmail
        ? "In-app and email channels"
        : hasInApp
          ? "In-app channels only"
          : hasEmail
            ? "Email channels only"
            : "No channels enabled";
  }

  if (isLoading && !loaded) return <Loading label="Loading preferences…" />;

  if (error && !loaded) {
    return (
      <ErrorState
        title="Could not load your preferences"
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!prefs) {
    return (
      <EmptyState
        title="Preferences unavailable"
        message="No preference record was returned for this account."
        action={
          <button type="button" className="np-btn np-btn--outline" onClick={refetch}>
            Try again
          </button>
        }
      />
    );
  }

  return (
    <>
      {/* Back */}
      <Link to="/admin/profile" className="np-back">
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

      {/* ---------- MAIN FORM ---------- */}
      <form className="np-panel" onSubmit={handleSave}>
        <h2 className="np-panel__title">Alert delivery</h2>
        <p className="np-panel__subtitle">
          {user.name} · {user.role} · {channelLabel}
        </p>

        {notice && (
          <div style={{ marginBottom: "0.75rem" }}>
            <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>
          </div>
        )}

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
                  checked={Boolean(prefs[c.key]?.inApp)}
                  onChange={() => toggle(c.key, "inApp")}
                  disabled={c.locked}
                />
                <span className="np-toggle__track" />
              </label>
            </div>

            {/* Email toggle */}
            <div className="np-row__cell">
              <label className="np-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(prefs[c.key]?.email)}
                  onChange={() => toggle(c.key, "email")}
                  disabled={c.locked}
                />
                <span className="np-toggle__track" />
              </label>
            </div>
          </div>
        ))}

        {/* Delivery + digest row */}
        <div className="np-delivery" style={{ marginTop: 24 }}>
          <div className="np-field">
            <label className="np-label" htmlFor="np-delivery-email">
              Delivery email
            </label>
            <input
              id="np-delivery-email"
              type="email"
              className="np-input"
              value={user.email}
              readOnly
              title="Alerts are delivered to your account sign-in email."
            />
          </div>

          <div className="np-field">
            <label className="np-label" htmlFor="np-digest">
              Email digest
            </label>
            <select
              id="np-digest"
              className="np-select"
              value={emailDigest}
              onChange={(e) => {
                setNotice(null);
                setDraft((prev) => ({
                  categories: (prev ?? loaded).categories,
                  emailDigest: e.target.value,
                }));
              }}
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
          <Link to="/admin/profile" className="np-btn np-btn--outline">
            Cancel · Profile &amp; settings
          </Link>
        </div>
      </form>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="np-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
