import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ClipboardPlus, RefreshCw, Wrench } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./MachineMonitoring.css";

export default function MachineMonitoringPage() {
  // Machine fleet — the first registered unit is the monitored device.
  const machineQuery = useEndpoint("/machine", (res) => res.machines || []);
  const machine = (machineQuery.data || [])[0] || null;
  const machineCode = machine?.code || "";

  // Live slot stock comes from the inventory, events from the machine log.
  const inventoryQuery = useEndpoint("/inventory", (res) => res.items || []);
  const eventsQuery = useEndpoint(
    machineCode ? `/machine/${machineCode}/events` : "",
    (res) => res.events || [],
    { enabled: Boolean(machineCode) }
  );

  const refreshAll = useCallback(() => {
    machineQuery.refetch();
    inventoryQuery.refetch();
    eventsQuery.refetch();
  }, [machineQuery.refetch, inventoryQuery.refetch, eventsQuery.refetch]);

  // No websockets: poll the endpoints every 15 seconds for fresh telemetry.
  useEffect(() => {
    const timer = setInterval(refreshAll, 15_000);
    return () => clearInterval(timer);
  }, [refreshAll]);

  const invItems = inventoryQuery.data || [];
  const slots = (["A", "B", "C"].map((slotKey) => {
    const found = invItems.find(
      (i) => String(i.slot || "").replace(/^Slot\s*/i, "").toUpperCase() === slotKey
    );
    return {
      slot: slotKey,
      medicine: found?.name || "—",
      quantity: "—",
      threshold: "—",
      condition: "ready",
    };
  }));
  const refillSlots = [];
  const events = eventsQuery.data || [];

  const isLoading = machineQuery.isLoading && !machineQuery.data;
  const error = machineQuery.error;

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="mm-header">
        <div>
          <h1 className="mm-header__title">Dispensing machine monitoring</h1>
          <p className="mm-header__subtitle">
            BHW · {machine?.code || "—"} · {machine?.name || "No device"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="mm-log-btn"
            onClick={refreshAll}
            disabled={machineQuery.isFetching || inventoryQuery.isFetching || eventsQuery.isFetching}
          >
            <RefreshCw size={15} strokeWidth={2.5} />
            {(machineQuery.isFetching || inventoryQuery.isFetching || eventsQuery.isFetching) ? "Refreshing…" : "Refresh"}
          </button>
          <Link to="/bhw/machine/maintenance" className="mm-log-btn">
            <ClipboardPlus size={15} strokeWidth={2.5} />
            Log maintenance update
          </Link>
        </div>
      </div>

      {/* ---------- INFO BANNER ---------- */}
      <div className="mm-info-banner">
        <strong>Live device telemetry</strong>
        Health, stock and event history below are read from the server and
        refresh automatically every 15 seconds.
      </div>

      {isLoading ? (
        <Loading label="Loading machine…" />
      ) : error ? (
        <ErrorState message={error} onRetry={machineQuery.refetch} />
      ) : !machine ? (
        <EmptyState
          title="No machine registered"
          message="A dispensing unit has not been registered yet."
        />
      ) : (
        <>
          {/* ---------- KPI CARDS ---------- */}
          <div className="mm-kpi-grid">
            <div className="mm-kpi">
              <p className="mm-kpi__label">Device condition</p>
              <p className="mm-kpi__value mm-kpi__value--healthy">
                {machine.status}
              </p>
              <p className="mm-kpi__hint">
                Last heartbeat · {fmtDateTime(machine.lastHeartbeat) || "—"}
              </p>
            </div>

            <div className="mm-kpi">
              <p className="mm-kpi__label">Stock slots</p>
              <p className="mm-kpi__value">
                {slots.length} of {slots.length}
              </p>
              <p className="mm-kpi__hint">No stock assigned yet</p>
            </div>

            <div className="mm-kpi">
              <p className="mm-kpi__label">Stock alert</p>
              <p className="mm-kpi__value mm-kpi__value--healthy">
                No stock
              </p>
              <p className="mm-kpi__hint">No medicine assigned yet</p>
            </div>
          </div>

          {/* ---------- TWO-COLUMN LAYOUT ---------- */}
          <div className="mm-layout">
            {/* ============ LEFT COLUMN ============ */}
            <div>
              {/* Slot stock & condition */}
              <div className="mm-panel">
                <h2 className="mm-panel__title">Slot stock &amp; condition</h2>
                <p className="mm-panel__subtitle">
                  Machine quantities are included in total medicine inventory.
                </p>

                {(inventoryQuery.isLoading || machineQuery.isLoading) && !(inventoryQuery.data || machineQuery.data) ? (
                  <Loading label="Loading slots…" />
                ) : inventoryQuery.error || machineQuery.error ? (
                  <ErrorState
                    message={inventoryQuery.error || machineQuery.error}
                    onRetry={refreshAll}
                  />
                ) : (
                  <table className="mm-table">
                    <thead>
                      <tr>
                        <th>Slot</th>
                        <th>Medicine</th>
                        <th>Quantity</th>
                        <th>Refill threshold</th>
                        <th>Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((s, i) => (
                        <tr key={`${s.slot}-${i}`}>
                          <td className="mm-table__slot">{s.slot}</td>
                          <td className="mm-table__med">{s.medicine}</td>
                          <td>{s.quantity}</td>
                          <td>{s.threshold}</td>
                          <td>
                            {s.condition === "refill" ? (
                              <span className="mm-pill mm-pill--refill">
                                • Refill needed
                              </span>
                            ) : (
                              <span className="mm-pill mm-pill--ready">
                                • Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mm-footer">
                  <span>0 slot(s) with assigned stock</span>
                  <div className="mm-pagination">
                    <button type="button" disabled>
                      ‹
                    </button>
                    <button type="button">1</button>
                    <button type="button" disabled>
                      ›
                    </button>
                  </div>
                </div>
              </div>

              {/* Update & maintenance history */}
              <div className="mm-panel">
                <h2 className="mm-panel__title">
                  Update &amp; maintenance history
                </h2>

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
                  events.map((e) => (
                    <div className="mm-history-item" key={e.id}>
                      <div>
                        <p className="mm-history-item__title">{e.kind}</p>
                        <p className="mm-history-item__meta">
                          {fmtDateTime(e.at)}
                          {e.recordedBy ? ` · ${e.recordedBy}` : ""}
                          {e.note ? ` · ${e.note}` : ""}
                        </p>
                      </div>
                      <span className="mm-history-item__tag">• {e.kind}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ============ RIGHT COLUMN ============ */}
            <div>
              {/* Refill warning */}

              {/* Device details */}
              <div className="mm-panel">
                <h2 className="mm-panel__title">Device details</h2>

                <div className="mm-detail-row">
                  <p className="mm-detail__label">Device ID</p>
                  <p className="mm-detail__value">{machine.code}</p>
                </div>

                <div className="mm-detail-row">
                  <p className="mm-detail__label">Status</p>
                  <p className="mm-detail__value">{machine.status}</p>
                </div>

                <div className="mm-detail-row">
                  <p className="mm-detail__label">Firmware</p>
                  <p className="mm-detail__value">{machine.firmware}</p>
                </div>

                <div className="mm-detail-row">
                  <p className="mm-detail__label">Door</p>
                  <p className="mm-detail__value">{machine.door || "—"}</p>
                </div>

                <div className="mm-detail-row">
                  <p className="mm-detail__label">Last heartbeat</p>
                  <p className="mm-detail__value">
                    {fmtDateTime(machine.lastHeartbeat) || "—"}
                  </p>
                </div>

                <Link to="/bhw/restock" className="mm-detail__btn">
                  <Wrench size={13} /> View restock panel
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="mm-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
