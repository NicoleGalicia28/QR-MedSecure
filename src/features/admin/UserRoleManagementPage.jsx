import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { getSession } from "../auth/authStore";
import "../admin/DashboardPage.css";
import "./UserRoleManagement.css";

const TABS = [
  { key: "directory", label: "Staff directory" },
  { key: "requests", label: "Account requests" },
  { key: "audit", label: "Access history" },
];

const ROLES = ["BHW", "Chairman", "Secretary (Admin)"];

function fmtStamp(value) {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AccountPill({ status }) {
  if (status === "suspended") {
    return <span className="urm-pill urm-pill--rejected">• Suspended</span>;
  }
  return <span className="urm-pill urm-pill--approved">• Active</span>;
}

export default function UserRoleManagementPage() {
  const [activeTab, setActiveTab] = useState("directory");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const session = getSession();
  const refresh = useApiRefresh();

  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useEndpoint("/admin/users", (res) => res.users);

  const {
    data: requests,
    isLoading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useEndpoint("/admin/users/requests", (res) => res.requests);

  const {
    data: audit,
    isLoading: auditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useEndpoint("/admin/audit", (res) => res.entries, {
    enabled: activeTab === "audit",
  });

  const staff = users || [];
  const pendingRequests = (requests || []).filter((r) => r.status === "pending");

  const isSelf = (u) => String(u.id) === String(session?.id);

  const changeRole = async (u, role) => {
    if (isSelf(u)) return;
    setBusyId(u.id);
    setNotice(null);
    const res = await sendApi(`/admin/users/${u.id}/role`, { role }, "PUT");
    setBusyId(null);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setNotice({ kind: "success", text: `${u.email} is now ${role}.` });
    await refresh("/admin/users");
  };

  const toggleStatus = async (u) => {
    if (isSelf(u)) return;
    setBusyId(u.id);
    setNotice(null);
    const suspending = u.status !== "suspended";
    const res = suspending
      ? await sendApi(`/admin/users/${u.id}/suspend`)
      : await sendApi(`/admin/users/${u.id}/status`, { status: "active" });
    setBusyId(null);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setNotice({
      kind: "success",
      text: suspending ? `${u.email} has been suspended.` : `${u.email} has been reactivated.`,
    });
    await refresh("/admin/users");
  };

  const filteredStaff = staff.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(u.name || "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q);
    const matchesRole = roleFilter === "All roles" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <>
      <div className="urm-header">
        <div>
          <h1 className="urm-header__title">User &amp; role administration</h1>
          <p className="urm-header__subtitle">
            Secretary (Admin) · Manage staff accounts, roles and access.
          </p>
        </div>
        <div className="urm-header__actions">
          <Link to="/admin/users/invite" className="urm-btn urm-btn--primary">
            <Plus size={14} strokeWidth={2.5} />
            Invite staff member
          </Link>
        </div>
      </div>

      <div className="urm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"urm-tab" + (activeTab === t.key ? " urm-tab--active" : "")}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === "requests" && pendingRequests.length > 0 ? (
              <span className="urm-tab__count">({pendingRequests.length})</span>
            ) : null}
          </button>
        ))}
      </div>

      {notice ? <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice> : null}

      <InlineNotice kind="info">
        Your own account cannot be suspended or have its role changed from this
        screen.
      </InlineNotice>

      {activeTab === "directory" && (
        <div className="urm-layout">
          <div>
            <div className="urm-panel">
              <h2 className="urm-panel__title">Staff directory</h2>
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
                    {["All roles", ...ROLES].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {usersLoading && !users ? (
                <Loading label="Loading staff directory…" />
              ) : usersError ? (
                <ErrorState message={usersError} onRetry={refetchUsers} />
              ) : filteredStaff.length === 0 ? (
                <EmptyState
                  title="No staff match"
                  message="No accounts match the current search and role filter."
                />
              ) : (
                <table className="urm-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Role</th>
                      <th>Account status</th>
                      <th>Last sign-in</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((u) => (
                      <tr key={u.id}>
                        <td className="urm-table__email">
                          {u.name}
                          <div className="urm-table__sub">{u.email}</div>
                        </td>
                        <td>
                          <select
                            className="urm-filter-select"
                            value={u.role}
                            disabled={isSelf(u) || busyId === u.id}
                            onChange={(e) => changeRole(u, e.target.value)}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                            {ROLES.includes(u.role) ? null : (
                              <option value={u.role}>{u.role}</option>
                            )}
                          </select>
                        </td>
                        <td>
                          <AccountPill status={u.status} />
                        </td>
                        <td>{fmtStamp(u.lastSignIn)}</td>
                        <td>
                          {isSelf(u) ? (
                            <span className="urm-table__action urm-table__action--muted">
                              This is you
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="urm-table__action"
                              onClick={() => toggleStatus(u)}
                              disabled={busyId === u.id}
                            >
                              {busyId === u.id
                                ? "Working…"
                                : u.status === "suspended"
                                  ? "Reactivate"
                                  : "Suspend"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="urm-footer">
                <span>
                  Showing {filteredStaff.length} of {staff.length} accounts
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="urm-side-panel">
              <h2 className="urm-side-panel__title">Pending approval requests</h2>
              {requestsLoading && !requests ? (
                <Loading label="Loading requests…" />
              ) : requestsError ? (
                <ErrorState message={requestsError} onRetry={refetchRequests} />
              ) : pendingRequests.length === 0 ? (
                <div className="urm-detail-row">
                  <p className="urm-detail__value urm-detail__value--muted">
                    No pending requests. New account requests submitted from the
                    sign-up form will appear here for review.
                  </p>
                </div>
              ) : (
                pendingRequests.slice(0, 5).map((r) => (
                  <div className="urm-detail-row" key={r.id}>
                    <p className="urm-detail__label">{r.role}</p>
                    <p className="urm-detail__value">
                      <Link to={`/admin/users/requests/${r.id}`}>
                        {r.name} · review
                      </Link>
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="urm-side-panel">
              <div className="urm-info">
                <strong>Permission boundaries</strong>
                Secretary (Admin) can manage users, roles and permissions.
                Clinical release and dispensing remain with the assigned health
                staff.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "requests" && (
        <div className="urm-panel">
          <h2 className="urm-panel__title">Account requests</h2>
          <p className="urm-panel__subtitle">
            Approving grants workspace access and lets the account sign in;
            rejecting blocks it.
          </p>

          {requestsLoading && !requests ? (
            <Loading label="Loading account requests…" />
          ) : requestsError ? (
            <ErrorState message={requestsError} onRetry={refetchRequests} />
          ) : (requests || []).length === 0 ? (
            <EmptyState
              title="No account requests yet"
              message="Requests submitted from the sign-up form appear here."
            />
          ) : (
            <table className="urm-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Requested role</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(requests || []).map((r) => (
                  <tr key={r.id}>
                    <td className="urm-table__email">{r.name}</td>
                    <td>{r.email}</td>
                    <td>{r.role}</td>
                    <td>{fmtStamp(r.submittedAt)}</td>
                    <td>
                      {r.status === "approved" ? (
                        <span className="urm-pill urm-pill--approved">• Approved</span>
                      ) : r.status === "rejected" ? (
                        <span className="urm-pill urm-pill--rejected">• Rejected</span>
                      ) : (
                        <span className="urm-pill urm-pill--pending">• Pending</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/admin/users/requests/${r.id}`}
                        className="urm-table__action"
                      >
                        Review request
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <div className="urm-panel">
          <h2 className="urm-panel__title">Access history</h2>
          <p className="urm-panel__subtitle">
            Audit trail of user access changes and reviews.
          </p>

          {auditLoading && !audit ? (
            <Loading label="Loading access history…" />
          ) : auditError ? (
            <ErrorState message={auditError} onRetry={refetchAudit} />
          ) : (audit || []).length === 0 ? (
            <EmptyState
              title="No recorded activity yet"
              message="Access approvals, role changes and suspensions appear here."
            />
          ) : (
            <table className="urm-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {(audit || []).map((a) => (
                  <tr key={a.id}>
                    <td>{fmtStamp(a.at)}</td>
                    <td>
                      {a.actor}
                      <div className="urm-table__sub">{a.actorRole}</div>
                    </td>
                    <td>{a.action}</td>
                    <td>{a.target || "—"}</td>
                    <td>{a.reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="urm-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
