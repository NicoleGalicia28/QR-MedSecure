import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardPlus, RefreshCw, Wrench, Wifi, WifiOff, Send } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import { iotApi, IOT_CONFIGURED, IOT_MACHINE_ID } from "../../lib/iotApi";
import "../admin/DashboardPage.css";
import "./MachineMonitoring.css";

export default function MachineMonitoringPage() {
  // Machine fleet - the first registered unit is the monitored device.
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

  // IoT (Django) API state - runs alongside Express for ESP32/device control
  const [iot, setIot] = useState({ status: "idle", inventory: [], error: null, lastChecked: null });
  const [cmd, setCmd] = useState({ type: "DISPENSE", channel: 1, sending: false, message: null });

  const refreshIot = useCallback(async () => {
    if (!IOT_CONFIGURED) {
      setIot((s) => ({ ...s, status: "unconfigured", error: null }));
      return;
    }
    setIot((s) => ({ ...s, status: "loading", error: null }));
    try {
      const inventory = await iotApi.getInventory();
      setIot({ status: "online", inventory: Array.isArray(inventory) ? inventory : [], error: null, lastChecked: new Date().toISOString() });
    } catch (e) {
      setIot({ status: "offline", inventory: [], error: e.message || "Cannot reach IoT API", lastChecked: new Date().toISOString() });
    }
  }, []);

  const sendIotCommand = useCallback(async () => {
    setCmd((c) => ({ ...c, sending: true, message: null }));
    try {
      const res = await iotApi.sendCommand({
        machine_id: machineCode || IOT_MACHINE_ID,
        command_type: cmd.type,
        motor_channel: Number(cmd.channel) || 1,
        parameters: null,
      });
      setCmd((c) => ({ ...c, sending: false, message: `Queued command #${res?.command_id ?? "?"} (${cmd.type})` }));
      refreshIot();
    } catch (e) {
      setCmd((c) => ({ ...c, sending: false, message: `Error: ${e.message}` }));
    }
  }, [cmd.type, cmd.channel, machineCode, refreshIot]);

  const refreshAll = useCallback(() => {
    machineQuery.refetch();
    inventoryQuery.refetch();
    eventsQuery.refetch();
    refreshIot();
  }, [machineQuery.refetch, inventoryQuery.refetch, eventsQuery.refetch, refreshIot]);

  // Poll endpoints every 15 seconds for fresh telemetry.
  useEffect(() => {
    refreshIot();
    const timer = setInterval(refreshAll, 15_000);
    return () => clearInterval(timer);
  }, [refreshAll, refreshIot]);

  const invItems = inventoryQuery.data || [];
  const slots = ["A", "B", "C"].map((slotKey) => {
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
  });
  const events = eventsQuery.data || [];

  const isLoading = machineQuery.isLoading && !machineQuery.data;
  const error = machineQuery.error;
  const isFetching = machineQuery.isFetching || inventoryQuery.isFetching || eventsQuery.isFetching;

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="mm-header">
        <div>
          <h1 className="mm-header__title">Dispensing machine monitoring</h1>
          <p className="mm-header__subtitle">
            BHW — {machine?.code || "—"} — {machine?.name || "No device"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="mm-log-btn" onClick={refreshAll} disabled={isFetching}>
            <RefreshCw size={15} strokeWidth={2.5} />
            {isFetching ? "Refreshing..." : "Refresh"}
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
        Health, stock and event history below are read from the server and refresh automatically every 15 seconds.
        The IoT Device API panel connects to the Django service ({iotApi.base}) for ESP32 commands and machine inventory.
      </div>

      {isLoading ? (
        <Loading label="Loading machine..." />
      ) : error ? (
        <ErrorState message={error} onRetry={machineQuery.refetch} />
      ) : !machine ? (
        <EmptyState title="No machine registered" message="A dispensing unit has not been registered yet." />
      ) : (
        <>
          {/* ---------- KPI CARDS ---------- */}
          <div className="mm-kpi-grid">
            <div className="mm-kpi">
              <p className="mm-kpi__label">Device condition</p>
              <p className="mm-kpi__value mm-kpi__value--healthy">{machine.status}</p>
              <p className="mm-kpi__hint">Last heartbeat — {fmtDateTime(machine.lastHeartbeat) || "—"}</p>
            </div>

            <div className="mm-kpi">
              <p className="mm-kpi__label">Stock slots</p>
              <p className="mm-kpi__value">{slots.length} of {slots.length}</p>
              <p className="mm-kpi__hint">No stock assigned yet</p>
            </div>

            <div className="mm-kpi">
              <p className="mm-kpi__label">IoT API</p>
              <p className="mm-kpi__value" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16 }}>
                {iot.status === "online" ? <Wifi size={16} /> : <WifiOff size={16} />}
                {iot.status === "online" ? "Connected" : iot.status === "unconfigured" ? "Not configured" : iot.status === "loading" ? "Checking..." : "Offline"}
              </p>
              <p className="mm-kpi__hint">{IOT_CONFIGURED ? iotApi.base : "Set VITE_IOT_API_URL/KEY"}</p>
            </div>
          </div>

          {/* ---------- TWO-COLUMN LAYOUT ---------- */}
          <div className="mm-layout">
            {/* ============ LEFT COLUMN ============ */}
            <div>
              <div className="mm-panel">
                <h2 className="mm-panel__title">Slot stock &amp; condition</h2>
                <p className="mm-panel__subtitle">Machine quantities are included in total medicine inventory.</p>

                {(inventoryQuery.isLoading || machineQuery.isLoading) && !(inventoryQuery.data || machineQuery.data) ? (
                  <Loading label="Loading slots..." />
                ) : inventoryQuery.error || machineQuery.error ? (
                  <ErrorState message={inventoryQuery.error || machineQuery.error} onRetry={refreshAll} />
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
                              <span className="mm-pill mm-pill--refill">Refill needed</span>
                            ) : (
                              <span className="mm-pill mm-pill--ready">Ready</span>
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
                    <button type="button" disabled>&lt;</button>
                    <button type="button">1</button>
                    <button type="button" disabled>&gt;</button>
                  </div>
                </div>
              </div>

              <div className="mm-panel">
                <h2 className="mm-panel__title">Update &amp; maintenance history</h2>

                {eventsQuery.isLoading && !eventsQuery.data ? (
                  <Loading label="Loading events..." />
                ) : eventsQuery.error ? (
                  <ErrorState message={eventsQuery.error} onRetry={eventsQuery.refetch} />
                ) : events.length === 0 ? (
                  <EmptyState title="No maintenance events" message="Logged events will appear here." />
                ) : (
                  events.map((e) => (
                    <div className="mm-history-item" key={e.id}>
                      <div>
                        <p className="mm-history-item__title">{e.kind}</p>
                        <p className="mm-history-item__meta">
                          {fmtDateTime(e.at)}
                          {e.recordedBy ? ` — ${e.recordedBy}` : ""}
                          {e.note ? ` — ${e.note}` : ""}
                        </p>
                      </div>
                      <span className="mm-history-item__tag">{e.kind}</span>
                    </div>
                  ))
                )}
              </div>

              {/* IoT Device API (Django) - ESP32 inventory & command queue */}
              <div className="mm-panel">
                <h2 className="mm-panel__title">IoT Device API (ESP32)</h2>
                <p className="mm-panel__subtitle">
                  Connected to Django IoT service for machine inventory, command queue, and ESP32 polling.
                  Machine ID: <strong>{machineCode || IOT_MACHINE_ID}</strong>
                </p>

                {!IOT_CONFIGURED ? (
                  <EmptyState
                    title="IoT API not configured"
                    message="Set VITE_IOT_API_URL and VITE_IOT_API_KEY in .env, then restart the dev server."
                  />
                ) : iot.status === "loading" && iot.inventory.length === 0 ? (
                  <Loading label="Connecting to IoT API..." />
                ) : iot.status === "offline" ? (
                  <ErrorState
                    message={iot.error || "Cannot reach IoT API"}
                    onRetry={refreshIot}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
                      Last checked: {fmtDateTime(iot.lastChecked) || "—"} · {iot.inventory.length} inventory item(s)
                    </div>
                    {iot.inventory.length === 0 ? (
                      <EmptyState title="No IoT inventory" message="No medicine inventory found in the Django IoT database." />
                    ) : (
                      <table className="mm-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Medicine</th>
                            <th>Stock</th>
                            <th>Batch</th>
                          </tr>
                        </thead>
                        <tbody>
                          {iot.inventory.map((item) => (
                            <tr key={item.id}>
                              <td>{item.id}</td>
                              <td className="mm-table__med">{item.medicine_name}</td>
                              <td>{item.stock_quantity}</td>
                              <td>{item.batch_number || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
                      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>Send command (ESP32 queue)</p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          value={cmd.type}
                          onChange={(e) => setCmd((c) => ({ ...c, type: e.target.value }))}
                          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                        >
                          <option value="DISPENSE">DISPENSE</option>
                          <option value="REFILL">REFILL</option>
                          <option value="CALIBRATE">CALIBRATE</option>
                          <option value="TEST_IR">TEST_IR</option>
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={cmd.channel}
                          onChange={(e) => setCmd((c) => ({ ...c, channel: e.target.value }))}
                          placeholder="Motor channel"
                          style={{ width: 120, padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
                        />
                        <button type="button" className="mm-log-btn" onClick={sendIotCommand} disabled={cmd.sending || iot.status === "offline"}>
                          <Send size={14} /> {cmd.sending ? "Sending..." : "Queue command"}
                        </button>
                      </div>
                      {cmd.message ? <p style={{ margin: "8px 0 0", fontSize: 12, color: cmd.message.startsWith("Error") ? "#b91c1c" : "#166534" }}>{cmd.message}</p> : null}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ============ RIGHT COLUMN ============ */}
            <div>
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
                  <p className="mm-detail__value">{fmtDateTime(machine.lastHeartbeat) || "—"}</p>
                </div>

                <Link to="/bhw/restock" className="mm-detail__btn">
                  <Wrench size={13} /> View restock panel
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mm-page-footer">
        <span>QR-MedSecure — Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
