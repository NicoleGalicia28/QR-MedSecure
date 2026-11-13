import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardPlus, RefreshCw, Wrench, Wifi, WifiOff, Send } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtDateTime } from "./apiFormat";
import { iotApi, IOT_CONFIGURED, IOT_MACHINE_ID } from "../../lib/iotApi";
import "../admin/DashboardPage.css";
import "./MachineMonitoring.css";

// Only motor 1 is wired/working on the current prototype. All three medicine
// slots are served by that motor, so every command uses this channel.
const MOTOR_CHANNEL = 1;
const MACHINE_SLOTS = [
  { slot: "A", medicine: "Losartan 50 mg" },
  { slot: "B", medicine: "Metformin 500 mg" },
  { slot: "C", medicine: "Amlodipine 5 mg" },
];

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
  const [iotCmd, setIotCmd] = useState({ sending: false, message: null });

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

  const sendIotCommand = useCallback(
    async ({ type, label = "" }) => {
      setIotCmd({ sending: true, message: null });
      try {
        const res = await iotApi.sendCommand({
          // Must match the firmware's machineId (MSv1M-001), not the Express device code.
          machine_id: IOT_MACHINE_ID,
          command_type: type,
          motor_channel: MOTOR_CHANNEL,
          parameters: "",
        });
        // Django returns { status, message, data: { id, ... } }.
        const id = res?.data?.id ?? res?.command_id ?? "?";
        setIotCmd({
          sending: false,
          message: `Queued command #${id} — ${type}${label ? ` · ${label}` : ""} (motor ${MOTOR_CHANNEL})`,
        });
        refreshIot();
      } catch (e) {
        setIotCmd({ sending: false, message: `Error: ${e.message}` });
      }
    },
    [refreshIot]
  );

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
                  Django IoT service · machine <strong>{IOT_MACHINE_ID}</strong> ·
                  only <strong>motor {MOTOR_CHANNEL}</strong> is wired on this prototype.
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
                    <div className="mm-iot-meta">
                      Last checked: {fmtDateTime(iot.lastChecked) || "—"}
                    </div>

                    {/* Medicine slots — all three are served by motor 1 */}
                    <p className="mm-iot-title">Medicine slots</p>
                    <p className="mm-iot-hint">
                      Only motor {MOTOR_CHANNEL} is working. Each slot queues a
                      DISPENSE command on channel {MOTOR_CHANNEL}.
                    </p>
                    <table className="mm-table">
                      <thead>
                        <tr>
                          <th>Slot</th>
                          <th>Medicine</th>
                          <th>Motor</th>
                          <th style={{ textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MACHINE_SLOTS.map((s) => (
                          <tr key={s.slot}>
                            <td className="mm-table__slot">{s.slot}</td>
                            <td className="mm-table__med">{s.medicine}</td>
                            <td>Motor {MOTOR_CHANNEL}</td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                type="button"
                                className="mm-log-btn mm-log-btn--sm"
                                onClick={() =>
                                  sendIotCommand({
                                    type: "DISPENSE",
                                    label: `${s.medicine} · slot ${s.slot}`,
                                  })
                                }
                                disabled={iotCmd.sending || iot.status === "offline"}
                              >
                                <Send size={13} /> {iotCmd.sending ? "Sending..." : "Dispense"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Maintenance commands */}
                    <p className="mm-iot-title" style={{ marginTop: 18 }}>
                      Maintenance
                    </p>
                    <div className="mm-iot-actions">
                      <button
                        type="button"
                        className="mm-log-btn mm-log-btn--outline"
                        onClick={() =>
                          sendIotCommand({ type: "CALIBRATE", label: `motor ${MOTOR_CHANNEL}` })
                        }
                        disabled={iotCmd.sending || iot.status === "offline"}
                      >
                        <Wrench size={14} /> Calibrate motor {MOTOR_CHANNEL}
                      </button>
                      <button
                        type="button"
                        className="mm-log-btn mm-log-btn--outline"
                        onClick={() => sendIotCommand({ type: "REFILL", label: "refill" })}
                        disabled={iotCmd.sending || iot.status === "offline"}
                      >
                        <RefreshCw size={14} /> Refill
                      </button>
                    </div>

                    {iotCmd.message ? (
                      <p
                        className={
                          "mm-iot-msg " +
                          (iotCmd.message.startsWith("Error")
                            ? "mm-iot-msg--error"
                            : "mm-iot-msg--ok")
                        }
                      >
                        {iotCmd.message}
                      </p>
                    ) : null}

                    {/* Django inventory (empty by design until stocked) */}
                    {iot.inventory.length > 0 ? (
                      <>
                        <p className="mm-iot-title" style={{ marginTop: 18 }}>
                          IoT inventory
                        </p>
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
                      </>
                    ) : null}
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
