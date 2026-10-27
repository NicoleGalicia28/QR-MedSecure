import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  IdCard,
  Bell,
  RefreshCcw,
  UserCog,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Activity,
  Inbox,
  LogOut,
} from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { getSession, signOut, isAdmin } from "../auth/authStore";
import "./AdminLayout.css";

function initialsOf(user) {
  if (!user) return "AD";
  return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "AD";
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = getSession();
  const canManageUsers = isAdmin(user);

  // Live count of account requests awaiting review (sidebar badge).
  const { data: requests } = useEndpoint("/admin/users/requests", (res) => res.requests);
  const pendingCount = (requests || []).filter((r) => r.status === "pending").length;

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin-shell">
      {/* ================= SIDEBAR ================= */}
      <aside className="admin-sidebar">
        {/* Brand */}
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__brand-icon">
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <div className="admin-sidebar__brand-text">
            <span className="admin-sidebar__brand-title">QR-MedSecure</span>
            <span className="admin-sidebar__brand-sub">
              BARANGAY HEALTH ACCESS
            </span>
          </div>
        </div>

        {/* Workspace */}
        <div className="admin-workspace">
          <p className="admin-workspace__label">ACTIVE WORKSPACE</p>
          <div className="admin-workspace__box">
            <div>
              <p className="admin-workspace__title">Secretary (Admin)</p>
              <p className="admin-workspace__sub">Barangay 354 Tayuman · Admin access</p>
            </div>
            <ChevronDown size={14} color="#6b7280" />
          </div>
        </div>

        {/* Nav */}
        <nav className="admin-nav">
          <div className="admin-nav__section">
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <LayoutDashboard size={15} /> Dashboard
            </NavLink>
            <NavLink
              to="/admin/beneficiaries"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Users size={15} /> Beneficiary registry
            </NavLink>
            <NavLink
              to="/admin/transactions"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <FileText size={15} /> Transactions
            </NavLink>
            <NavLink
              to="/admin/reports"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <BarChart3 size={15} /> Statistics & reports
            </NavLink>
            <NavLink
              to="/admin/ids"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <IdCard size={15} /> Beneficiary IDs
            </NavLink>
          </div>

          {/* ---- NEW: Account Requests ---- */}
          <div className="admin-nav__section">
            <p className="admin-nav__heading">USER MANAGEMENT</p>



            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <UserCog size={15} /> User & role management
            </NavLink>

          </div>

          <div className="admin-nav__section">
            <p className="admin-nav__heading">WORKSPACE TOOLS</p>
            <NavLink
              to="/admin/notifications"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Bell size={15} /> Notifications
            </NavLink>
            <NavLink
              to="/admin/sync"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <RefreshCcw size={15} /> Sync history
            </NavLink>
            <NavLink
              to="/admin/profile"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <ShieldCheck size={15} /> Profile & settings
            </NavLink>
          </div>
        </nav>

        {/* Footer */}
        <div className="admin-sidebar__footer">
          <p>Confidential workspace. Access only records needed for your assigned role.</p>
          <p style={{ marginTop: 10 }}>
            <Link to="/admin/help">
              <HelpCircle size={11} style={{ verticalAlign: "-1px" }} /> Help & support
            </Link>
          </p>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div className="admin-main">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            Barangay 354 Tayuman Health Center / Secretary (Admin)
          </div>
          <div className="admin-topbar__right">
            <Link
              to="/admin/notifications"
              className="admin-topbar__icon-btn"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={16} />
              <span className="admin-topbar__icon-dot" />
            </Link>

            <div className="admin-user">
              <div className="admin-user__avatar">{initialsOf(user)}</div>
              <div className="admin-user__meta">
                <span className="admin-user__name">
                  {user ? `${user.firstName} ${user.lastName}` : "Administrator"}
                </span>
                <span className="admin-user__role">
                  {user?.email || user?.role || ""}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="admin-topbar__icon-btn"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Routed content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}