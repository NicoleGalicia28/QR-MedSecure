import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ArrowRight, RefreshCcw } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDateTime, syncStatusLabel } from "./format";
import "../admin/DashboardPage.css";
import "./ChairmanDashboard.css";

const QUICK_ACTIONS = [
  { label: "Statistics & reports", to: "/chairman/reports" },
  { label: "Synchronization settings", to: "/chairman/sync" },
  { label: "Sync history", to: "/chairman/sync/history" },
  { label: "Notifications", to: "/chairman/notifications" },
  { label: "Profile & settings", to: "/chairman/profile" },
];

export default function ChairmanDashboardPage() {
  const user = getSession();
  const refresh = useApiRefresh();
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
  const chairName = fullName || "Chairman";

  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState(null);

  // Live KPI cards from /chairman/dashboard.
  const {
    data: kpis,
    isLoading: kpisLoading,
    error: kpisError,
    refetch: refetchKpis,
  } = useEndpoint("/chairman/dashboard", (res) => res.kpis);

  // Live sync summary from /chairman/sync/status.
  const {
    data: sync,
    isLoading: syncLoading,
    error: syncError,
    refetch: refetchSync,
  } = useEndpoint("/chairman/sync/status", (res) => res.status);

  // Recent alerts come from the live notification feed.
  const {
    data: notifications,
    isLoading: alertsLoading,
    error: alertsError,
    refetch: refetchAlerts,
  } = useEndpoint("/notifications", (res) => res.notifications);

  const recentAlerts = Array.isArray(notifications)
    ? notifications.slice().sort((a, b) => Number(a.read) - Number(b.read)).slice(0, 3)
    : [];

  const handleSyncNow = async () => {
    setRunning(true);
    setNotice(null);
    const res = await sendApi("/sync/run", {});
    setRunning(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setNotice({ kind: "success", text: "Synchronization batch completed." });
    await Promise.all([refresh("/chairman/sync/status"), refresh("/chairman/sync/history")]);
  };

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="dash-header">
        <div>
          <h1 className="dash-header__title">Barangay health overview</h1>
          <p className="dash-header__subtitle">
            Chairman workspace · {chairName} · Aggregate oversight, not
            clinical records.
          </p>
        </div>
        <Link to="/chairman/reports" className="dash-btn-primary">
          <BarChart3 size={15} strokeWidth={2.5} />
          Statistics &amp; reports
        </Link>
      </div>

      {/* ---------- KPI CARDS ---------- */}
      {kpisLoading ? (
        <Loading label="Loading overview…" />
      ) : kpisError ? (
        <ErrorState message={kpisError} onRetry={refetchKpis} />
      ) : !kpis || kpis.length === 0 ? (
        <EmptyState title="No overview data yet" message="The dashboard has no figures to show." />
      ) : (
        <div className="ch-kpi-grid">
          {kpis.map((k) => (
            <div className="kpi-card" key={k.label}>
              <p className="kpi-card__label">{k.label}</p>
              <p className="kpi-card__value">{k.value}</p>
              <p className="kpi-card__hint">{k.hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---------- GRID ---------- */}
      <div className="ch-grid">
        {/* ============ LEFT ============ */}
        <div>
          {/* Synchronization control */}
          <div className="ch-panel">
            <h2 className="ch-panel__title">Synchronization control</h2>
            <p className="ch-panel__subtitle">
              Chairman controls automatic sync.
            </p>

            {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

            {syncLoading ? (
              <Loading label="Loading sync status…" />
            ) : syncError ? (
              <ErrorState message={syncError} onRetry={refetchSync} />
            ) : (
              <div className="ch-sync-row">
                <div>
                  <p className="ch-sync-field__label">Last successful batch</p>
                  <p className="ch-sync-field__value">
                    {sync?.lastSyncAt
                      ? `${fmtDateTime(sync.lastSyncAt)} · ${syncStatusLabel(sync.lastStatus)}`
                      : "No batch recorded yet"}
                  </p>
                </div>
                <div>
                  <p className="ch-sync-field__label">Queued updates</p>
                  <p className="ch-sync-field__value ch-sync-field__value--muted">
                    {sync?.pending ?? 0} records
                  </p>
                </div>
                <div>
                  <p className="ch-sync-field__label">Tracked records</p>
                  <p className="ch-sync-field__value ch-sync-field__value--muted">
                    {sync?.totalRecords ?? 0} records
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="ch-sync-actions">
              <button
                type="button"
                className="ch-btn"
                onClick={handleSyncNow}
                disabled={running}
              >
                <RefreshCcw size={14} strokeWidth={2.5} />
                {running ? "Syncing…" : "Sync now"}
              </button>
              <Link to="/chairman/sync" className="ch-btn">
                Synchronization settings
              </Link>
              <Link to="/chairman/sync/history" className="ch-btn">
                View sync history
              </Link>
            </div>
          </div>

          {/* Quick actions */}
          <div className="ch-panel">
            <div className="ch-panel__header">
              <h2 className="ch-panel__title">Quick actions</h2>
            </div>
            <div className="ch-sync-actions">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.to} to={a.to} className="ch-btn">
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        <div>
          {/* Monitor alerts */}
          <div className="ch-panel">
            <div className="ch-panel__header">
              <h2 className="ch-panel__title">Monitor alerts</h2>
              <Link to="/chairman/notifications" className="ch-panel__link">
                Notifications <ArrowRight size={13} />
              </Link>
            </div>

            {alertsLoading ? (
              <Loading label="Loading alerts…" />
            ) : alertsError ? (
              <ErrorState message={alertsError} onRetry={refetchAlerts} />
            ) : recentAlerts.length === 0 ? (
              <EmptyState title="No alerts" message="Nothing needs your attention right now." />
            ) : (
              recentAlerts.map((a) => (
                <div className="ch-alert-item" key={a.id}>
                  <div>
                    <p className="ch-alert__title">{a.title}</p>
                    <p className="ch-alert__desc">{a.body}</p>
                  </div>
                  <span
                    className={
                      "ch-alert__tag " +
                      (a.read ? "ch-alert__tag--resolved" : "ch-alert__tag--open")
                    }
                  >
                    {a.read ? "• Read" : "• Open"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Page footer */}
      <div className="ch-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman · Aggregate oversight data</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
