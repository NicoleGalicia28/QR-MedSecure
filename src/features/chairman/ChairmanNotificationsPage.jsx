import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Settings, CheckCircle2 } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDateTime } from "./format";
import "../admin/DashboardPage.css";
import "../bhw/Notifications.css";

const PREFS = [
  "In-app alerts",
  "System-wide stock & device alerts",
  "Synchronization & report updates",
  "Account & access decisions",
  "Barangay-wide announcements",
];

// Tag styling per live notification kind.
const KIND_TAGS = {
  stock: { tag: "+ Stock", tagClass: "nt-tag--open" },
  expiry: { tag: "+ Expiry", tagClass: "nt-tag--open" },
  device: { tag: "• Monitor", tagClass: "nt-tag--monitor" },
  account: { tag: "+ Account", tagClass: "nt-tag--update" },
  system: { tag: "+ Update", tagClass: "nt-tag--update" },
};

export default function ChairmanNotificationsPage() {
  const refresh = useApiRefresh();
  const [activeTab, setActiveTab] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [notice, setNotice] = useState(null);

  // Live notifications from /notifications.
  const {
    data: notifications,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/notifications", (res) => res.notifications);

  const ALL = (Array.isArray(notifications) ? notifications : []).map((n) => {
    const kind = KIND_TAGS[n.kind] || KIND_TAGS.system;
    return {
      id: n.id,
      title: n.title,
      meta: [n.body, n.at ? fmtDateTime(n.at) : ""].filter(Boolean).join(" · "),
      tag: kind.tag,
      tagClass: kind.tagClass,
      cat: n.kind || "system",
      read: n.read === true,
      to: `/chairman/notifications/${n.id}`,
    };
  });

  const unread = ALL.filter((n) => !n.read);
  const read = ALL.filter((n) => n.read);
  const unreadCount = unread.length;

  const TABS = [
    { key: "all", label: "All notifications", count: ALL.length },
    { key: "stock", label: "Stock alerts", count: ALL.filter((n) => n.cat === "stock" || n.cat === "expiry").length },
    { key: "device", label: "Device alerts", count: ALL.filter((n) => n.cat === "device").length },
    { key: "system", label: "System updates", count: ALL.filter((n) => n.cat === "system" || n.cat === "account").length },
    { key: "read", label: "Read", count: read.length },
  ];

  const filter = (list) => {
    if (activeTab === "all") return list;
    if (activeTab === "read") return list.filter((n) => n.read);
    if (activeTab === "stock") return list.filter((n) => n.cat === "stock" || n.cat === "expiry");
    if (activeTab === "system") return list.filter((n) => n.cat === "system" || n.cat === "account");
    return list.filter((n) => n.cat === activeTab);
  };

  const visibleUnread = filter(unread);
  const visibleRead = filter(read);

  const handleMarkRead = async (id) => {
    setBusyId(id);
    setNotice(null);
    const res = await sendApi(`/notifications/${id}/read`, {}, "POST");
    setBusyId(null);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    await refresh("/notifications");
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setNotice(null);
    const res = await sendApi("/notifications/read-all", {}, "POST");
    setMarkingAll(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setNotice({ kind: "success", text: "All notifications marked as read." });
    await refresh("/notifications");
  };

  const renderItem = (n) => (
    <div className="nt-item" key={n.id}>
      <div className="nt-item__left">
        <Link to={n.to} className="nt-item__title">
          {n.title}
        </Link>
        <p className="nt-item__meta">{n.meta}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span className={`nt-item__tag ${n.read ? "nt-tag--history" : n.tagClass}`}>
          {n.read ? "• Read" : n.tag}
        </span>
        {!n.read && (
          <button
            type="button"
            className="nt-header-btn"
            onClick={() => handleMarkRead(n.id)}
            disabled={busyId === n.id}
          >
            {busyId === n.id ? "Saving…" : "Mark read"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="nt-header">
        <div>
          <h1 className="nt-header__title">Notifications</h1>
          <p className="nt-header__subtitle">
            Alerts and updates across your Chairman workspace · {unreadCount}{" "}
            unread.
          </p>
        </div>
        <div className="nt-header__actions">
          <button
            type="button"
            className="nt-header-btn"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
          >
            <Check size={14} strokeWidth={2.5} />
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

      {isLoading ? (
        <Loading label="Loading notifications…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* ---------- TABS ---------- */}
          <div className="nt-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={"nt-tab" + (activeTab === t.key ? " nt-tab--active" : "")}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                <span className="nt-tab__count"> ({t.count})</span>
              </button>
            ))}
          </div>

          {/* ---------- LAYOUT ---------- */}
          <div className="nt-layout">
            {/* ============ LEFT ============ */}
            <div>
              {/* Unread notifications */}
              <div className="nt-panel">
                <h2 className="nt-section">Unread</h2>
                {visibleUnread.length > 0 ? (
                  visibleUnread.map(renderItem)
                ) : (
                  <div className="nt-empty">No unread notifications in this section.</div>
                )}
              </div>

              {/* Read updates */}
              <div className="nt-panel">
                <h2 className="nt-section">Earlier updates</h2>
                {visibleRead.length > 0 ? (
                  visibleRead.map(renderItem)
                ) : (
                  <div className="nt-empty">
                    {activeTab === "read"
                      ? "Nothing marked as read yet."
                      : "No notifications in this section."}
                  </div>
                )}
              </div>
            </div>

            {/* ============ RIGHT ============ */}
            <div>
              {/* Alert preferences */}
              <div className="nt-panel">
                <h2 className="nt-panel__title">Alert preferences</h2>
                <p className="nt-panel__subtitle">
                  Which alerts reach your Chairman workspace.
                </p>

                <div className="nt-prefs-list">
                  {PREFS.map((p) => (
                    <div key={p} className="nt-prefs-row">
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      {p}
                    </div>
                  ))}
                </div>

                <Link to="/chairman/profile/notifications" className="nt-manage-btn">
                  <Settings size={13} strokeWidth={2.5} />
                  Manage preferences
                </Link>
              </div>

              {/* Role-aware note */}
              <div className="nt-role-note">
                <strong>Role-aware notification scope</strong>
                Chairman sees all system-wide alerts. Secretary (Admin) sees urgent
                alerts, reports and account requests. BHW sees stock and device
                alerts for its assigned station.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="nt-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
