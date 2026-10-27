import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import "./DashboardPage.css";
import "./InviteStaff.css";
import "./UserRoleManagement.css";

const TABS = [
  { key: "invite", label: "Invite staff", path: "/admin/users/invite" },
  { key: "manage", label: "Manage access", path: "/admin/users/manage-access" },
  { key: "roles", label: "Role permissions", path: "/admin/users/role-permissions" },
  { key: "audit", label: "Access audit", path: "/admin/users/access-audit" },
];

function fmtStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccessAuditPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");

  const {
    data: entries,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/admin/audit", (res) => res.entries);

  const rows = entries || [];

  const roles = useMemo(() => {
    const set = new Set(rows.map((r) => r.actorRole).filter(Boolean));
    return ["All roles", ...Array.from(set)];
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((a) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          String(a.actor || "").toLowerCase().includes(q) ||
          String(a.action || "").toLowerCase().includes(q) ||
          String(a.target || "").toLowerCase().includes(q) ||
          String(a.reason || "").toLowerCase().includes(q);
        const matchesRole = roleFilter === "All roles" || a.actorRole === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [rows, search, roleFilter],
  );

  const distinctActors = new Set(rows.map((r) => r.actor).filter(Boolean)).size;

  return (
    <>
      <Link to="/admin/users" className="is-back">
        <ArrowLeft size={14} /> User &amp; role management
      </Link>

      <div className="is-header">
        <h1 className="is-header__title">Invite staff &amp; manage access</h1>
        <p className="is-header__subtitle">
          Secretary (Admin) · Complete trail of access changes and privileged
          actions in this workspace.
        </p>
      </div>

      <div className="is-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.path}
            className={"is-tab" + (t.key === "audit" ? " is-tab--active" : "")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ---------- AUDIT TRAIL ---------- */}
      <div className="urm-panel">
        <h2 className="urm-panel__title">Access audit</h2>
        <p className="urm-panel__subtitle">
          Every privileged action — approvals, role changes and suspensions — is
          recorded for security review.
        </p>

        <div className="urm-filters">
          <div className="urm-filter-group">
            <label className="urm-filter-label">Search events</label>
            <input
              type="text"
              className="urm-filter-input"
              placeholder="Actor, action or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="urm-filter-group">
            <label className="urm-filter-label">Actor role</label>
            <select
              className="urm-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && !entries ? (
          <Loading label="Loading audit trail…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No recorded activity yet"
            message="Approvals, role changes and suspensions will appear here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No events match"
            message="No audit events match the current search and filter."
          />
        ) : (
          <table className="urm-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="urm-table__email">{a.action}</span>
                    <div className="urm-table__sub">{fmtStamp(a.at)}</div>
                  </td>
                  <td>
                    {a.actor}
                    <div className="urm-table__sub">{a.actorRole}</div>
                  </td>
                  <td>{a.target || "—"}</td>
                  <td>{a.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="urm-footer">
          <span>
            Showing {filtered.length} of {rows.length} events
          </span>
        </div>
      </div>

      {/* ---------- SIDEBAR SUMMARY ---------- */}
      <div className="urm-side-panel">
        <h2 className="urm-side-panel__title">Audit summary</h2>
        <p className="urm-side-panel__subtitle">Recorded privileged activity.</p>

        <div className="urm-detail-row">
          <p className="urm-detail__label">Total events</p>
          <p className="urm-detail__value">{rows.length}</p>
        </div>
        <div className="urm-detail-row">
          <p className="urm-detail__label">Distinct actors</p>
          <p className="urm-detail__value">{distinctActors}</p>
        </div>
        <div className="urm-detail-row">
          <p className="urm-detail__label">Last event</p>
          <p className="urm-detail__value urm-detail__value--muted">
            {rows[0] ? fmtStamp(rows[0].at) : "—"}
          </p>
        </div>

        <div className="urm-side-actions">
          <Link to="/admin/users/manage-access" className="urm-side-btn urm-side-btn--primary">
            Manage staff access
          </Link>
          <Link to="/admin/users/role-permissions" className="urm-side-btn urm-side-btn--outline">
            Review role permissions
          </Link>
        </div>
      </div>

      <div className="urm-info">
        <strong>Tamper-evident log</strong>
        Audit entries cannot be edited or deleted from the interface. Failed and
        denied capability attempts are recorded alongside successful actions.
      </div>

      <div className="urm-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
