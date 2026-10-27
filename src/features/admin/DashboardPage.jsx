import {
  Plus,
  Search,
  IdCard,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getSession } from "../auth/authStore";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import "./DashboardPage.css";

// ---- select helpers: map API payloads onto the render shapes ---------------
// GET /dashboard → { kpis: [{ label, value, hint }] }
const selectKpis = (res) => (Array.isArray(res.kpis) ? res.kpis : []);

// GET /beneficiaries → recent rows for the "Recently updated" table.
const selectRecent = (res) => {
  const rows = Array.isArray(res.beneficiaries) ? res.beneficiaries : [];
  return rows.slice(0, 4).map((b) => ({
    name: `${b.firstName || ""} ${b.lastName || ""}`.trim() || "—",
    id: b.publicId || "—",
    area: b.area || "—",
    // Only "active" records get the active pill; anything else is flagged
    // for review so the pill/action columns always render.
    status: String(b.status).toLowerCase() === "active" ? "active" : "review",
  }));
};

// GET /notifications → role-scoped alerts for the "Alerts & updates" panel.
const selectAlerts = (res) => {
  const rows = Array.isArray(res.notifications) ? res.notifications : [];
  return rows.slice(0, 6).map((n) => {
    const tag =
      n.kind === "stock" || n.kind === "device"
        ? { tag: "Monitor", tagClass: "alert-tag--monitor" }
        : { tag: "Update", tagClass: "alert-tag--update" };
    return { id: n.id, title: n.title, desc: n.body, tag: tag.tag, tagClass: tag.tagClass };
  });
};

export default function DashboardPage() {
  const user = getSession();
  const adminName = user ? `${user.firstName} ${user.lastName}` : "Barangay Admin";

  // Live data from the backend — no offline fallbacks.
  const kpisQuery = useEndpoint("/dashboard", selectKpis);
  const recentQuery = useEndpoint("/beneficiaries", selectRecent);
  const alertsQuery = useEndpoint("/notifications", selectAlerts);

  const kpis = kpisQuery.data ?? [];
  const recentRecords = recentQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="dash-header">
        <div>
          <h1 className="dash-header__title">Records management overview</h1>
          <p className="dash-header__subtitle">
            Secretary (Admin) workspace · {adminName} · Records, QR/ID creation,
            reports, and staff/user role administration.
          </p>
        </div>
        <Link to="/admin/beneficiaries/new" className="dash-btn-primary">
          <Plus size={15} strokeWidth={2.5} />
          Add beneficiary
        </Link>
      </div>

      {/* ---------- TABS ---------- */}
      <div className="dash-tabs">
        <span className="dash-tab dash-tab--active">
          Secretary (Admin) · Current role
        </span>
      </div>

      {/* ---------- KPI CARDS ---------- */}
      {kpisQuery.isLoading ? (
        <Loading label="Loading dashboard…" />
      ) : kpisQuery.error ? (
        <ErrorState
          message={kpisQuery.error}
          onRetry={kpisQuery.refetch}
        />
      ) : kpis.length === 0 ? (
        <EmptyState title="No dashboard figures yet" message="KPIs appear once the server has data." />
      ) : (
        <div className="kpi-grid">
          {kpis.map((kpi) => (
            <div className="kpi-card" key={kpi.label}>
              <p className="kpi-card__label">{kpi.label}</p>
              <p className="kpi-card__value">{kpi.value}</p>
              <p className="kpi-card__hint">{kpi.hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---------- TWO COLUMN GRID ---------- */}
      <div className="dash-grid">
        {/* ---- LEFT COLUMN ---- */}
        <div>
          {/* Recently updated records */}
          <div className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Recently updated records</h2>
              <Link to="/admin/beneficiaries" className="panel__link">
                Open registry <ArrowRight size={13} />
              </Link>
            </div>

            {recentQuery.isLoading ? (
              <Loading label="Loading recent records…" />
            ) : recentQuery.error ? (
              <ErrorState message={recentQuery.error} onRetry={recentQuery.refetch} />
            ) : recentRecords.length === 0 ? (
              <EmptyState
                title="No beneficiary records yet"
                message="Registered beneficiaries will appear here."
                action={
                  <Link to="/admin/beneficiaries/new" className="panel__link">
                    Add the first beneficiary <ArrowRight size={12} />
                  </Link>
                }
              />
            ) : (
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Beneficiary</th>
                    <th>Beneficiary ID</th>
                    <th>Area</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="rec-table__name">{r.name}</td>
                      <td>{r.id}</td>
                      <td>{r.area}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        <Link to={`/admin/beneficiaries/${r.id}`} className="rec-table__action">
                          {r.status === "review" ? "Review record" : "View / Edit"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="rec-footer">
              <span>
                Latest {recentRecords.length} record
                {recentRecords.length === 1 ? "" : "s"} · loaded from the registry
              </span>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Records workspace shortcuts</h2>
            </div>

            <div className="shortcut-row">
              <Link to="/admin/beneficiaries" className="shortcut-btn">
                <Search size={14} /> Beneficiary registry
              </Link>
              <Link to="/admin/ids" className="shortcut-btn">
                <IdCard size={14} /> Generate QR / ID
              </Link>
              <Link to="/admin/reports" className="shortcut-btn">
                <BarChart3 size={14} /> Statistics & reports
              </Link>
            </div>

            <div className="shortcut-links">
              <Link to="/admin/transactions">
                View transactions <ArrowRight size={12} />
              </Link>
              <Link to="/admin/beneficiaries?tab=history">
                View medical history <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* ---- RIGHT COLUMN ---- */}
        <div>
          {/* Alerts */}
          <div className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Alerts &amp; updates</h2>
              <Link to="/admin/notifications" className="panel__link">
                Notifications <ArrowRight size={13} />
              </Link>
            </div>

            {alertsQuery.isLoading ? (
              <Loading label="Loading alerts…" />
            ) : alertsQuery.error ? (
              <ErrorState message={alertsQuery.error} onRetry={alertsQuery.refetch} />
            ) : alerts.length === 0 ? (
              <EmptyState title="No alerts" message="Stock, device and system alerts appear here." />
            ) : (
              alerts.map((a) => (
                <div className="alert-item" key={a.id}>
                  <div>
                    <p className="alert-item__title">{a.title}</p>
                    <p className="alert-item__desc">{a.desc}</p>
                  </div>
                  <span className={"alert-tag " + a.tagClass}>• {a.tag}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------- FOOTER NOTE ---------- */}
      <div className="dash-footer-note">
        <strong>Records roles do not dispense medicine.</strong>
        <br />
        BHW confirms releases and manages inventory. Chairman controls
        synchronization. Reports, notifications and synchronization history are
        shared within role permissions.
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="dash-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}

/* ---------------- Small helpers ---------------- */

function StatusPill({ status }) {
  if (status === "active") {
    return <span className="status-pill status-pill--active">• Active</span>;
  }
  if (status === "review") {
    return <span className="status-pill status-pill--review">• For review</span>;
  }
  return null;
}
