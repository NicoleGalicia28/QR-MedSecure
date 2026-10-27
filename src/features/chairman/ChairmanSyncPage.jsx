import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import { fmtDateTime, syncStatusLabel } from "./format";
import "../admin/DashboardPage.css";
import "./ChairmanSync.css";

const INTERVAL_OPTIONS = [
  "Every four hours when ON",
  "Every two hours when ON",
  "Daily at 18:00",
];

const BREAKDOWN_LABELS = {
  beneficiaries: "Beneficiary registry",
  records: "Clinical history",
  transactions: "Transactions",
  prescriptions: "Prescriptions",
  qrTokens: "QR tokens",
};

export default function ChairmanSyncPage() {
  const refresh = useApiRefresh();
  const session = getSession();
  const chairName = session
    ? `${session.firstName} ${session.lastName}`.trim()
    : "Chairman";

  const [running, setRunning] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const [notice, setNotice] = useState(null);
  const [reason, setReason] = useState("");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("qrmed:sync:offlineQueue");
      setQueuedCount(raw ? JSON.parse(raw).length : 0);
    } catch {
      setQueuedCount(0);
    }
    const update = () => {
      setOnline(navigator.onLine);
      try {
        const raw = localStorage.getItem("qrmed:sync:offlineQueue");
        setQueuedCount(raw ? JSON.parse(raw).length : 0);
      } catch {
        setQueuedCount(0);
      }
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const interval = setInterval(update, 5000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(interval);
    };
  }, []);

  // Live sync summary from /chairman/sync/status.
  const {
    data: sync,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/chairman/sync/status", (res) => res.status);

  // Auto-sync + interval are persisted in the user's notification preferences
  // (the server merges arbitrary keys), then read back from the same endpoint.
  const {
    data: prefs,
    isLoading: prefsLoading,
    error: prefsError,
    refetch: refetchPrefs,
  } = useEndpoint("/users/me/notification-preferences", (res) => res.preferences);

  const autoSync = prefs ? prefs.autoSync !== false : true;
  const interval = prefs?.syncInterval || INTERVAL_OPTIONS[0];

  const savePref = async (patch, successText) => {
    setSavingPref(true);
    setNotice(null);
    const res = await sendApi("/users/me/notification-preferences", patch, "PUT");
    setSavingPref(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return false;
    }
    await refetchPrefs();
    if (successText) setNotice({ kind: "success", text: successText });
    return true;
  };

  const toggleAutoSync = () => savePref({ autoSync: !autoSync });

  const handleSyncNow = async () => {
    if (!online && queuedCount === 0) {
      setNotice({ kind: "error", text: "You're offline. Queue events locally and sync when connected." });
      return;
    }
    setRunning(true);
    setNotice(null);
    let queue = [];
    try {
      const raw = localStorage.getItem("qrmed:sync:offlineQueue");
      queue = raw ? JSON.parse(raw) : [];
    } catch {
      queue = [];
    }
    const res = await sendApi("/sync/run", { offlineEvents: queue });
    setRunning(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    if (queue.length > 0) {
      try {
        localStorage.setItem("qrmed:sync:offlineQueue", "[]");
      } catch {}
      setQueuedCount(0);
    }
    setNotice({
      kind: "success",
      text: `Synchronization batch completed · ${(res.data?.batch?.records ?? 0)} record(s).`,
    });
    await Promise.all([
      refresh("/chairman/sync/status"),
      refresh("/chairman/sync/history"),
    ]);
  };

  const breakdown = sync?.breakdown ? Object.entries(sync.breakdown) : [];

  return (
    <>
      {/* Back */}
      <Link to="/chairman/dashboard" className="cs-back">
        <ArrowLeft size={14} /> Chairman dashboard
      </Link>

      {/* Header */}
      <div className="cs-header">
        <h1 className="cs-header__title">Synchronization settings</h1>
        <p className="cs-header__subtitle">
          Chairman control ·{" "}
          {autoSync
            ? "Automatic synchronization active"
            : "Automatic synchronization paused"}
        </p>
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}
      {prefsError && (
        <InlineNotice kind="error">
          Could not load preferences: {prefsError}
        </InlineNotice>
      )}

      {/* ---------- LAYOUT ---------- */}
      <div className="cs-layout">
        {/* ============ LEFT ============ */}
        <div>
          {/* Synchronization control */}
          <div className="cs-panel">
            <h2 className="cs-panel__title">Synchronization control</h2>
            <p className="cs-panel__subtitle">
              Chairman permission · Sync runs against the live database.
            </p>

            {/* Sync Toggle Row */}
            <div className="cs-sync-top">
              <div>
                <p className="cs-sync__label">
                  Automatic workspace synchronization
                </p>
                <p className="cs-sync__desc">
                  Scheduled every four hours when enabled. Local recording
                  remains available when synchronization is off.
                </p>
              </div>
              <label className="cs-switch">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={toggleAutoSync}
                  disabled={prefsLoading || savingPref}
                />
                <span className="cs-switch__track" />
              </label>
            </div>

            {/* Sync details row */}
            {isLoading ? (
              <Loading label="Loading sync status…" />
            ) : error ? (
              <ErrorState message={error} onRetry={refetch} />
            ) : (
              <div className="cs-sync-row">
                <div>
                  <p className="cs-sync-field__label">Last successful batch</p>
                  <p className="cs-sync-field__value">
                    {sync?.lastSyncAt
                      ? `${fmtDateTime(sync.lastSyncAt)} · ${syncStatusLabel(sync.lastStatus)}`
                      : "No batch recorded yet"}
                  </p>
                </div>
                <div>
                  <p className="cs-sync-field__label">Queued updates</p>
                  <p className="cs-sync-field__value cs-sync-field__value--muted">
                    {sync?.pending ?? 0} records
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="cs-sync-actions">
              <button
                type="button"
                className="cs-btn cs-btn--primary"
                onClick={toggleAutoSync}
                disabled={savingPref || prefsLoading}
              >
                {autoSync ? "Pause synchronization" : "Resume synchronization"}
              </button>
              <button
                type="button"
                className="cs-btn cs-btn--outline"
                onClick={handleSyncNow}
                disabled={running || (!online && queuedCount === 0)}
              >
                <RefreshCcw size={14} strokeWidth={2.5} />
                {running ? "Syncing…" : online ? (queuedCount > 0 ? "Sync queued" : "Sync now") : "Offline (queued)"}
              </button>
              <Link to="/chairman/sync/history" className="cs-btn cs-btn--outline">
                View sync history
              </Link>
            </div>
          </div>

          {/* Tracked records table */}
          <div className="cs-panel">
            <h2 className="cs-panel__title">Tracked records</h2>
            <p className="cs-panel__subtitle">
              Live record counts across the shared store ·{" "}
              {sync?.totalRecords ?? 0} records in total.
            </p>

            {breakdown.length === 0 ? (
              <p className="cs-sync-note">No record counts available.</p>
            ) : (
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Records</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map(([key, count]) => (
                    <tr key={key}>
                      <td className="cs-table__category">
                        {BREAKDOWN_LABELS[key] || key}
                      </td>
                      <td className="cs-table__num">{count}</td>
                      <td className="cs-table__status">Tracked</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="cs-table-footer">
              <span>Showing {breakdown.length} record categories</span>
            </div>

            <div className="cs-warning">
              <strong>Local recording remains available</strong>
              Any updates that fail to push remain queued until the next
              successful synchronization run.
            </div>
          </div>

          {/* Schedule */}
          <div className="cs-panel">
            <h2 className="cs-panel__title">Schedule</h2>

            <div className="cs-field" style={{ marginTop: 16 }}>
              <label className="cs-label">Automatic interval</label>
              <select
                className="cs-select"
                value={interval}
                onChange={(e) => savePref({ syncInterval: e.target.value })}
                disabled={savingPref}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="cs-dest-row">
              <div>
                <p className="cs-dest__label">Destination</p>
                <p className="cs-dest__value">Consolidated barangay workspace</p>
              </div>
            </div>
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        <div>
          {/* Pause Panel */}
          <div className="cs-side-panel">
            <h2 className="cs-side-panel__title">
              {autoSync ? "Turn synchronization off?" : "Synchronization paused"}
            </h2>
            <p className="cs-side-panel__subtitle">
              {autoSync
                ? "Pausing stops automatic batches; new updates queue locally."
                : "Resume to immediately push queued updates on the next run."}
            </p>

            <div className="cs-side-row">
              <p className="cs-side__label">Requested by</p>
              <p className="cs-side__value">{chairName} · Chairman</p>
            </div>

            <div className="cs-warning" style={{ marginTop: 12, marginBottom: 16 }}>
              <strong>{autoSync ? "Pause automatic batches" : "Automatic batches are paused"}</strong>
              Staff can continue recording. This does not delete existing
              records.
            </div>

            <div className="cs-field">
              <label className="cs-label">Reason for pause</label>
              <input
                type="text"
                className="cs-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Scheduled network maintenance"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 12.5,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div className="cs-side-actions">
              <button
                type="button"
                className="cs-side-btn cs-side-btn--primary"
                onClick={() =>
                  savePref(
                    { autoSync: false, syncPauseReason: reason },
                    "Synchronization paused."
                  )
                }
                disabled={savingPref}
              >
                Confirm turn off
              </button>
              <button
                type="button"
                className="cs-side-btn cs-side-btn--outline"
                onClick={() =>
                  savePref({ autoSync: true }, "Synchronization remains active.")
                }
                disabled={savingPref}
              >
                Keep synchronization on
              </button>
            </div>

            <p className="cs-side-note">
              <strong>Current state</strong>
              {autoSync ? "ON · Automatic batches enabled." : "OFF · Queued changes retained."}
            </p>
          </div>
        </div>
      </div>

      {/* Page footer */}
      <div className="cs-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman · Synchronization</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
