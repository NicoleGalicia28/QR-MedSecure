import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./MachineMaintenance.css";

const ACTIVITY_TYPES = [
  "Inspection / Scheduled maintenance",
  "Routine inspection",
  "Corrective maintenance",
  "Firmware / software update",
  "Hardware replacement",
];

export default function MachineMaintenancePage() {
  const refresh = useApiRefresh();
  const session = getSession();
  const currentUser = {
    name: session ? `${session.firstName} ${session.lastName}` : "BHW Staff",
    role: session?.role || "BHW",
  };

  // Machine fleet — the first registered unit is the one being serviced.
  const machineQuery = useEndpoint("/machine", (res) => res.machines || []);
  const machine = (machineQuery.data || [])[0] || null;
  const machineCode = machine?.code || "";

  const inventoryQuery = useEndpoint("/inventory", (res) => res.items || []);
  const eventsQuery = useEndpoint(
    machineCode ? `/machine/${machineCode}/events` : "",
    (res) => res.events || [],
    { enabled: Boolean(machineCode) }
  );

  const lowItem = (inventoryQuery.data || []).find((i) =>
    String(i.status || "").toLowerCase().includes("low")
  );
  const events = eventsQuery.data || [];

  const [form, setForm] = useState({
    activityType: ACTIVITY_TYPES[0],
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !machineCode) return;
    setSubmitting(true);
    setNotice(null);

    const res = await sendApi(`/machine/${machineCode}/events`, {
      kind: form.activityType,
      note: form.note,
    });

    setSubmitting(false);
    if (!res.ok) {
      setNotice({ kind: "error", message: res.error });
      return;
    }
    setNotice({ kind: "success", message: "Maintenance event recorded." });
    setForm((prev) => ({ ...prev, note: "" }));
    await refresh(`/machine/${machineCode}/events`);
    await refresh(`/machine/${machineCode}`);
    await refresh("/machine");
  };

  return (
    <>
      {/* Back */}
      <Link to="/bhw/machine" className="maint-back">
        <ArrowLeft size={14} /> Machine monitoring
      </Link>

      {/* Header */}
      <div className="maint-header">
        <h1 className="maint-header__title">Update machine maintenance</h1>
        <p className="maint-header__subtitle">
          {machine?.code || "—"} · {machine?.name || "No device"} · Record
          service activity.
        </p>
      </div>

      {machineQuery.isLoading && !machineQuery.data ? (
        <Loading label="Loading machine…" />
      ) : machineQuery.error ? (
        <ErrorState
          message={machineQuery.error}
          onRetry={machineQuery.refetch}
        />
      ) : !machine ? (
        <EmptyState
          title="No machine registered"
          message="A dispensing unit has not been registered yet."
        />
      ) : (
        <div className="maint-layout">
          {/* ============ LEFT: FORM ============ */}
          <form onSubmit={handleSubmit}>
            <div className="maint-panel">
              <h2 className="maint-panel__title">Maintenance log</h2>
              <p className="maint-panel__subtitle">Required fields marked *</p>

              {/* Activity type */}
              <div className="maint-field">
                <label className="maint-label">
                  Activity type <span className="req">*</span>
                </label>
                <select
                  className="maint-select"
                  value={form.activityType}
                  onChange={(e) => update("activityType", e.target.value)}
                  required
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Work performed / notes */}
              <div className="maint-field">
                <label className="maint-label">Work performed / notes</label>
                <textarea
                  className="maint-textarea"
                  placeholder="Inspect feeder slots and clean dispensing tray. Confirm stock refill in the low slot separately."
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                />
              </div>

              {/* Received by */}
              <div className="maint-field">
                <label className="maint-label">Recorded by</label>
                <input
                  type="text"
                  className="maint-input"
                  value={`${currentUser.name} · ${currentUser.role}`}
                  readOnly
                />
              </div>

              {/* Feedback */}
              {notice ? (
                <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>
              ) : null}

              {/* Actions */}
              <div className="maint-actions">
                <button
                  type="submit"
                  className="maint-btn maint-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save maintenance update"}
                </button>
                <Link to="/bhw/machine" className="maint-btn maint-btn--outline">
                  Cancel
                </Link>
              </div>
            </div>
          </form>

          {/* ============ RIGHT: DEVICE SUMMARY ============ */}
          <div>
            {/* Device summary */}
            <div className="maint-panel">
              <h2 className="maint-panel__title">Device summary</h2>

              <span className="maint-healthy">{machine.status}</span>

              <div className="maint-summary-row">
                <div>
                  <p className="maint-summary__label">Device</p>
                  <p className="maint-summary__value">{machine.code}</p>
                </div>
              </div>

              <div className="maint-summary-row">
                <div>
                  <p className="maint-summary__label">Last check</p>
                  <p className="maint-summary__value maint-summary__value--muted">
                    {fmtDateTime(machine.lastHeartbeat) || "—"}
                  </p>
                </div>
              </div>

              <div className="maint-summary-row">
                <div>
                  <p className="maint-summary__label">Refill required</p>
                  <p className="maint-summary__value">
                    {lowItem
                      ? `${lowItem.slot} · ${lowItem.name}`
                      : "None below minimum"}
                  </p>
                </div>
              </div>
            </div>

            {/* Service record info */}
            <div className="maint-panel">
              <div className="maint-info">
                <strong>Service record only</strong>
                Saving this update documents maintenance. It does not operate
                the machine or certify a live safety check.
              </div>
            </div>

            {/* Recent maintenance */}
            <div className="maint-panel">
              <h2 className="maint-panel__title">Recent maintenance</h2>

              {eventsQuery.isLoading && !eventsQuery.data ? (
                <Loading label="Loading events…" />
              ) : eventsQuery.error ? (
                <ErrorState
                  message={eventsQuery.error}
                  onRetry={eventsQuery.refetch}
                />
              ) : events.length === 0 ? (
                <EmptyState
                  title="No maintenance events"
                  message="Logged events will appear here."
                />
              ) : (
                events.map((r) => (
                  <div className="maint-history-item" key={r.id}>
                    <p className="maint-history-item__title">{r.kind}</p>
                    <p className="maint-history-item__meta">
                      {fmtDateTime(r.at)}
                      {r.recordedBy ? ` · ${r.recordedBy}` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="maint-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
