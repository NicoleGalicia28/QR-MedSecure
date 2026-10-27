import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtStamp, syncStatusLabel } from "./format";
import "../admin/DashboardPage.css";
import "./ChairmanSyncBatch.css";

const TABS = [
  { key: "summary", label: "Batch summary" },
  { key: "log", label: "Event log" },
  { key: "retry", label: "Retry result" },
];

function eventTag(level) {
  if (level === "error") return { tag: "• Failed", className: "csb-log__tag--failed" };
  if (level === "success") return { tag: "• Success", style: { color: "#065f46" } };
  return { tag: "• Info", className: "csb-log__tag--retained" };
}

export default function ChairmanSyncBatchPage() {
  const { batchId } = useParams();
  const refresh = useApiRefresh();
  const [activeTab, setActiveTab] = useState("summary");
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState(null);
  const [notice, setNotice] = useState(null);

  // Live batch detail from /chairman/sync/history/:batchId.
  const {
    data: detail,
    isLoading,
    error,
    refetch,
  } = useEndpoint(
    batchId ? `/chairman/sync/history/${batchId}` : null,
    (res) => ({ batch: res.batch, events: res.events }),
    { enabled: Boolean(batchId) }
  );

  const batch = detail?.batch;
  const events = Array.isArray(detail?.events) ? detail.events : [];

  const handleRetry = async () => {
    setRetrying(true);
    setNotice(null);
    const res = await sendApi(`/sync/history/${batchId}/retry`, {}, "POST");
    setRetrying(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setRetryResult(res.data?.batch);
    setNotice({ kind: "success", text: "Retry completed successfully." });
    setActiveTab("retry");
    await Promise.all([
      refresh("/chairman/sync/history"),
      refresh(`/chairman/sync/history/${batchId}`),
    ]);
  };

  const statusClass =
    batch?.status === "success"
      ? "csb-status-tag csb-status-tag--success"
      : "csb-status-tag csb-status-tag--failed";

  return (
    <>
      {/* Back */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <Link to="/chairman/sync" className="csb-back">
          <ArrowLeft size={14} /> Back to sync
        </Link>
        <Link to="/chairman/sync/history" className="csb-back">
          <ArrowLeft size={14} /> Sync history
        </Link>
      </div>

      {/* Header */}
      <div className="csb-header">
        <h1 className="csb-header__title">Synchronization batch detail</h1>
        <p className="csb-header__subtitle">
          {batchId} · Live batch record from the shared store.
        </p>
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

      {!batchId ? (
        <EmptyState title="No batch selected" message="Open a batch from the sync history list." />
      ) : isLoading ? (
        <Loading label="Loading batch…" />
      ) : error ? (
        <ErrorState title="Could not load this batch" message={error} onRetry={refetch} />
      ) : !batch ? (
        <EmptyState title="Batch not found" message="This batch no longer exists." />
      ) : (
        <>
          {/* Tabs */}
          <div className="csb-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={"csb-tab" + (activeTab === t.key ? " csb-tab--active" : "")}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ---------- SUMMARY ---------- */}
          {activeTab === "summary" && (
            <div className="csb-layout">
              {/* ============ LEFT ============ */}
              <div>
                <div className="csb-panel">
                  <div className="csb-fail-header">
                    <div>
                      <h2 className="csb-panel__title">Batch summary</h2>
                      <p className="csb-panel__subtitle">
                        {fmtStamp(batch.startedAt)}
                      </p>
                    </div>
                    <span className={statusClass}>
                      {syncStatusLabel(batch.status)}
                    </span>
                  </div>

                  <div className="csb-grid">
                    <div className="csb-field">
                      <span className="csb-field__label">Batch ID</span>
                      <span className="csb-field__value">{batch.batchId}</span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Records</span>
                      <span className="csb-field__value">{batch.records ?? 0}</span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Failed records</span>
                      <span className="csb-field__value csb-field__value--muted">
                        {batch.failed ?? 0}
                      </span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Device</span>
                      <span className="csb-field__value">{batch.device || "—"}</span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Started</span>
                      <span className="csb-field__value">{fmtStamp(batch.startedAt)}</span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Completed</span>
                      <span className="csb-field__value">
                        {batch.completedAt ? fmtStamp(batch.completedAt) : "Not completed"}
                      </span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Initiated by</span>
                      <span className="csb-field__value">{batch.initiatedBy}</span>
                    </div>
                  </div>

                  {batch.status !== "success" ? (
                    <div className="csb-warning">
                      <strong>Retry required</strong>
                      This batch did not complete successfully. Retrying records a
                      new batch containing the records retained in the store.
                    </div>
                  ) : (
                    <div className="csb-success-box">
                      <strong>Batch completed</strong>
                      All records in this batch synchronized successfully.
                    </div>
                  )}

                  <div className="csb-actions">
                    {batch.status !== "success" && (
                      <button
                        type="button"
                        className="csb-btn csb-btn--primary"
                        onClick={handleRetry}
                        disabled={retrying}
                      >
                        {retrying ? "Retrying…" : "Retry retained batch"}
                      </button>
                    )}
                    <Link to="/chairman/sync/history" className="csb-btn csb-btn--outline">
                      Back to sync history
                    </Link>
                  </div>
                </div>

                {/* Event Log Panel */}
                <div className="csb-panel">
                  <h2 className="csb-panel__title">Event log</h2>
                  <p className="csb-panel__subtitle">
                    Chronological log of this batch.
                  </p>

                  {events.length === 0 ? (
                    <p className="csb-log__meta">No events recorded for this batch.</p>
                  ) : (
                    events.map((e, i) => {
                      const t = eventTag(e.level);
                      return (
                        <div className="csb-log-item" key={i}>
                          <div>
                            <p className="csb-log__title">{e.event}</p>
                            <p className="csb-log__meta">{fmtStamp(e.at)}</p>
                          </div>
                          <span className={`csb-log__tag ${t.className || ""}`} style={t.style}>
                            {t.tag}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ============ RIGHT ============ */}
              <div>
                <div className="csb-panel">
                  <div className="csb-fail-header">
                    <div>
                      <h2 className="csb-panel__title">Retry status</h2>
                      <p className="csb-panel__subtitle">
                        {retryResult ? fmtStamp(retryResult.completedAt) : "Awaiting action"}
                      </p>
                    </div>
                    <span
                      className={
                        retryResult || batch.status === "success"
                          ? "csb-status-tag csb-status-tag--success"
                          : "csb-status-tag csb-status-tag--failed"
                      }
                    >
                      {retryResult
                        ? "Successful"
                        : batch.status === "success"
                          ? "Not required"
                          : "Pending"}
                    </span>
                  </div>

                  {retryResult ? (
                    <>
                      <div className="csb-success-grid">
                        <div className="csb-field">
                          <span className="csb-field__label">Retry reference</span>
                          <span className="csb-field__value">{retryResult.batchId}</span>
                        </div>
                        <div className="csb-field">
                          <span className="csb-field__label">Requested by</span>
                          <span className="csb-field__value csb-field__value--muted">
                            {retryResult.initiatedBy}
                          </span>
                        </div>
                        <div className="csb-field">
                          <span className="csb-field__label">Result</span>
                          <span className="csb-field__value">
                            {retryResult.records ?? 0} synced · {retryResult.failed ?? 0} failed
                          </span>
                        </div>
                        <div className="csb-field">
                          <span className="csb-field__label">Device</span>
                          <span className="csb-field__value">{retryResult.device || "—"}</span>
                        </div>
                      </div>
                      <div className="csb-success-box">
                        <strong>Timeout resolved</strong>
                        The retry created a linked batch. No updates remain queued
                        for the original batch.
                      </div>
                    </>
                  ) : batch.status === "success" ? (
                    <div className="csb-success-box">
                      <strong>No retry needed</strong>
                      This batch already completed successfully.
                    </div>
                  ) : (
                    <div className="csb-warning">
                      <strong>Retry available</strong>
                      Use “Retry retained batch” to run this batch again.
                    </div>
                  )}

                  <div className="csb-side-actions">
                    <Link to="/chairman/sync/history" className="csb-side-btn">
                      Return to sync history
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------- EVENT LOG ---------- */}
          {activeTab === "log" && (
            <div className="csb-panel">
              <h2 className="csb-panel__title">Event log</h2>
              <p className="csb-panel__subtitle">Chronological log of this batch.</p>
              {events.length === 0 ? (
                <p className="csb-log__meta">No events recorded for this batch.</p>
              ) : (
                events.map((e, i) => {
                  const t = eventTag(e.level);
                  return (
                    <div className="csb-log-item" key={i}>
                      <div>
                        <p className="csb-log__title">{e.event}</p>
                        <p className="csb-log__meta">{fmtStamp(e.at)}</p>
                      </div>
                      <span className={`csb-log__tag ${t.className || ""}`} style={t.style}>
                        {t.tag}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ---------- RETRY RESULT ---------- */}
          {activeTab === "retry" && (
            <div className="csb-panel">
              {retryResult ? (
                <>
                  <div className="csb-fail-header">
                    <div>
                      <h2 className="csb-panel__title">Retry completed</h2>
                      <p className="csb-panel__subtitle">{fmtStamp(retryResult.completedAt)}</p>
                    </div>
                    <span className="csb-status-tag csb-status-tag--success">
                      Successful
                    </span>
                  </div>
                  <div className="csb-success-grid">
                    <div className="csb-field">
                      <span className="csb-field__label">Retry reference</span>
                      <span className="csb-field__value">{retryResult.batchId}</span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Requested by</span>
                      <span className="csb-field__value csb-field__value--muted">
                        {retryResult.initiatedBy}
                      </span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Result</span>
                      <span className="csb-field__value">
                        {retryResult.records ?? 0} synced · {retryResult.failed ?? 0} failed
                      </span>
                    </div>
                    <div className="csb-field">
                      <span className="csb-field__label">Device</span>
                      <span className="csb-field__value">{retryResult.device || "—"}</span>
                    </div>
                  </div>
                  <div className="csb-success-box">
                    <strong>Timeout resolved</strong>
                    The retry created a linked batch. No updates remain queued for
                    the original batch.
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No retry recorded"
                  message="This batch has not been retried from this session."
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Page footer */}
      <div className="csb-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman · Synchronization batch</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
