import { Link, useSearchParams } from "react-router-dom";
import { SquarePen } from "lucide-react";
import { getSession } from "../../auth/authStore";
import { useEndpoint } from "../../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../../lib/ui";
import "../DashboardPage.css";
import "./ProfileSettings.css";

// Locale stamp matching the server's readable timestamps: "09 Oct 2026, 07:45".
function fmtStamp(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r.includes("bhw")) return "Barangay Health Worker";
  if (r.includes("chairman")) return "Barangay Chairman";
  if (r.includes("secretary") || r.includes("admin")) return "Secretary (Admin)";
  if (!r) return "—";
  return String(role).charAt(0).toUpperCase() + String(role).slice(1);
}

function cap(value) {
  return value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : "";
}

// Profile is driven by `GET /users/me`, with the signed-in session as the
// immediate placeholder while the first payload is in flight.
function buildProfile(me, prefs) {
  const session = getSession();
  const role = me?.role || session?.role || "";
  const shortRole = role
    ? String(role).toLowerCase().includes("bhw")
      ? "BHW"
      : String(role).toLowerCase().includes("chairman")
        ? "Chairman"
        : "Secretary (Admin)"
    : "—";
  const fullName =
    [me?.firstName, me?.lastName].filter(Boolean).join(" ") ||
    (session ? `${session.firstName} ${session.lastName}`.trim() : "") ||
    "—";

  const channels = [];
  if (prefs) {
    if (prefs.inApp) channels.push("In-app");
    if (prefs.email) channels.push("Email");
    if (prefs.sms) channels.push("SMS");
  }

  return {
    name: fullName,
    role: roleLabel(role),
    status: me?.status ? `${shortRole} · ${cap(me.status)}` : shortRole,
    staffId: me?.id || "—",
    workspace: "Barangay 354 Tayuman",
    accountCreated: fmtStamp(me?.createdAt) || "—",
    lastSignIn: fmtStamp(me?.lastSignIn) || "—",
    fullName,
    mobile: me?.phone || "—",
    email: me?.email || session?.email || "—",
    assignedCenter: "Barangay 354 Tayuman Health Center",
    designation: roleLabel(role),
    passwordLastUpdated: fmtStamp(me?.passwordUpdatedAt) || "—",
    alertDelivery: prefs
      ? channels.length
        ? `${channels.join(" · ")} notifications enabled`
        : "All delivery channels disabled"
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
  // "/admin/profile?tab=access" keep working alongside the
  // route-based tabs (Profile/Security/Notifications).
  const tab = searchParams.get("tab");
  const activeTab = TABS.some((x) => x.key === tab) ? tab : "profile";
  const goTab = (key) => setSearchParams({ tab: key });

  const {
    data: me,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/users/me", (raw) => raw?.user ?? null);
  const { data: prefs, refetch: refetchPrefs } = useEndpoint(
    "/users/me/notification-preferences",
    (raw) => raw?.preferences ?? null
  );

  if (isLoading && !me) return <Loading label="Loading profile…" />;

  if (error && !me) {
    return (
      <ErrorState
        title="Could not load your profile"
        message={error}
        onRetry={() => {
          refetch();
          refetchPrefs();
        }}
      />
    );
  }

  const user = buildProfile(me, prefs);

  if (!me) {
    return (
      <EmptyState
        title="Profile unavailable"
        message="No account record was returned for this session."
        action={
          <button type="button" className="ps-edit-btn" onClick={() => refetch()}>
            Try again
          </button>
        }
      />
    );
  }

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
        <Link to="/admin/profile/edit" className="ps-edit-btn">
          <SquarePen size={14} strokeWidth={2.5} />
          Edit profile
        </Link>
      </div>

      {/* ---------- TABS ---------- */}
      <div className="ps-tabs">
        <Link
          to="/admin/profile"
          className={"ps-tab" + (activeTab === "profile" ? " ps-tab--active" : "")}
        >
          My profile
        </Link>
        <Link to="/admin/profile/security" className="ps-tab">
          Security
        </Link>
        <Link to="/admin/profile/notifications" className="ps-tab">
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
                    <p className="ps-info-field__label">Assigned center</p>
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
                  <Link to="/admin/profile/security" className="ps-sec__action">
                    • Change password
                  </Link>
                </div>

                <div className="ps-sec-row">
                  <div className="ps-sec__left">
                    <p className="ps-sec__title">Alert delivery</p>
                    <p className="ps-sec__meta">{user.alertDelivery}</p>
                  </div>
                  <Link to="/admin/profile/notifications" className="ps-sec__action">
                    • Manage
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- ROLE PERMISSIONS ---------- */}
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
          <p style={{ fontSize: 12, color: "#6b7280" }}>
            Your role, assigned permissions and session history will be listed
            here.
          </p>
        </div>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ps-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
