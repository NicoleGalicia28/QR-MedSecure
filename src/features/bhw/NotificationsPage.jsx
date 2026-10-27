import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Settings, CheckCircle2 } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./Notifications.css";

const PREF_LABELS = {
  inApp: "In-app alerts",
  lowStock: "Low stock alerts",
  expiry: "Expiry alerts",
  device: "Device & service alerts",
  reports: "Operational reports",
  email: "Email notifications",
  sms: "SMS notifications",
};

const TABS = [
  { key: "all", label: "All notifications" },
  { key: "dispensing", label: "Dispensing" },
  { key: "clinical", label: "Clinical" },
  { key: "prescription", label: "Prescription" },
  { key: "beneficiary", label: "Beneficiary" },
  { key: "system", label: "System" },
  { key: "read", label: "Read" },
];

function kindTag(kind) {
  if (kind === "dispensing") return { tag: "+ Dispensing", tagClass: "nt-tag--open" };
  if (kind === "clinical") return { tag: "+ Clinical", tagClass: "nt-tag--update" };
  if (kind === "prescription") return { tag: "+ Prescription", tagClass: "nt-tag--update" };
  if (kind === "beneficiary") return { tag: "+ Beneficiary", tagClass: "nt-tag--update" };
  if (kind === "stock") return { tag: "+ Stock", tagClass: "nt-tag--open" };
  if (kind === "device") return { tag: "• Monitor", tagClass: "nt-tag--monitor" };
  return { tag: "+ Update", tagClass: "nt-tag--update" };
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [notice, setNotice] = useState(null);
  const refresh = useApiRefresh();

  // Live, role-scoped feed from GET /notifications.
  const {
    data: notifications,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/notifications", (res) =>
    (res.notifications ?? []).map((n) => {
      const { tag, tagClass } = kindTag(n.kind);
      return {
        id: n.id,
        title: n.title,
        meta: [n.body, n.at ? fmtDateTime(n.at) : ""]
          .filter(Boolean)
          .join(" · "),
        read: n.read,
        kind: n.kind,
        tag,
        tagClass,
        to: `/bhw/notifications/${n.id}`,
      };
    })
  );

  // Enabled channels from the saved account preferences.
  const { data: prefs } = useEndpoint(
    "/users/me/notification-preferences",
    (res) => res.preferences
  );

  const list = notifications ?? [];
  const unreadList = list.filter((n) => !n.read);
  const readList = list.filter((n) => n.read);
  const counts = {
    all: list.length,
    stock: list.filter((n) => n.kind === "stock").length,
    device: list.filter((n) => n.kind === "device").length,
    dispensing: list.filter((n) => n.kind === "dispensing").length,
    clinical: list.filter((n) => n.kind === "clinical").length,
    prescription: list.filter((n) => n.kind === "prescription").length,
    beneficiary: list.filter((n) => n.kind === "beneficiary").length,
    system: list.filter((n) => n.kind === "system").length,
    read: readList.length,
  };
  const visible =
    activeTab === "all"
      ? list
      : activeTab === "read"
        ? readList
        : activeTab === "system"
          ? list.filter((n) => n.kind === "system")
          : list.filter((n) => n.kind === activeTab);
  const unread = unreadList.length;

  const handleMarkRead = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busyId) return;
    setBusyId(id);
    setNotice(null);
    const res = await sendApi(`/notifications/${id}/read`, {}, "POST");
    if (!res.ok) setNotice({ kind: "error", text: res.error });
    setBusyId(null);
    await refresh("/notifications");
  };

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    setNotice(null);
    const res = await sendApi("/notifications/read-all", {}, "POST");
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
    } else {
      setNotice({
        kind: "success",
        text: "All notifications marked as read.",
      });
    }
    setMarkingAll(false);
    await refresh("/notifications");
  };

  const renderItem = (n) => (
    <Link key={n.id} to={n.to} className="nt-item">
      <div className="nt-item__left">
        <p className="nt-item__title">{n.title}</p>
        <p className="nt-item__meta">{n.meta}</p>
      </div>
      {n.read ? (
        <span className={`nt-item__tag ${n.tagClass}`}>{n.tag}</span>
      ) : (
        <button
          type="button"
          className={`nt-item__tag nt-tag--history${busyId === n.id ? " nt-tag--system" : ""}`}
          style={{ cursor: "pointer", border: "none", font: "inherit" }}
          disabled={busyId === n.id}
          onClick={(e) => handleMarkRead(n.id, e)}
          title="Mark this notification as read"
        >
          {busyId === n.id ? "Saving…" : "Mark read"}
        </button>
      )}
    </Link>
  );

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="nt-header">
        <div>
          <h1 className="nt-header__title">Notifications</h1>
          <p className="nt-header__subtitle">
            Alerts and updates for your BHW workspace · {unread} unread.
          </p>
        </div>
        <div className="nt-header__actions">
          <button
            type="button"
            className="nt-header-btn"
            onClick={handleMarkAllRead}
            disabled={markingAll || unread === 0}
          >
            <Check size={14} strokeWidth={2.5} />
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>

      {notice ? (
        <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
      ) : null}

      {/* ---------- TABS ---------- */}
      <div className="nt-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={
              "nt-tab" + (activeTab === t.key ? " nt-tab--active" : "")
            }
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            <span className="nt-tab__count"> ({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* ---------- FIRST LOAD STATES ---------- */}
      {isLoading && !notifications ? (
        <Loading label="Loading notifications…" />
      ) : error && !notifications ? (
        <ErrorState
          title="Could not load notifications"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <>
          {/* ---------- LAYOUT ---------- */}
          <div className="nt-layout">
            {/* ============ LEFT ============ */}
            <div>
              {/* Unread notifications */}
              <div className="nt-panel">
                <h2 className="nt-section">Unread</h2>

                {visible.filter((n) => !n.read).length === 0 ? (
                  <EmptyState
                    title="No unread notifications"
                    message="New stock, device and system alerts appear here."
                    icon={CheckCircle2}
                  />
                ) : (
                  visible.filter((n) => !n.read).map(renderItem)
                )}
              </div>

              {/* Earlier updates */}
              <div className="nt-panel">
                <h2 className="nt-section">Earlier updates</h2>

                {visible.filter((n) => n.read).length === 0 ? (
                  <EmptyState
                    title="No read notifications yet"
                    message="Items move here once they are marked as read."
                    icon={CheckCircle2}
                  />
                ) : (
                  visible.filter((n) => n.read).map(renderItem)
                )}
              </div>
            </div>

            {/* ============ RIGHT ============ */}
            <div>
              {/* Alert preferences */}
              <div className="nt-panel">
                <h2 className="nt-panel__title">Alert preferences</h2>
                <p className="nt-panel__subtitle">
                  Which alerts reach your BHW workspace.
                </p>

                {prefs ? (
                  Object.keys(PREF_LABELS)
                    .filter((key) => prefs[key])
                    .map((key) => (
                      <div key={key} className="nt-prefs-row">
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                        {PREF_LABELS[key]}
                      </div>
                    ))
                ) : (
                  <p className="nt-item__meta">Loading preferences…</p>
                )}

                <Link to="/bhw/profile/notifications" className="nt-manage-btn">
                  <Settings size={13} strokeWidth={2.5} />
                  Manage preferences
                </Link>
              </div>

              {/* Role-aware note */}
              <div className="nt-role-note">
                <strong>Role-aware notification scope</strong>
                BHW sees stock and device alerts. Secretary (Admin) sees urgent
                alerts and reports. Chairman sees all system-wide alerts.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="nt-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
