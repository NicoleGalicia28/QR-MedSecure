import { Link, useSearchParams } from "react-router-dom";
import { SquarePen } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState } from "../../lib/ui";
import { fmtDate, fmtStamp } from "./format";
import "../admin/DashboardPage.css";
import "../bhw/ProfileSettings.css";

/* Profile fields come from the live /users/me record. */

const titleCase = (s) =>
  s ? String(s)[0].toUpperCase() + String(s).slice(1) : "";

function buildProfile(u) {
  const role = u.role || "Chairman";
  const isChairman = String(role).toLowerCase().includes("chairman");
  const fullName =
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "—";
  const roleLabel = isChairman ? "Barangay Chairman" : role;
  const shortRole = isChairman ? "Chairman" : role;

  return {
    name: fullName,
    role: roleLabel,
    status: `${shortRole} · ${titleCase(u.status) || "Active"}`,
    staffId: u.id ?? "—",
    workspace: "Barangay 354 Tayuman",
    accountCreated: u.createdAt ? fmtDate(u.createdAt) : "—",
    lastSignIn: u.lastSignIn ? fmtStamp(u.lastSignIn) : "—",
    fullName,
    mobile: u.phone || "—",
    email: u.email || "—",
    assignedCenter: "Barangay 354 Tayuman Barangay Hall",
    designation: roleLabel,
    passwordLastUpdated: u.passwordUpdatedAt
      ? fmtDate(u.passwordUpdatedAt)
      : "—",
    alertDelivery: "In-app notifications enabled · Email for urgent alerts",
  };
}

const TABS = [
  { key: "profile", label: "My profile" },
  { key: "access", label: "Workspace access" },
];

