import { Link, useSearchParams } from "react-router-dom";
import { SquarePen } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState } from "../../lib/ui";
import { fmtDate, fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./ProfileSettings.css";

function buildProfile(serverUser) {
  // Profile is driven entirely by GET /users/me; the session copy only
  // keeps the page readable while the first payload is in flight.
  const session = getSession();
  const role = serverUser?.role || session?.role || "";
  const isBhw = String(role).toLowerCase().includes("bhw");
  const isAdmin = serverUser?.isAdmin === true || session?.isAdmin === true;
  const fullName =
    serverUser?.name ||
    `${serverUser?.firstName || ""} ${serverUser?.lastName || ""}`.trim() ||
    (session ? `${session.firstName} ${session.lastName}` : "");
  const roleLabel = isBhw ? "Barangay Health Worker" : role || "—";
  const shortRole = isAdmin ? "Admin" : isBhw ? "BHW" : role || "—";

  return {
    name: fullName || "—",
    role: roleLabel,
    status: `${shortRole} · ${serverUser?.status ? serverUser.status[0].toUpperCase() + serverUser.status.slice(1) : "—"}`,
    staffId: serverUser?.id ?? "—",
    workspace: "Barangay 354 Tayuman",
    accountCreated: serverUser?.createdAt ? fmtDate(serverUser.createdAt) : "—",
    lastSignIn: serverUser?.lastSignIn
      ? fmtDateTime(serverUser.lastSignIn)
      : "—",
    fullName: fullName || "—",
    mobile: serverUser?.phone || "—",
    email: serverUser?.email || session?.email || "—",
    sex: serverUser?.sex || "—",
    birthDate: serverUser?.birthDate ? fmtDate(serverUser.birthDate) : "—",
    address: serverUser?.address || "—",
    designation: roleLabel,
    passwordLastUpdated: serverUser?.passwordUpdatedAt
      ? fmtDateTime(serverUser.passwordUpdatedAt)
      : "—",
  };
}

const TABS = [
  { key: "profile", label: "My profile" },
  { key: "access", label: "Workspace access" },
];

export default function ProfileSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Tab is driven by the URL (?tab=…), so deep links like
  // "/bhw/profile?tab=access" keep working alongside the
  // route-based tabs (Profile/Security/Notifications).
  const tab = searchParams.get("tab");
  const activeTab = TABS.some((x) => x.key === tab) ? tab : "profile";
  const goTab = (key) => setSearchParams({ tab: key });

  // Live account record from GET /users/me.
  const {
    data: account,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me", (res) => res.user);

  if (isLoading && !account) {
    return <Loading label="Loading your profile…" />;
  }
  if (error && !account) {
    return (
      <ErrorState
        title="Could not load your profile"
        message={error}
        onRetry={refetch}
      />
    );
  }

  const user = buildProfile(account);

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
        <Link to="/bhw/profile/edit" className="ps-edit-btn">
          <SquarePen size={14} strokeWidth={2.5} />
          Edit profile
        </Link>
      </div>

      {/* ---------- TABS ---------- */}
      <div className="ps-tabs">
        <Link
          to="/bhw/profile"
          className={"ps-tab" + (activeTab === "profile" ? " ps-tab--active" : "")}
        >
          My profile
        </Link>
        <Link to="/bhw/profile/security" className="ps-tab">
          Security
        </Link>
        <Link to="/bhw/profile/notifications" className="ps-tab">
          Notifications
        </Link>
        <button
          className={"ps-tab" + (activeTab === "access" ? " ps-tab--active" : "")}
          onClick={() => goTab("access")}
        >
          Workspace access
        </button>
      </div>

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
                    <p className="ps-info-field__label">Sex</p>
                    <p className="ps-info-field__value">{user.sex}</p>
                  </div>
                  <div className="ps-info-field">
                    <p className="ps-info-field__label">Birth date</p>
                    <p className="ps-info-field__value">{user.birthDate}</p>
                  </div>

                  <div className="ps-info-field">
                    <p className="ps-info-field__label">Address</p>
                    <p className="ps-info-field__value">{user.address}</p>
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
                  <Link to="/bhw/profile/security" className="ps-sec__action">
                    • Change password
                  </Link>
                </div>

                <div className="ps-sec-row">
                  <div className="ps-sec__left">
                    <p className="ps-sec__title">Alert delivery</p>
                    <p className="ps-sec__meta">
                      In-app and email channels · Managed in preferences
                    </p>
                  </div>
                  <Link to="/bhw/profile/notifications" className="ps-sec__action">
                    • Manage
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- BHW PERMISSIONS ---------- */}
          <div className="ps-footer-note">
            <strong>BHW permissions</strong>
            Manage inventory, restock, medical history and dispensing; view
            beneficiary records and prescriptions. You cannot approve staff,
            edit beneficiary identity or control synchronization.
          </div>
        </>
      )}

      {/* ---------- WORKSPACE ACCESS TAB ---------- */}
      {activeTab === "access" && (
        <div className="ps-panel">
          <h2 className="ps-panel__title">Workspace access</h2>

          <div className="ps-info-grid">
            <div className="ps-info-field">
              <p className="ps-info-field__label">Assigned role</p>
              <p className="ps-info-field__value">{user.role}</p>
            </div>
            <div className="ps-info-field">
              <p className="ps-info-field__label">Account status</p>
              <p className="ps-info-field__value">{user.status}</p>
            </div>
            <div className="ps-info-field">
              <p className="ps-info-field__label">Workspace</p>
              <p className="ps-info-field__value">{user.workspace}</p>
            </div>
            <div className="ps-info-field">
              <p className="ps-info-field__label">Last sign-in</p>
              <p className="ps-info-field__value">{user.lastSignIn}</p>
            </div>
          </div>

          <p className="ps-id-field__value--muted" style={{ marginTop: 14, fontSize: 11.5 }}>
            Roles and permissions are managed by the Secretary (Admin).
            Contact the health center staff desk to request a change.
          </p>
        </div>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ps-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
