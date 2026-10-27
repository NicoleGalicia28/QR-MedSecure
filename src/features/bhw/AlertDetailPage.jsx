import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./AlertDetail.css";

export default function AlertDetailPage() {
  const { alertId } = useParams();
  const refresh = useApiRefresh();

  // Live alert record (GET /alerts/:id). A notification row is the alert.
  const {
    data: alert,
    isLoading,
    error,
    refetch,
  } = useEndpoint(`/alerts/${alertId}`, (res) => res.alert, {
    enabled: Boolean(alertId),
  });

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const resolved = alert?.status === "Resolved";

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    if (saving || !alert) return;
    setSaving(true);
    setNotice(null);
    const res = await sendApi(`/alerts/${alert.id}/acknowledge`, {}, "POST");
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
    } else {
      setNotice({
        kind: "success",
        text: "Acknowledgement recorded.",
      });
    }
    setSaving(false);
    await refresh(`/alerts/${alertId}`);
    await refresh("/notifications");
  };

  if (isLoading && !alert) {
    return <Loading label="Loading alert…" />;
  }
  if (error && !alert) {
    return (
      <ErrorState
        title="Could not load this alert"
        message={error}
        onRetry={refetch}
      />
    );
  }
  if (!alert) return null;

  // Timeline derived from the real alert record — no canned entries.
  const timeline = [
    {
      title: "Alert raised",
      meta: `${fmtDateTime(alert.at)} · ${alert.machine || "Inventory monitor"}`,
      tag: resolved ? "• Resolved" : "• Open",
      tagClass: resolved
        ? "ad-timeline__tag--assigned"
        : "ad-timeline__tag--open",
    },
  ];
  if (alert.machine) {
    timeline.push({
      title: "Device flagged",
      meta: `${alert.machine} · ${alert.kind || "device"} alert`,
      tag: resolved ? "• Resolved" : "• Open",
      tagClass: resolved
        ? "ad-timeline__tag--assigned"
        : "ad-timeline__tag--open",
    });
  }
  if (resolved) {
    timeline.push({
      title: "Acknowledged and marked as read",
      meta: "Recorded by BHW staff",
      tag: "• Acknowledged",
      tagClass: "ad-timeline__tag--assigned",
    });
  }

  return (
    <>
      {/* Back */}
      <Link to="/bhw/notifications" className="ad-back">
        <ArrowLeft size={14} /> Notifications &amp; updates
      </Link>

      {/* Header */}
      <div className="ad-header">
        <h1 className="ad-header__title">{alert.title}</h1>
        <p className="ad-header__subtitle">
          {alert.id} · {alert.kind || "Operational"} alert ·{" "}
          {fmtDateTime(alert.at)}
        </p>
      </div>

      {notice ? (
        <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
      ) : null}

      {/* ---------- LAYOUT ---------- */}
      <div className="ad-layout">
        {/* ============ LEFT ============ */}
        <div>
          {/* Alert summary */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Alert summary</h2>
            <p className="ad-panel__subtitle">
              Action required from BHW inventory workflow.
            </p>

            <span className="ad-action-badge">
              • {alert.status} · {alert.severity || "info"}
            </span>

            {/* Alert fields */}
            <div className="ad-med-grid">
              <div className="ad-med-field" key="kind">
                <p className="ad-med__name">{alert.kind || "Notification"}</p>
                <p className="ad-med__meta">
                  Severity {alert.severity || "info"}
                </p>
              </div>
              {alert.machine ? (
                <div className="ad-med-field" key="machine">
                  <p className="ad-med__name">{alert.machine}</p>
                  <p className="ad-med__meta">Flagged dispensing unit</p>
                </div>
              ) : null}
            </div>

            {/* Machine note */}
            {alert.machine ? (
              <div className="ad-machine-note">
                <p className="ad-machine-note__title">Machine follow-up</p>
                <p className="ad-machine-note__desc">
                  {alert.machine} · {alert.kind || "device"} alert · Open for
                  review
                </p>
              </div>
            ) : null}

            <p className="ad-description">{alert.body}</p>

            {/* Actions */}
            <div className="ad-actions">
              <Link to="/bhw/restock" className="ad-btn ad-btn--primary">
                Open restock entry
              </Link>
              <Link to="/bhw/machine" className="ad-btn ad-btn--outline">
                Open machine monitoring
              </Link>
            </div>
          </div>

          {/* Acknowledgment status + form */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Acknowledge operational alert</h2>

            {resolved ? (
              <div className="ad-ack-by">
                <p className="ad-ack-by__label">Acknowledged by</p>
                <p className="ad-ack-by__meta">
                  Recorded by BHW staff · {fmtDateTime(alert.at)}
                </p>
              </div>
            ) : (
              <form onSubmit={handleAcknowledge}>
                <div>
                  <label className="ad-form-label">Follow-up note</label>
                  <textarea
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
                    disabled={saving}
                  >
                    {saving ? "Recording…" : "Record acknowledgement"}
                  </button>
                  <Link
                    to="/bhw/notifications"
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
            )}
          </div>
        </div>

        {/* ============ RIGHT: TIMELINE + NOTES ============ */}
        <div>
          {/* Alert timeline */}
          <div className="ad-panel">
            <h2 className="ad-panel__title">Alert timeline</h2>

            {timeline.map((t, i) => (
              <div className="ad-timeline-item" key={i}>
                <div>
                  <p className="ad-timeline__title">{t.title}</p>
                  <p className="ad-timeline__meta">{t.meta}</p>
                </div>
                <span className={`ad-timeline__tag ${t.tagClass}`}>
                  {t.tag}
                </span>
              </div>
            ))}
          </div>

          {/* Role-aware note */}
          <div className="ad-role-note">
            <strong>Role-aware next steps</strong>
            BHW records restock and maintenance. Chairman monitors aggregate
            alerts. Secretary (Admin) coordinates updates.
          </div>

          {/* Notification preferences button */}
          <Link to="/bhw/profile/notifications" className="ad-pref-btn">
            Notification preferences
          </Link>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ad-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
