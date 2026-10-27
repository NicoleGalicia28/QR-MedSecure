import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Filter,
  AlertTriangle,
  Package,
  CalendarClock,
  FileText,
  RefreshCw,
  Inbox,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../../lib/useApi";
import { Loading, ErrorState, InlineNotice, EmptyState } from "../../../lib/ui";
import "../../bhw/Notifications.css";
import "../DashboardPage.css";

const KIND_ICONS = {
  stock: Package,
  low_stock: Package,
  expiry: CalendarClock,
  device: AlertTriangle,
  reports: FileText,
  report: FileText,
  sync: RefreshCw,
  account: FileText,
};

// The seed links point at the BHW workspace; shown as context text here so
// the row never bounces an admin across route guards.
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindTag(kind) {
  if (kind === "stock" || kind === "low_stock") return { tag: "+ Stock", tagClass: "nt-tag--open" };
  if (kind === "device") return { tag: "• Monitor", tagClass: "nt-tag--monitor" };
  return { tag: "+ Update", tagClass: "nt-tag--update" };
}

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
  { key: "stock", label: "Stock alerts" },
  { key: "device", label: "Device alerts" },
  { key: "system", label: "System updates" },
  { key: "read", label: "Read" },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const refresh = useApiRefresh();
  const [activeTab, setActiveTab] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [notice, setNotice] = useState(null);

  const {
    data: notificationsRaw,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/notifications", (res) =>
    (res.notifications ?? []).map((n) => {
      const { tag, tagClass } = kindTag(n.kind);
      return {
        id: n.id,
        title: n.title,
        meta: [n.body, n.at ? fmtDateTime(n.at) : ""].filter(Boolean).join(" · "),
        read: n.read,
        kind: n.kind,
        tag,
        tagClass,
        to: `/admin/notifications/${n.id}`,
      };
    })
  );

  const { data: prefs } = useEndpoint("/users/me/notification-preferences", (res) => res.preferences);

  const list = notificationsRaw ?? [];
  const unreadList = list.filter((n) => !n.read);
  const readList = list.filter((n) => n.read);
  const counts = {
    all: list.length,
    stock: list.filter((n) => n.kind === "stock" || n.kind === "low_stock").length,
    device: list.filter((n) => n.kind === "device").length,
    system: list.filter((n) => n.kind !== "stock" && n.kind !== "low_stock" && n.kind !== "device").length,
    read: readList.length,
  };
  const visible =
    activeTab === "all"
      ? list
      : activeTab === "read"
        ? readList
        : activeTab === "system"
          ? list.filter((n) => n.kind !== "stock" && n.kind !== "low_stock" && n.kind !== "device")
          : list.filter((n) => n.kind === activeTab || (activeTab === "stock" && n.kind === "low_stock"));
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
      setNotice({ kind: "success", text: "All notifications marked as read." });
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
      <div className="nt-header">
        <div>
          <h1 className="nt-header__title">Notifications</h1>
          <p className="nt-header__subtitle">
            Alerts and updates for the Secretary (Admin) workspace · {unread} unread.
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

      {notice ? <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice> : null}

      <div className="nt-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"nt-tab" + (activeTab === t.key ? " nt-tab--active" : "")}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            <span className="nt-tab__count"> ({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      {isLoading && !notificationsRaw ? (
        <Loading label="Loading notifications…" />
      ) : error && !notificationsRaw ? (
        <ErrorState title="Could not load notifications" message={error} onRetry={refetch} />
      ) : (
        <>
          <div className="nt-layout">
            <div>
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
            <div>
              <div className="nt-panel">
                <h2 className="nt-panel__title">Alert preferences</h2>
                <p className="nt-panel__subtitle">Which alerts reach your workspace.</p>
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
                <Link to="/admin/profile/notifications" className="nt-manage-btn">
                  <Settings size={13} strokeWidth={2.5} />
                  Manage preferences
                </Link>
              </div>
              <div className="nt-role-note">
                <strong>Role-aware notification scope</strong>
                Secretary (Admin) sees urgent alerts, reports and access activity. Chairman sees system-wide alerts; BHW sees stock and device alerts.
              </div>
            </div>
          </div>
        </>
      )}

      <div className="nt-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
