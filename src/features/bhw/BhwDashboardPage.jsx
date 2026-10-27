import { QrCode, ArrowRight, Package, ClipboardList, Pill, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getSession } from "../auth/authStore";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtTime, fmtDate, fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./BhwDashboard.css";

export default function BhwDashboardPage() {
  const user = getSession();
  const firstName = user?.firstName || "BHW";

  // Live KPIs + machine snapshot from the BHW dashboard endpoint.
  const dashboard = useEndpoint("/bhw/dashboard", (res) => res);
  // Records are saved as soon as the form is filled in, so the dashboard shows
  // the most recently recorded clinical entries.
  const recentRecords = useEndpoint("/bhw/recent-records?limit=8", (res) => res.records || []);
  // Device state comes from the machine fleet endpoint.
  const machines = useEndpoint("/machine", (res) => res.machines || []);
  const inventory = useEndpoint("/inventory", (res) => res.items || []);
  const recent = useEndpoint("/transactions", (res) => res.transactions || []);
  const updates = useEndpoint("/notifications", (res) => res.notifications || []);
  // Registered beneficiaries, newest first, with their clinical record count.
  const beneficiaries = useEndpoint("/beneficiaries", (res) => res.beneficiaries || []);

  const kpis = dashboard.data?.kpis || [];
  const machine = machines.data?.[0] || dashboard.data?.machine || null;
  const lowItems = (inventory.data || []).filter((i) =>
    String(i.status || "").toLowerCase().includes("low")
  );
  const recentRows = (recent.data || []).slice(0, 4);
  const recordRows = (recentRecords.data || []).slice(0, 4);
  const updateRows = (updates.data || []).slice(0, 3);
  const beneficiaryRows = (beneficiaries.data || []).slice(0, 5);
  const withoutRecord = (beneficiaries.data || []).filter(
    (b) => Number(b.recordsCount || 0) === 0
  ).length;

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="dash-header">
        <div>
          <h1 className="dash-header__title">Good morning, {firstName}</h1>
          <p className="dash-header__subtitle">
            BHW workspace · Barangay 354 Tayuman Health Center
          </p>
        </div>
        <Link to="/bhw/scan-dispense" className="bhw-scan-btn">
          <QrCode size={15} strokeWidth={2.5} />
          Scan &amp; dispense
        </Link>
      </div>

      {/* ---------- KPI CARDS ---------- */}
      {dashboard.isLoading && !dashboard.data ? (
        <Loading label="Loading dashboard…" />
      ) : dashboard.error ? (
        <ErrorState message={dashboard.error} onRetry={dashboard.refetch} />
      ) : (
        <div className="kpi-grid">
          {kpis.map((k) => (
            <div className="kpi-card" key={k.label}>
              <p className="kpi-card__label">{k.label}</p>
              <p className="kpi-card__value">{k.value}</p>
              <p className="kpi-card__hint">{k.hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---------- RESTOCK BANNER ---------- */}
      {lowItems.length > 0 && (
        <div className="bhw-restock-banner">
          <strong>
            {lowItems.length} medicine{lowItems.length === 1 ? "" : "s"} need
            restocking
          </strong>
          <br />
          {lowItems
            .map((i) => `${i.name}: ${i.stock} ${i.unit}`)
            .join(" · ")}
          . Check available supplies before confirming a dispensing request.
        </div>
      )}

      {/* ---------- MAIN GRID ---------- */}
      <div className="dash-grid">
        {/* ---------- LEFT COLUMN ---------- */}
        <div>
          {/* Beneficiaries — recently registered, newest first */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Beneficiaries</h2>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "#6b7280",
                    margin: "4px 0 0",
                  }}
                >
                  Recently registered · newest first
                </p>
              </div>
              <Link to="/bhw/beneficiaries" className="panel__link">
                All beneficiaries <ArrowRight size={13} />
              </Link>
            </div>

            {beneficiaries.isLoading && !beneficiaries.data ? (
              <Loading label="Loading beneficiaries…" />
            ) : beneficiaries.error ? (
              <ErrorState
                message={beneficiaries.error}
                onRetry={beneficiaries.refetch}
              />
            ) : beneficiaryRows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No beneficiaries registered yet"
                message="Newly registered beneficiaries appear here so you can open or create their medical record."
              />
            ) : (
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Beneficiary</th>
                    <th>Program</th>
                    <th>Registered</th>
                    <th>Medical record</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {beneficiaryRows.map((b) => {
                    const count = Number(b.recordsCount || 0);
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link
                            to={`/bhw/beneficiaries/${b.publicId}`}
                            className="rec-table__name"
                          >
                            {b.name}
                          </Link>
                          <div className="rec-table__sub">{b.publicId}</div>
                        </td>
                        <td>{b.program || "General"}</td>
                        <td>{fmtDate(b.createdAt) || "—"}</td>
                        <td>
                          {count > 0 ? (
                            <span className="status-pill status-pill--active">
                              • {count} record{count > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="status-pill status-pill--review">
                              • None yet
                            </span>
                          )}
                        </td>
                        <td>
                          {count > 0 ? (
                            <Link
                              to={`/bhw/beneficiaries/${b.publicId}`}
                              className="rec-table__action"
                            >
                              Open
                            </Link>
                          ) : (
                            <Link
                              to={`/bhw/beneficiaries/${b.publicId}/clinical/new`}
                              className="rec-table__action"
                            >
                              Add record
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="rec-footer">
              <span>
                Latest {beneficiaryRows.length} of{" "}
                {(beneficiaries.data || []).length} beneficiary(ies) ·{" "}
                {withoutRecord} without a medical record
              </span>
              <Link to="/bhw/beneficiaries" className="panel__link">
                See all <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Recent dispensing */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Recent dispensing</h2>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "#6b7280",
                    margin: "4px 0 0",
                  }}
                >
                  Confirmed by authorized BHW staff
                </p>
              </div>
              <Link to="/bhw/transactions" className="panel__link">
                View transactions <ArrowRight size={13} />
              </Link>
            </div>

            {recent.isLoading && !recent.data ? (
              <Loading label="Loading transactions…" />
            ) : recent.error ? (
              <ErrorState message={recent.error} onRetry={recent.refetch} />
            ) : recentRows.length === 0 ? (
              <EmptyState
                title="No dispensing yet"
                message="Confirmed releases will appear here."
              />
            ) : (
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Beneficiary</th>
                    <th>Medicine / quantity</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((t) => (
                    <tr key={t.id}>
                      <td className="rec-table__name">{t.beneficiary}</td>
                      <td>
                        {t.medicine} · {t.quantity}
                      </td>
                      <td>{fmtTime(t.at)}</td>
                      <td>
                        <span className="status-pill status-pill--active">
                          • {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="rec-footer">
              <span>
                Latest {recentRows.length} of {(recent.data || []).length}{" "}
                transaction(s)
              </span>
              <Link to="/bhw/transactions" className="panel__link">
                See all <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Recent clinical records */}
          <div className="panel">
            <div className="panel__header">
              <div>
                <h2 className="panel__title">Recent clinical records</h2>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "#6b7280",
                    margin: "4px 0 0",
                  }}
                >
                  Saved automatically once the form is completed
                </p>
              </div>
              <Link to="/bhw/clinical-records" className="panel__link">
                All records <ArrowRight size={13} />
              </Link>
            </div>

            {recentRecords.isLoading && !recentRecords.data ? (
              <Loading label="Loading clinical records…" />
            ) : recentRecords.error ? (
              <ErrorState
                message={recentRecords.error}
                onRetry={recentRecords.refetch}
              />
            ) : recordRows.length === 0 ? (
              <EmptyState
                title="No clinical records yet"
                message="Records you enter from a beneficiary's profile appear here."
              />
            ) : (
              <div>
                {recordRows.map((r) => (
                  <div className="alert-item" key={r.id}>
                    <div>
                      <p className="alert-item__title">{r.beneficiary}</p>
                      <p className="alert-item__desc">
                        {r.type} · {r.code} · {fmtDateTime(r.recordedAt)}
                      </p>
                    </div>
                    <Link
                      to={`/bhw/clinical-records/${r.id}`}
                      className="panel__link"
                    >
                      Open <ArrowRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            )}

            <div className="rec-footer">
              <span>
                Latest {recordRows.length} of{" "}
                {(recentRecords.data || []).length} clinical record(s)
              </span>
              <Link to="/bhw/clinical-records" className="panel__link">
                See all <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Task shortcuts */}
          <div className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Task shortcuts</h2>
            </div>
            <div className="task-shortcuts">
              <Link to="/bhw/beneficiaries" className="task-shortcut-btn">
                <Users size={14} /> Beneficiaries
              </Link>
              <Link to="/bhw/inventory" className="task-shortcut-btn">
                <Package size={14} /> View inventory
              </Link>
              <Link to="/bhw/clinical-records" className="task-shortcut-btn">
                <ClipboardList size={14} /> Clinical records
              </Link>
              <Link to="/bhw/restock" className="task-shortcut-btn">
                <Pill size={14} /> Medicine restock
              </Link>
            </div>
          </div>
        </div>

        {/* ---------- RIGHT COLUMN ---------- */}
        <div>
          {/* Machine status */}
          <div className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Machine status</h2>
              <Link to="/bhw/machine" className="panel__link">
                Monitor <ArrowRight size={13} />
              </Link>
            </div>

            {machines.isLoading && !machines.data ? (
              <Loading label="Loading machine…" />
            ) : machines.error ? (
              <ErrorState message={machines.error} onRetry={machines.refetch} />
            ) : !machine ? (
              <EmptyState
                title="No machine registered"
                message="Device state will appear once a unit is registered."
              />
            ) : (
              <>
                <p className="machine-status__healthy">{machine.status}</p>

                <p className="machine-status__device">Device</p>
                <p className="machine-status__row">
                  <span>
                    {machine.id || machine.code} · {machine.name || "—"}
                  </span>
                </p>

                <p className="machine-status__device" style={{ marginTop: 12 }}>
                  Last check
                </p>
                <p className="machine-status__row">
                  <span>{fmtDateTime(machine.lastHeartbeat) || "—"}</span>
                </p>

                <p className="machine-status__device" style={{ marginTop: 12 }}>
                  Refill needed
                </p>
                <p className="machine-status__row">
                  <span>
                    {lowItems[0]
                      ? `${lowItems[0].slot} · ${lowItems[0].name}`
                      : "None"}
                  </span>
                </p>
              </>
            )}
          </div>

          {/* Updates */}
          <div className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Updates</h2>
              <Link to="/bhw/notifications" className="panel__link">
                See all <ArrowRight size={13} />
              </Link>
            </div>

            {updates.isLoading && !updates.data ? (
              <Loading label="Loading updates…" />
            ) : updates.error ? (
              <ErrorState message={updates.error} onRetry={updates.refetch} />
            ) : updateRows.length === 0 ? (
              <EmptyState
                title="No updates"
                message="Stock and system notifications will appear here."
              />
            ) : (
              updateRows.map((n) => (
                <div className="alert-item" key={n.id}>
                  <div>
                    <p className="alert-item__title">{n.title}</p>
                    <p className="alert-item__desc">
                      {n.body || fmtDateTime(n.at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="dash-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
