import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Pill,
  ClipboardList,
  QrCode,
  FileText,
  Activity,
  Bell,
  RefreshCcw,
  UserCog,
  HelpCircle,
  ChevronDown,
  LogOut,
  Users,
} from "lucide-react";
import { getSession, signOut } from "../auth/authStore";
import { useEndpoint } from "../../lib/useApi";
import "../admin/AdminLayout.css";

function initialsOf(user) {
  if (!user) return "BH";
  return (
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() ||
    "BH"
  );
}

export default function BhwLayout() {
  const navigate = useNavigate();
  const user = getSession();
  const { data: unreadCount } = useEndpoint(
    "/notifications",
    (res) => (res.notifications || []).filter((n) => !n.read).length
  );

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
              <p className="admin-workspace__title">BHW workspace</p>
              <p className="admin-workspace__sub">Barangay 354 Tayuman</p>
            </div>
            <ChevronDown size={14} color="#6b7280" />
          </div>
        </div>

        {/* Nav */}
        <nav className="admin-nav">
          <div className="admin-nav__section">
            <NavLink
              to="/bhw/dashboard"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <LayoutDashboard size={15} /> Dashboard
            </NavLink>
            <NavLink
              to="/bhw/inventory"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Pill size={15} /> Medicine inventory
            </NavLink>
            <NavLink
              to="/bhw/beneficiaries"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Users size={15} /> Beneficiaries
            </NavLink>
            <NavLink
              to="/bhw/clinical-records"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <ClipboardList size={15} /> Clinical records
            </NavLink>
            <NavLink
              to="/bhw/scan-dispense"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <QrCode size={15} /> Scan &amp; dispense
            </NavLink>
            <NavLink
              to="/bhw/transactions"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <FileText size={15} /> Transactions
            </NavLink>
            <NavLink
              to="/bhw/machine"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Activity size={15} /> Machine monitoring
            </NavLink>
          </div>

          <div className="admin-nav__section">
            <p className="admin-nav__heading">WORKSPACE TOOLS</p>
            <NavLink
              to="/bhw/notifications"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Bell size={15} /> Notifications
              {unreadCount > 0 ? (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "#b91c1c",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: "2px 6px",
                  }}
                >
                  {unreadCount}
                </span>
              ) : null}
            </NavLink>
            <NavLink
              to="/bhw/sync"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <RefreshCcw size={15} /> Sync history
            </NavLink>
            <NavLink
              to="/bhw/profile"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <UserCog size={15} /> Profile &amp; settings
            </NavLink>
            <NavLink
              to="/bhw/help"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <HelpCircle size={15} /> Help &amp; support
            </NavLink>
          </div>
        </nav>

        {/* Footer */}
        <div className="admin-sidebar__footer">
          <p>
            Confidential workspace. Access only records needed for your assigned
            role.
          </p>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            Barangay 354 Tayuman Health Center / BHW
          </div>
          <div className="admin-topbar__right">
            <button
              type="button"
              className="admin-topbar__icon-btn"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => navigate("/bhw/notifications")}
            >
              <Bell size={16} />
              {unreadCount > 0 ? (
                <span className="admin-topbar__icon-dot" />
              ) : null}
            </button>

            <div className="admin-user">
              <div className="admin-user__avatar">{initialsOf(user)}</div>
              <div className="admin-user__meta">
                <span className="admin-user__name">
                  {user ? `${user.firstName} ${user.lastName}` : "BHW Staff"}
                </span>
                <span className="admin-user__role">
                  {user?.email || "BHW · Authorized staff"}
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

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}