import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import { fmtStamp } from "./format";
import "../admin/DashboardPage.css";
import "../bhw/AlertDetail.css";

export default function ChairmanAlertDetailPage() {
  const { alertId } = useParams();
  const refresh = useApiRefresh();

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  // Live alert from /alerts/:alertId.
  const {
    data: alert,
    isLoading,
    error,
    refetch,
  } = useEndpoint(
    alertId ? `/alerts/${alertId}` : null,
    (res) => res.alert,
    { enabled: Boolean(alertId) }
  );

  const isResolved = alert?.status === "Resolved";

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    if (!alertId) return;
    setSubmitting(true);
    setNotice(null);
    const res = await sendApi(`/alerts/${alertId}/acknowledge`, { note }, "POST");
    setSubmitting(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setNotice({ kind: "success", text: "Alert acknowledged." });
    setNote("");
    await refresh(`/alerts/${alertId}`);
  };

  return (
    <>
      {/* Back */}
      <Link to="/chairman/notifications" className="ad-back">
        <ArrowLeft size={14} /> Notifications &amp; updates
      </Link>

      {isLoading ? (
        <Loading label="Loading alert…" />
      ) : error ? (
        <ErrorState title="Could not load this alert" message={error} onRetry={refetch} />
      ) : !alert ? (
        <ErrorState title="Alert not found" message="This alert no longer exists." onRetry={refetch} />
      ) : (
        <>
          {/* Header */}
          <div className="ad-header">
            <h1 className="ad-header__title">{alert.title || "Operational alert"}</h1>
            <p className="ad-header__subtitle">
              {alert.id} · {alert.kind || "alert"} · {alert.at ? fmtStamp(alert.at) : "—"}
            </p>
          </div>

          {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

          {/* ---------- LAYOUT ---------- */}
          <div className="ad-layout">
            {/* ============ LEFT ============ */}
            <div>
              {/* Alert detail */}
              <div className="ad-panel">
                <h2 className="ad-panel__title">Alert detail</h2>
                <p className="ad-panel__subtitle">
                  Aggregate view of the alert visible to Chairman oversight.
                </p>

                <span className="ad-action-badge">
                  • {alert.status || "Open"}
                  {isResolved ? " · Monitoring" : " · Action required"}
                </span>

                {alert.machine && (
                  <div className="ad-machine-note">
                    <p className="ad-machine-note__title">Machine follow-up</p>
                    <p className="ad-machine-note__desc">
                      {alert.machine} · Review device status and refills.
                    </p>
                  </div>
                )}

                <p className="ad-description">{alert.body || "No further detail provided."}</p>

                {/* Actions — inside the chairman workspace only */}
                <div className="ad-actions">
                  <Link to="/chairman/reports" className="ad-btn ad-btn--primary">
                    Open statistics &amp; reports
                  </Link>
                  <Link to="/chairman/sync" className="ad-btn ad-btn--outline">
                    Open synchronization settings
                  </Link>
                </div>
              </div>

              {/* Acknowledge form */}
              <div className="ad-panel">
                <h2 className="ad-panel__title">Acknowledge operational alert</h2>

                <form onSubmit={handleAcknowledge}>
                  <div>
                    <label className="ad-form-label">Follow-up note</label>
                    <textarea
                      className="ad-textarea"
                      placeholder="Reviewed with the BHW coordinator. Restock and refill queued for delivery."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  <div className="ad-form-actions">
                    <button
                      type="submit"
                      className="ad-btn ad-btn--primary"
                      disabled={submitting || isResolved}
                    >
                      {submitting
                        ? "Recording…"
                        : isResolved
                          ? "Already acknowledged"
                          : "Record acknowledgement"}
                    </button>
                    <Link to="/chairman/notifications" className="ad-btn ad-btn--outline">
                      Back to notifications
                    </Link>
                  </div>

                  <p className="ad-form-note">
                    Acknowledgement does not resolve stock levels. A BHW restock
                    entry is required.
                  </p>
                </form>
              </div>
            </div>

            {/* ============ RIGHT ============ */}
            <div>
              {/* Alert metadata */}
              <div className="ad-panel">
                <h2 className="ad-panel__title">Alert metadata</h2>

                <div className="ad-alloc-row">
                  <div>
                    <p className="ad-alloc__title">Status</p>
                    <p className="ad-alloc__meta">{alert.status || "Open"}</p>
                  </div>
                  <span className="ad-alloc__tag">• {alert.severity || "info"}</span>
                </div>

                <div className="ad-alloc-row">
                  <div>
                    <p className="ad-alloc__title">Category</p>
                    <p className="ad-alloc__meta">{alert.kind || "system"}</p>
                  </div>
                </div>

                <div className="ad-alloc-row">
                  <div>
                    <p className="ad-alloc__title">Received</p>
                    <p className="ad-alloc__meta">
                      {alert.at ? fmtStamp(alert.at) : "—"}
                    </p>
                  </div>
                </div>

                {alert.machine && (
                  <div className="ad-alloc-row">
                    <div>
                      <p className="ad-alloc__title">Machine</p>
                      <p className="ad-alloc__meta">{alert.machine}</p>
                    </div>
                  </div>
                )}

                {isResolved ? (
                  <div className="ad-ack-by">
                    <p className="ad-ack-by__label">Acknowledged</p>
                    <p className="ad-ack-by__meta">
                      Marked as resolved at {alert.at ? fmtStamp(alert.at) : "—"}
                    </p>
                  </div>
                ) : (
                  <div className="ad-ack-row">
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                    Awaiting acknowledgement
                  </div>
                )}
              </div>

              {/* Role-aware note */}
              <div className="ad-role-note">
                <strong>Role-aware next steps</strong>
                Chairman monitors aggregate alerts across the barangay. BHW records
                restock and maintenance. Secretary (Admin) coordinates updates.
              </div>

              {/* Notification preferences button */}
              <Link to="/chairman/profile/notifications" className="ad-pref-btn">
                Notification preferences
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ad-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