export default function ChairmanProfileSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Tab is driven by the URL (?tab=…), so deep links like
  // "/chairman/profile?tab=access" keep working alongside the
  // route-based tabs (Profile/Security/Notifications).
  const tab = searchParams.get("tab");
  const activeTab = TABS.some((x) => x.key === tab) ? tab : "profile";
  const goTab = (key) => setSearchParams({ tab: key });

  // Live account from /users/me — the only source of profile data.
  const {
    data: serverUser,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me", (res) => res.user);
  const user = serverUser ? buildProfile(serverUser) : null;

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="ps-header">
        <div>
          <h1 className="ps-header__title">Profile &amp; settings</h1>
          <p className="ps-header__subtitle">
            Manage your personal account, preferences and workspace access.
          </p>
        </div>
        <Link to="/chairman/profile/edit" className="ps-edit-btn">
          <SquarePen size={14} strokeWidth={2.5} />
          Edit profile
        </Link>
      </div>

      {/* ---------- TABS ---------- */}
      <div className="ps-tabs">
        <Link
          to="/chairman/profile"
          className={"ps-tab" + (activeTab === "profile" ? " ps-tab--active" : "")}
        >
          My profile
        </Link>
        <Link to="/chairman/profile/security" className="ps-tab">
          Security
        </Link>
        <Link to="/chairman/profile/notifications" className="ps-tab">
          Notifications
        </Link>
        <button
          className={"ps-tab" + (activeTab === "access" ? " ps-tab--active" : "")}
          onClick={() => goTab("access")}
        >
          Workspace access
        </button>
      </div>

      {isLoading ? (
        <Loading label="Loading profile…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !user ? (
        <ErrorState
          title="Profile unavailable"
          message="No profile details were returned for this account."
          onRetry={refetch}
        />
      ) : (
        <>
          {/* ---------- MY PROFILE TAB ---------- */}
          {activeTab === "profile" && (
            <>
              <div className="ps-layout">
                {/* ============ LEFT: IDENTITY CARD ============ */}
                <aside className="ps-panel">
                  <p className="ps-identity__name">{user.name}</p>
                  <p className="ps-identity__role">{user.role}</p>
                  <span className="ps-identity__status">• {user.status}</span>

                  <div className="ps-id-field">
                    <p className="ps-id-field__label">Staff ID</p>
                    <p className="ps-id-field__value">{user.staffId}</p>
                  </div>

                  <div className="ps-id-field">
                    <p className="ps-id-field__label">Workspace</p>
                    <p className="ps-id-field__value">{user.workspace}</p>
                  </div>

                  <div className="ps-id-field">
                    <p className="ps-id-field__label">Account created</p>
                    <p className="ps-id-field__value ps-id-field__value--muted">
                      {user.accountCreated}
                    </p>
                  </div>

                  <div className="ps-id-field">
                    <p className="ps-id-field__label">Last sign-in</p>
                    <p className="ps-id-field__value ps-id-field__value--muted">
                      {user.lastSignIn}
                    </p>
                  </div>

                  <p className="ps-identity__note">
                    Your role is assigned by the barangay administrator.
                  </p>
                </aside>

                {/* ============ RIGHT ============ */}
                <div>
                  {/* Personal information */}
                  <div className="ps-panel">
                    <h2 className="ps-panel__title">Personal information</h2>

                    <div className="ps-info-grid">
                      <div className="ps-info-field">
                        <p className="ps-info-field__label">Full name</p>
                        <p className="ps-info-field__value">{user.fullName}</p>
                      </div>
                      <div className="ps-info-field">
                        <p className="ps-info-field__label">Mobile number</p>
                        <p className="ps-info-field__value">{user.mobile}</p>
                      </div>

                      <div className="ps-info-field">
                        <p className="ps-info-field__label">Email address</p>
                        <p className="ps-info-field__value">{user.email}</p>
                      </div>
                      <div className="ps-info-field">
                        <p className="ps-info-field__label">Designation</p>
                        <p className="ps-info-field__value">
                          {user.designation}
                        </p>
                      </div>

                      <div className="ps-info-field">
                        <p className="ps-info-field__label">Assigned office</p>
                        <p className="ps-info-field__value">
                          {user.assignedCenter}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Security & preferences */}
                  <div className="ps-panel">
                    <h2 className="ps-panel__title">Security &amp; preferences</h2>

                    <div className="ps-sec-row">
                      <div className="ps-sec__left">
                        <p className="ps-sec__title">Password</p>
                        <p className="ps-sec__meta">
                          Last updated {user.passwordLastUpdated}
                        </p>
                      </div>
                      <Link
                        to="/chairman/profile/security"
                        className="ps-sec__action"
                      >
                        • Change password
                      </Link>
                    </div>

                    <div className="ps-sec-row">
                      <div className="ps-sec__left">
                        <p className="ps-sec__title">Alert delivery</p>
                        <p className="ps-sec__meta">{user.alertDelivery}</p>
                      </div>
                      <Link
                        to="/chairman/profile/notifications"
                        className="ps-sec__action"
                      >
                        • Manage
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------- CHAIRMAN PERMISSIONS ---------- */}
              <div className="ps-footer-note">
                <strong>Chairman permissions</strong>
                View shared aggregate statistics, monitor all system-wide alerts
                and control barangay synchronization. Staff approval is handled
                by the Secretary (Admin); beneficiary identity, clinical records
                and dispensing remain with BHW staff.
              </div>
            </>
          )}

          {/* ---------- WORKSPACE ACCESS TAB ---------- */}
          {activeTab === "access" && (
            <div className="ps-panel">
              <h2 className="ps-panel__title">Workspace access</h2>
              <div className="ps-sec-row">
                <div className="ps-sec__left">
                  <p className="ps-sec__title">
                    Chairman · Barangay 354 Tayuman
                  </p>
                  <p className="ps-sec__meta">
                    Statistics &amp; reports · Synchronization · Notifications ·
                    Profile &amp; settings
                  </p>
                </div>
                <span className="ps-identity__status">• Active</span>
              </div>
              <div className="ps-sec-row">
                <div className="ps-sec__left">
                  <p className="ps-sec__title">Session history</p>
                  <p className="ps-sec__meta">
                    Last signed in {user.lastSignIn}
                  </p>
                </div>
                <Link
                  to="/chairman/profile/security"
                  className="ps-sec__action"
                >
                  • Review security
                </Link>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ps-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
