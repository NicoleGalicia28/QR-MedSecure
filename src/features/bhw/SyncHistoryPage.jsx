import { useEffect, useState } from "react";
import { RefreshCcw, CloudOff, CheckCircle2, Download, Wifi, WifiOff } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { downloadFile } from "../../lib/api";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./SyncHistory.css";

const OFFLINE_QUEUE_KEY = "qrmed:sync:offlineQueue";

function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

function queueOfflineEvent(event) {
  const queue = getOfflineQueue();
  queue.push({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...event,
  });
  saveOfflineQueue(queue);
}

const STATUS_LABELS = {
  success: "In sync",
  partial: "Partially synced",
  failed: "Sync failed",
  never: "Never synced",
};

function resultPill(status) {
  if (status === "success") {
    return (
      <span className="status-pill status-pill--active">• Synced</span>
    );
  }
  if (status === "partial") {
    return <span className="status-pill status-pill--review">• Partial</span>;
  }
  return <span className="status-pill status-pill--review">• Failed</span>;
}

export default function SyncHistoryPage() {
  const refresh = useApiRefresh();
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(getOfflineQueue().length);
  const [autoSynced, setAutoSynced] = useState(false);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setQueuedCount(getOfflineQueue().length);
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

  // Live workspace sync state (GET /sync/status).
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useEndpoint("/sync/status", (res) => {
    const s = res.status ?? {};
    return {
      state: STATUS_LABELS[s.lastStatus] ?? s.lastStatus ?? "—",
      lastSync: s.lastSyncAt ? fmtDateTime(s.lastSyncAt) : "—",
      mode: s.offlineQueue ?? "—",
      pending: typeof s.pending === "number" ? String(s.pending + queuedCount) : String(queuedCount),
      pendingHint: (s.pending || 0) + queuedCount > 0 ? `${(s.pending || 0) + queuedCount} record(s) queued` : "Nothing queued",
      totalRecords: s.totalRecords ?? 0,
    };
  }, { staleTime: 0 });

  // Live batch history (GET /sync/history).
  const {
    data: batches,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/sync/history", (res) =>
    (res.batches ?? []).map((b) => ({
      id: b.batchId,
      type: b.initiatedBy ?? "Automatic schedule",
      device: b.device ?? "—",
      started: b.startedAt ? fmtDateTime(b.startedAt) : "—",
      records: typeof b.records === "number" ? String(b.records) : b.records ?? "—",
      result: b.status,
      failed: b.failed ?? 0,
    }))
  , { staleTime: 0 });

  // Inline detail for the selected batch (GET /sync/history/:batchId).
  const [selectedId, setSelectedId] = useState(null);
  const {
    data: detail,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useEndpoint(
    selectedId ? `/sync/history/${selectedId}` : null,
    (res) => res,
    { enabled: Boolean(selectedId) }
  );

  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState(null);

  const latest = batches?.[0];

  const handleSyncNow = async () => {
    if (running) return;
    if (!online) {
      setNotice({ kind: "error", text: "You're offline. Events are stored locally and will sync automatically when connection is restored." });
      return;
    }
    setRunning(true);
    setNotice(null);
    const queue = getOfflineQueue();
    const res = await sendApi("/sync/run", { offlineEvents: queue });
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
    } else {
      if (queue.length > 0) {
        saveOfflineQueue([]);
        setQueuedCount(0);
      }
      setNotice({
        kind: "success",
        text: `Synchronization completed · ${res.data?.batch?.batchId ?? "batch recorded"} · ${(res.data?.batch?.records ?? 0) + queue.length} record(s) uploaded.`,
      });
      setSelectedId(res.data?.batch?.batchId ?? null);
    }
    setRunning(false);
    await refresh("/sync/status");
    await refresh("/sync/history");
  };

  useEffect(() => {
    if (online && !autoSynced && (queuedCount > 0 || !running)) {
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        setAutoSynced(true);
        (async () => {
          setRunning(true);
          const res = await sendApi("/sync/run", { offlineEvents: queue });
          if (res.ok) {
            saveOfflineQueue([]);
            setQueuedCount(0);
            setNotice({ kind: "success", text: `Auto-synced ${queue.length} offline event(s) when connection restored.` });
            await refresh("/sync/status");
            await refresh("/sync/history");
          }
          setRunning(false);
        })();
      } else {
        setAutoSynced(true);
      }
    }
    if (!online) {
      setAutoSynced(false);
    }
  }, [online, queuedCount]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setNotice(null);
    try {
      await downloadFile("/sync/history/export.csv", "sync-history.csv");
      setNotice({ kind: "success", text: "Sync history exported as CSV." });
    } catch (err) {
      setNotice({
        kind: "error",
        text: err?.message || "Export failed. Please try again.",
      });
    }
    setExporting(false);
  };

  return (
    <>
      {/* Header */}
      <div className="sy-header">
        <div>
          <h1 className="sy-header__title">Sync history</h1>
          <p className="sy-header__subtitle">
            Offline-first recordings upload automatically when the connection
            returns.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: online ? "#065f46" : "#92400e" }}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{online ? "Online" : "Offline"}</span>
            {queuedCount > 0 ? <span>· {queuedCount} queued</span> : null}
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{
              border: "1px solid #d1d5db",
              background: "#fff",
              color: "#1a1a1a",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 7,
              cursor: exporting ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            <Download size={14} strokeWidth={2.5} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button
            type="button"
            className="sy-sync-btn"
            onClick={handleSyncNow}
            disabled={running || (!online && queuedCount === 0)}
          >
            <RefreshCcw size={14} strokeWidth={2.5} className={running ? "sy-spin" : ""} />
            {running ? "Syncing…" : online ? (queuedCount > 0 ? "Sync queued" : "Run sync now") : "Offline (queued)"}
          </button>
        </div>
      </div>

      {notice ? (
        <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
      ) : null}

      {/* ---------- SYNC STATUS ---------- */}
      {statusLoading && !status ? (
        <Loading label="Loading sync status…" />
      ) : statusError && !status ? (
        <ErrorState
          title="Could not load sync status"
          message={statusError}
          onRetry={refetchStatus}
        />
      ) : (
        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-card__label">Sync state</p>
            <p className="kpi-card__value">{status?.state ?? "—"}</p>
            <p className="kpi-card__hint">
              {status?.state === "In sync" ? "All changes uploaded" : "Review the batch list below"}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-card__label">Last synchronization</p>
            <p className="kpi-card__value" style={{ fontSize: 15 }}>
              {status?.lastSync ?? "—"}
            </p>
            <p className="kpi-card__hint">{status?.mode ?? "—"}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-card__label">Pending uploads</p>
            <p className="kpi-card__value">{status?.pending ?? "0"}</p>
            <p className="kpi-card__hint">{status?.pendingHint ?? "Nothing queued"}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-card__label">Records in workspace</p>
            <p className="kpi-card__value">{status?.totalRecords ?? 0}</p>
            <p className="kpi-card__hint">
              {latest?.device ? `Latest batch · ${latest.device}` : "No batches yet"}
            </p>
          </div>
        </div>
      )}

      {/* ---------- OFFLINE NOTE ---------- */}
      <div className="sy-note">
        <CloudOff size={16} />
        <div>
          <strong>Works offline</strong>
          <p>
            Events recorded while offline are stored locally. When connectivity
            is restored, they sync automatically. Use "Sync queued" to manually
            push queued events after reconnecting. No data is dropped.
          </p>
        </div>
      </div>

      {/* ---------- BATCHES ---------- */}
      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Synchronization events</h2>
            <p className="sy-panel__subtitle">
              Upload batches recorded for the barangay health center workspace.
              Select a row to see its timeline.
            </p>
          </div>
          <span className="status-pill status-pill--active">
            <CheckCircle2 size={11} /> Automatic
          </span>
        </div>

        {isLoading && !batches ? (
          <Loading label="Loading sync history…" />
        ) : error && !batches ? (
          <ErrorState
            title="Could not load sync history"
            message={error}
            onRetry={refetch}
          />
        ) : batches && batches.length === 0 ? (
          <EmptyState
            title="No synchronization batches yet"
            message="Run a sync to upload queued records and create the first batch."
          />
        ) : (
          <>
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Initiated by</th>
                  <th>Started</th>
                  <th>Records</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {(batches ?? []).map((e) => (
                  <tr
                    key={e.id}
                    onClick={() =>
                      setSelectedId((prev) => (prev === e.id ? null : e.id))
                    }
                    style={{ cursor: "pointer" }}
                    title="Show batch timeline"
                  >
                    <td className="rec-table__name">{e.id}</td>
                    <td>{e.type}</td>
                    <td>{e.started}</td>
                    <td>{e.records}</td>
                    <td>{resultPill(e.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Inline batch detail */}
            {selectedId ? (
              <div className="panel" style={{ marginTop: 16 }}>
                <div className="panel__header">
                  <div>
                    <h2 className="panel__title">Batch {selectedId}</h2>
                    <p className="sy-panel__subtitle">
                      {detail?.batch
                        ? `${detail.batch.device} · ${detail.batch.records} record(s) · ${detail.batch.failed} failed`
                        : "Loading timeline…"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#1a1a1a",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Close
                  </button>
                </div>

                {detailLoading && !detail ? (
                  <Loading label="Loading batch timeline…" />
                ) : detailError && !detail ? (
                  <ErrorState
                    title="Could not load this batch"
                    message={detailError}
                    onRetry={refetchDetail}
                  />
                ) : (
                  (detail?.events ?? []).map((ev, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 16,
                        padding: "10px 0",
                        borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "#1a1a1a" }}>
                          {ev.event}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6b7280" }}>
                          {fmtDateTime(ev.at)}
                        </p>
                      </div>
                      <span
                        className={`status-pill ${
                          ev.level === "error"
                            ? "status-pill--review"
                            : "status-pill--active"
                        }`}
                      >
                        • {ev.level}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <div className="rec-footer">
              <span>Latest {batches?.length ?? 0} of {batches?.length ?? 0} sync batches</span>
              <span>Automatic retries on failure</span>
            </div>
          </>
        )}
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="dash-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
