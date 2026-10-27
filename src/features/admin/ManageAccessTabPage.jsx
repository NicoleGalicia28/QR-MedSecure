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
  if (!value) return "Never";
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

function statusPill(status) {
  if (status === "suspended") {
    return <span className="urm-pill urm-pill--rejected">• Suspended</span>;
  }
  return <span className="urm-pill urm-pill--approved">• Active</span>;
}

export default function ManageAccessTabPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const {
    data: users,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/admin/users", (res) => res.users);

  const staff = users || [];

  const roles = useMemo(() => {
    const set = new Set(staff.map((s) => s.role).filter(Boolean));
    return ["All roles", ...Array.from(set)];
  }, [staff]);

  const rows = useMemo(
    () =>
      staff.filter((s) => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          String(s.name || "").toLowerCase().includes(q) ||
          String(s.email || "").toLowerCase().includes(q);
        const matchesRole = roleFilter === "All roles" || s.role === roleFilter;
        const matchesStatus =
          statusFilter === "All statuses" ||
          (statusFilter === "Active" ? s.status !== "suspended" : s.status === "suspended");
        return matchesSearch && matchesRole && matchesStatus;
      }),
    [staff, search, roleFilter, statusFilter],
  );

  const activeCount = staff.filter((s) => s.status !== "suspended").length;
  const suspendedCount = staff.filter((s) => s.status === "suspended").length;

  return (
    <>
      <Link to="/admin/users" className="is-back">
        <ArrowLeft size={14} /> User &amp; role management
      </Link>

      <div className="is-header">
        <h1 className="is-header__title">Invite staff &amp; manage access</h1>
        <p className="is-header__subtitle">
          Secretary (Admin) · Review access for staff within Barangay 354
          Tayuman, Manila.
        </p>
      </div>

      <div className="is-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.path}
            className={"is-tab" + (t.key === "manage" ? " is-tab--active" : "")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ---------- MANAGE ACCESS ---------- */}
      <div className="urm-panel">
        <h2 className="urm-panel__title">Staff access directory</h2>
        <p className="urm-panel__subtitle">
          Search, filter and review access for every account in this workspace.
        </p>

        <div className="urm-filters">
          <div className="urm-filter-group">
            <label className="urm-filter-label">Search staff</label>
            <input
              type="text"
              className="urm-filter-input"
              placeholder="Name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="urm-filter-group">
            <label className="urm-filter-label">Role</label>
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
          <div className="urm-filter-group">
            <label className="urm-filter-label">Access status</label>
            <select
              className="urm-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {["All statuses", "Active", "Suspended"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && !users ? (
          <Loading label="Loading staff access…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : staff.length === 0 ? (
          <EmptyState
            title="No staff accounts yet"
            message="Accounts created through invites or approved requests appear here."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No staff match"
            message="No staff match the current search and filters."
          />
        ) : (
          <table className="urm-table">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="urm-table__email">{s.name}</span>
                    <div className="urm-table__sub">{s.email}</div>
                  </td>
                  <td>{s.role}</td>
                  <td>{statusPill(s.status)}</td>
                  <td>{fmtStamp(s.lastSignIn)}</td>
                  <td>
                    <Link to="/admin/users" className="urm-table__action">
                      Manage access
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="urm-footer">
          <span>
            Showing {rows.length} of {staff.length} staff accounts
          </span>
        </div>
      </div>

      {/* ---------- SIDE SUMMARY ---------- */}
      <div className="urm-side-panel">
        <h2 className="urm-side-panel__title">Access summary</h2>
        <p className="urm-side-panel__subtitle">Current state of the staff directory.</p>

        <div className="urm-detail-row">
          <p className="urm-detail__label">Total accounts</p>
          <p className="urm-detail__value">{staff.length}</p>
        </div>
        <div className="urm-detail-row">
          <p className="urm-detail__label">Active</p>
          <p className="urm-detail__value">{activeCount} accounts with access</p>
        </div>
        <div className="urm-detail-row">
          <p className="urm-detail__label">Suspended</p>
          <p className="urm-detail__value">{suspendedCount} account(s) locked</p>
        </div>

        <div className="urm-side-actions">
          <Link to="/admin/users/invite" className="urm-side-btn urm-side-btn--primary">
            Invite a new staff member
          </Link>
          <Link to="/admin/users/access-audit" className="urm-side-btn urm-side-btn--outline">
            Review access audit
          </Link>
        </div>
      </div>

      <div className="urm-info">
        <strong>Revocation is reversible</strong>
        Suspending access preserves historical records and audit trails. Access
        can be restored once the reason and re-approval are recorded.
      </div>

      <div className="urm-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
