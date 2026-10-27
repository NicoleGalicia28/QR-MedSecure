import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import "./DashboardPage.css";
import "./InviteStaff.css";
import "./UserRoleManagement.css";

const ROLES = ["BHW", "Secretary (Admin)", "Chairman"];

const PERMISSIONS = [
  {
    name: "Beneficiary registry",
    scope: "View, add and edit beneficiary records",
    doctor: "rw",
    nurse: "rw",
    bhw: "r",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Beneficiary IDs & QR",
    scope: "Generate and preview IDs and QR codes",
    doctor: "r",
    nurse: "r",
    bhw: "r",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Clinical records",
    scope: "Medical histories and consultations",
    doctor: "rw",
    nurse: "rw",
    bhw: "r",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Medicine inventory",
    scope: "Stock levels, expiry and batches",
    doctor: "r",
    nurse: "rw",
    bhw: "rw",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Restock & dispensing",
    scope: "Record restocks and dispense medicines",
    doctor: "r",
    nurse: "rw",
    bhw: "rw",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Transactions",
    scope: "Dispensing history and receipts",
    doctor: "r",
    nurse: "rw",
    bhw: "rw",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Machine monitoring",
    scope: "Device status, maintenance and refill alerts",
    doctor: "r",
    nurse: "r",
    bhw: "rw",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
  {
    name: "Statistics & reports",
    scope: "Aggregated analytics and exports",
    doctor: "r",
    nurse: "r",
    bhw: "r",
    "Secretary (Admin)": "rw",
    Chairman: "rw",
  },
  {
    name: "User & role administration",
    scope: "Approve accounts and assign roles",
    doctor: "none",
    nurse: "none",
    bhw: "none",
    "Secretary (Admin)": "rw",
    Chairman: "r",
  },
];

const TABS = [
  { key: "invite", label: "Invite staff", path: "/admin/users/invite" },
  { key: "manage", label: "Manage access", path: "/admin/users/manage-access" },
  { key: "roles", label: "Role permissions", path: "/admin/users/role-permissions" },
  { key: "audit", label: "Access audit", path: "/admin/users/access-audit" },
];

function cell(value) {
  if (value === "rw")
    return (
      <span className="urm-pill urm-pill--approved">
        <Check size={11} strokeWidth={3} /> Read &amp; write
      </span>
    );
  if (value === "r")
    return (
      <span className="urm-pill urm-pill--pending">
        <Check size={11} strokeWidth={3} /> Read only
      </span>
    );
  return (
    <span className="urm-pill urm-pill--rejected">
      <X size={11} strokeWidth={3} /> No access
    </span>
  );
}

export default function RolePermissionsPage() {
  const [role, setRole] = useState("BHW");

  return (
    <>
      <Link to="/admin/users" className="is-back">
        <ArrowLeft size={14} /> User &amp; role management
      </Link>

      <div className="is-header">
        <h1 className="is-header__title">Invite staff &amp; manage access</h1>
        <p className="is-header__subtitle">
          Secretary (Admin) · Configure what each role can read, write, and manage across the
          workspace.
        </p>
      </div>

      <div className="is-tabs">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={t.path}
            className={"is-tab" + (t.key === "roles" ? " is-tab--active" : "")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ---------- ROLE SELECTOR ---------- */}
      <div className="urm-panel">
        <h2 className="urm-panel__title">Role permissions</h2>
        <p className="urm-panel__subtitle">
          Policy reference · This matrix documents the standard access policy for
          each role. Select a role to review its capability matrix.
        </p>

        <div className="urm-filters">
          <div className="urm-filter-group">
            <label className="urm-filter-label">Select role</label>
            <select
              className="urm-filter-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="urm-filter-group">
            <label className="urm-filter-label">Policy basis</label>
            <div className="urm-filter-select" style={{ background: "#f9fafb" }}>
              Standard barangay scope (reference)
            </div>
          </div>
        </div>

        <table className="urm-matrix">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Scope</th>
              <th>{role} access</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.name}>
                <td className="urm-matrix__capability">{p.name}</td>
                <td className="urm-matrix__cell">{p.scope}</td>
                <td className="urm-matrix__cell">{cell(p[role])}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="urm-footer">
          <span>
            Showing {PERMISSIONS.length} capabilities for {role}
          </span>
          <span>Read &amp; write includes create, edit and archive</span>
        </div>
      </div>

      {/* ---------- SIDEBAR NOTES ---------- */}
      <div className="urm-side-panel">
        <h2 className="urm-side-panel__title">Permission levels</h2>
        <p className="urm-side-panel__subtitle">How access is graded for each capability.</p>

        <div className="urm-detail-row">
          <p className="urm-detail__label">Read &amp; write</p>
          <p className="urm-detail__value">View, create, edit and archive records</p>
        </div>
        <div className="urm-detail-row">
          <p className="urm-detail__label">Read only</p>
          <p className="urm-detail__value">View records without making changes</p>
        </div>
        <div className="urm-detail-row">
          <p className="urm-detail__label">No access</p>
          <p className="urm-detail__value">Capability is hidden from the workspace</p>
        </div>

        <div className="urm-side-actions">
          <Link to="/admin/users/manage-access" className="urm-side-btn urm-side-btn--primary">
            Apply to staff accounts
          </Link>
          <Link to="/admin/users/access-audit" className="urm-side-btn urm-side-btn--outline">
            View access audit
          </Link>
        </div>
      </div>

      <div className="urm-info">
        <strong>Prescriber boundary</strong>
        No staff role authorises prescriptions. Clinical authorisation remains with the prescribing
        clinician, regardless of permission level.
      </div>

      <div className="urm-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
