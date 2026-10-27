import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../../lib/ui";
import "../DashboardPage.css";
import "./AlertDetail.css";

const KIND_LABELS = {
  low_stock: "Low stock",
  expiry: "Expiry",
  device: "Device",
  reports: "Reports",
  report: "Reports",
  scan: "Scan",
};

function kindLabel(kind) {
  if (!kind) return "Operational";
  return KIND_LABELS[kind] || String(kind).replace(/_/g, " ");
}

// Locale stamp matching the server's readable timestamps: "08 Oct 2026, 08:02".
function fmtStamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AlertDetailPage() {
  const { alertId } = useParams();
  const refresh = useApiRefresh();

  const {
    data: alert,
    isLoading,
    error,
    refetch,
  } = useEndpoint(
    `/alerts/${alertId}`,
    (res) => res?.alert ?? null,
    { enabled: Boolean(alertId) }
  );

  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const resolved = alert ? alert.status === "Resolved" || acknowledged : acknowledged;

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await sendApi(`/alerts/${alertId}/acknowledge`, { note });
    setSubmitting(false);
    if (res.ok) {
      setAcknowledged(true);
      setNotice({ kind: "success", message: "Acknowledgement recorded." });
      refresh(`/alerts/${alertId}`);
      refresh("/notifications");
    } else {
      setNotice({ kind: "error", message: res.error || "Could not record acknowledgement." });
    }
  };

  // ---- Loading / error / missing alert -----------------------------------
  if (isLoading && !alert) return <Loading label="Loading alert…" />;

  if (error && !alert) {
    return (
      <ErrorState
        title="Could not load this alert"
        message={error}
        onRetry={refetch}
        className="ad-state"
      />
    );
  }

  if (!alert) {
    return (
      <EmptyState
        title="Alert not found"
        message="This alert may have been removed."
        action={
          <Link to="/admin/notifications" className="ad-btn ad-btn--outline">
            Back to notifications
          </Link>
        }
        className="ad-state"
      />
    );
  }

  const statusText =
    alert.status === "Resolved"
      ? "Resolved"
      : alert.severity === "info"
        ? "Open · For your awareness"
        : "Open · Action required";

  // Timeline entries derived from the alert itself.
  const timeline = [
    {
      title: alert.title || "Alert raised",
      meta: `${fmtStamp(alert.at)} · ${kindLabel(alert.kind)}`,
      tag: alert.status === "Resolved" ? "• Resolved" : "• Open",
      tagClass:
        alert.status === "Resolved"
          ? "ad-timeline__tag--assigned"
          : "ad-timeline__tag--open",
    },
  ];
  if (alert.machine) {
    timeline.push({
      title: `Machine ${alert.machine}`,
      meta: `${fmtStamp(alert.at)} · ${alert.severity || "info"} severity`,
      tag: "• Monitored",
      tagClass: "ad-timeline__tag--assigned",
    });
  }
  if (resolved) {
    timeline.push({
      title: "Acknowledged by Secretary (Admin)",
      meta: "Notification marked as read",
      tag: "• Resolved",
      tagClass: "ad-timeline__tag--assigned",
    });
  }

  return (
    <>
      {/* Back */}
      <Link to="/admin/notifications" className="ad-back">
        <ArrowLeft size={14} /> Notifications &amp; updates
      </Link>

      {/* Header */}
      <div className="ad-header">
        <h1 className="ad-header__title">{alert.title}</h1>
        <p className="ad-header__subtitle">
          {alert.id} · {kindLabel(alert.kind)} alert · {fmtStamp(alert.at)}
        </p>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="ad-layout">
        {/* ============ LEFT ============ */}
        <div>
          {/* Alert summary */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Alert summary</h2>
            <p className="ad-panel__subtitle">
              {kindLabel(alert.kind)} · {alert.severity || "info"} severity ·
              Raised from the notification feed for your workspace.
            </p>

            <span className="ad-action-badge">• {statusText}</span>

            {/* Key fields */}
            <div className="ad-med-grid">
              <div className="ad-med-field">
                <p className="ad-med__name">Reported</p>
                <p className="ad-med__meta">{fmtStamp(alert.at)}</p>
              </div>
              <div className="ad-med-field">
                <p className="ad-med__name">Severity</p>
                <p className="ad-med__meta">{alert.severity || "info"}</p>
              </div>
              <div className="ad-med-field">
                <p className="ad-med__name">Machine</p>
                <p className="ad-med__meta">{alert.machine || "Not machine related"}</p>
              </div>
              <div className="ad-med-field">
                <p className="ad-med__name">Status</p>
                <p className="ad-med__meta">{alert.status}</p>
              </div>
            </div>

            {/* Machine note */}
            <div className="ad-machine-note">
              <p className="ad-machine-note__title">Machine follow-up</p>
              <p className="ad-machine-note__desc">
                {alert.machine
                  ? `${alert.machine} · device event linked to this alert`
                  : "No machine code linked to this alert."}
              </p>
            </div>

            <p className="ad-description">{alert.body}</p>

            {/* Actions */}
            <div className="ad-actions">
              <Link to="/admin/notifications" className="ad-btn ad-btn--primary">
                Back to notifications
              </Link>
              <Link to="/admin/dashboard" className="ad-btn ad-btn--outline">
                Open admin dashboard
              </Link>
            </div>
          </div>

          {/* Alert status */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Alert status</h2>

            <div className="ad-alloc-row">
              <div>
                <p className="ad-alloc__title">{alert.title}</p>
                <p className="ad-alloc__meta">
                  {kindLabel(alert.kind)} · Reported {fmtStamp(alert.at)}
                  {alert.machine ? ` · ${alert.machine}` : ""}
                </p>
              </div>
              <span className="ad-alloc__tag">• {alert.severity || "info"}</span>
            </div>

            <p className="ad-description">
              Acknowledging marks this notification as read for your account. It
              does not resolve stock levels — a restock entry is still required.
            </p>

            {/* Acknowledgment status */}
            {resolved ? (
              <div className="ad-ack-by">
                <p className="ad-ack-by__label">Acknowledged by</p>
                <p className="ad-ack-by__meta">
                  Secretary (Admin) · {fmtStamp(alert.at)}
                </p>
              </div>
            ) : (
              <div className="ad-ack-row">
                <CheckCircle2 size={14} strokeWidth={2.5} />
                Not yet acknowledged
              </div>
            )}
          </div>

          {/* Acknowledge form */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Acknowledge operational alert</h2>

            {notice && (
              <div style={{ marginBottom: "0.75rem" }}>
                <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>
              </div>
            )}

            <form onSubmit={handleAcknowledge}>
              <div>
                <label className="ad-form-label" htmlFor="ad-ack-note">
                  Follow-up note
                </label>
                <textarea
                  id="ad-ack-note"
                  className="ad-textarea"
                  placeholder="Checked supply balance. Restock and Slot C refill queued for delivery."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="ad-form-actions">
                <button
                  type="submit"
                  className="ad-btn ad-btn--primary"
                  disabled={submitting || resolved}
                >
                  {submitting
                    ? "Recording…"
                    : resolved
                      ? "Acknowledged"
                      : "Record acknowledgement"}
                </button>
                <Link
                  to="/admin/notifications"
                  className="ad-btn ad-btn--outline"
                >
                  Back to notifications
                </Link>
              </div>

              <p className="ad-form-note">
                Acknowledgement does not resolve stock levels. A restock entry
                is required.
              </p>
            </form>
          </div>
        </div>

        {/* ============ RIGHT: TIMELINE + NOTES ============ */}
        <div>
          {/* Alert timeline */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Alert timeline</h2>

            {timeline.length === 0 ? (
              <EmptyState title="No timeline entries yet" />
            ) : (
              timeline.map((t, i) => (
                <div className="ad-timeline-item" key={i}>
                  <div>
                    <p className="ad-timeline__title">{t.title}</p>
                    <p className="ad-timeline__meta">{t.meta}</p>
                  </div>
                  <span className={`ad-timeline__tag ${t.tagClass}`}>
                    {t.tag}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Role-aware note */}
          <div className="ad-role-note">
            <strong>Role-aware next steps</strong>
            BHW records restock and maintenance. Chairman monitors aggregate
            alerts. Secretary (Admin) coordinates updates.
          </div>

          {/* Notification preferences button */}
          <Link
            to="/admin/profile/notifications"
            className="ad-pref-btn"
          >
            Notification preferences
          </Link>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ad-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
