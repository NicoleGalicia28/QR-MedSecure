import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  RefreshCcw,
  Bell,
  History,
  UserCog,
  ChevronDown,
  Activity,
  LogOut,
} from "lucide-react";
import { getSession, signOut } from "../auth/authStore";
import { useEndpoint } from "../../lib/useApi";
import "../admin/AdminLayout.css";

function initialsOf(user) {
  if (!user) return "CH";
  return `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "CH";
}

export default function ChairmanLayout() {
  const navigate = useNavigate();
  const user = getSession();

  // Live notification feed drives the unread badge in the sidebar and topbar.
  const { data: notifications } = useEndpoint("/notifications", (res) => res.notifications);
  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n) => !n.read).length
    : 0;

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
              <p className="admin-workspace__title">Chairman workspace</p>
              <p className="admin-workspace__sub">
                Barangay 354 Tayuman · Admin access
              </p>
            </div>
            <ChevronDown size={14} color="#6b7280" />
          </div>
        </div>

        {/* Nav */}
        <nav className="admin-nav">
          <div className="admin-nav__section">
            <p className="admin-nav__heading">OVERSIGHT</p>
            <NavLink
              to="/chairman/dashboard"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <LayoutDashboard size={15} /> Dashboard
            </NavLink>
            <NavLink
              to="/chairman/reports"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <BarChart3 size={15} /> Statistics &amp; reports
            </NavLink>
            <NavLink
              to="/chairman/sync"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <RefreshCcw size={15} /> Synchronization
            </NavLink>
          </div>

          <div className="admin-nav__section">
            <p className="admin-nav__heading">WORKSPACE TOOLS</p>
            <NavLink
              to="/chairman/notifications"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <Bell size={15} /> Notifications
              {unreadCount > 0 && (
                <span className="admin-nav__badge">{unreadCount}</span>
              )}
            </NavLink>
            <NavLink
              to="/chairman/sync/history"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <History size={15} /> Sync history
            </NavLink>
            <NavLink
              to="/chairman/profile"
              className={({ isActive }) =>
                "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
              }
            >
              <UserCog size={15} /> Profile &amp; settings
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
            Barangay 354 Tayuman Health Center / Chairman
          </div>
          <div className="admin-topbar__right">
            <span className="admin-topbar__demo">Chairman workspace</span>

            <Link
              to="/chairman/notifications"
              className="admin-topbar__icon-btn"
              aria-label={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              title={unreadCount > 0 ? `${unreadCount} unread` : "Notifications"}
            >
              <Bell size={16} />
              {unreadCount > 0 && <span className="admin-topbar__icon-dot" />}
            </Link>

            <div className="admin-user">
              <div className="admin-user__avatar">{initialsOf(user)}</div>
              <div className="admin-user__meta">
                <span className="admin-user__name">
                  {user ? `${user.firstName} ${user.lastName}` : "Chairman"}
                </span>
                <span className="admin-user__role">
                  {user?.email || user?.role || "Chairman · Authorized staff"}
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
