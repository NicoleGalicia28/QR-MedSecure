import { useNavigate } from "react-router-dom";
import { LogOut, Construction } from "lucide-react";
import { signOut } from "./authStore";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState } from "../../lib/ui";
import "./login-layout.css";
import "./RequestSubmittedPage.css";

// Shown to accounts that are approved and signed in, but whose role has no
// workspace in this release yet (e.g. Doctor or Nurse). The account is read
// live from GET /auth/me so the current name and role are always shown.
export default function AccountPendingPage() {
  const navigate = useNavigate();
  const {
    data: account,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/auth/me", (res) => res.user);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  if (isLoading && !account) {
    return (
      <Shell>
        <Loading label="Loading your account…" />
      </Shell>
    );
  }

  if (error || !account) {
    return (
      <Shell>
        <ErrorState
          title="Could not load your account"
          message={error || "Your session could not be verified."}
          onRetry={refetch}
        />
      </Shell>
    );
  }

  const role = account.role || "Staff";
  const fullName =
    account.name || [account.firstName, account.lastName].filter(Boolean).join(" ");

  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        {/* ============ RIGHT PANEL ONLY ============ */}
        <div className="auth-layout__right">
          <div className="request-wrapper">
            <p className="request-eyebrow">• STAFF ACCESS</p>
            <h1 className="request-title">Signed in — workspace pending</h1>
            <p className="request-subtitle">
              Welcome back, {account.firstName}. Your {role} account is active,
              but the {role} workspace isn't available yet.
            </p>

            {/* -------- SUMMARY CARD -------- */}
            <div className="request-card">
              <div className="request-card__header">
                <p className="request-card__status is-approved">
                  • Account approved
                </p>
                <h2 className="request-card__name">{fullName}</h2>
                <p className="request-card__meta">
                  <span>{account.email}</span>
                </p>
              </div>

              <div className="request-row">
                <p className="request-row__label">Assigned role</p>
                <p className="request-row__value">{role}</p>
              </div>

              <div className="request-status-row">
                <div className="request-status-row__left">
                  <p className="request-status-row__title">Account access</p>
                  <p className="request-status-row__desc">
                    Approved by the Secretary (Admin). Sign-in is enabled.
                  </p>
                </div>
                <span className="badge badge--success">• Allowed</span>
              </div>

              <div className="request-status-row">
                <div className="request-status-row__left">
                  <p className="request-status-row__title">
                    {role} workspace
                  </p>
                  <p className="request-status-row__desc">
                    This account type signs in for profile and notification
                    access only — it has no workspace of its own.
                  </p>
                </div>
                <span className="badge badge--pending">• Not assigned</span>
              </div>
            </div>

            {/* -------- INFO BOX -------- */}
            <div className="request-info-box">
              <p className="request-info-box__title">
                <Construction
                  size={13}
                  strokeWidth={2.2}
                  style={{ verticalAlign: "-2px", marginRight: 6 }}
                />
                Think this is wrong?
              </p>
              <p className="request-info-box__text">
                Your Secretary (Admin) assigns roles in user management and can
                move your account to the {role} workspace if it was set up
                incorrectly. Sign out in the meantime, or contact support below.
              </p>
            </div>

            {/* -------- ACTIONS -------- */}
            <div className="request-actions">
              <button
                type="button"
                className="request-btn request-btn--primary"
                onClick={handleSignOut}
              >
                <LogOut size={14} strokeWidth={2.4} /> Sign out
              </button>
              <a
                href="mailto:example@gmail.com"
                className="request-btn request-btn--outline"
              >
                Contact support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        <div className="auth-layout__right">{children}</div>
      </div>
    </div>
  );
}
