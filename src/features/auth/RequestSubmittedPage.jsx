import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Activity, Users, QrCode, Pill } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState } from "../../lib/ui";
import "./login-layout.css";
import "./RequestSubmittedPage.css";

// "2026-10-06T08:30:00Z" → "06 Oct 2026, 08:30".
function fmtStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Map the real request row onto the display fields.
function mapRequest(r) {
  if (!r || !r.id) return null;
  const parts = String(r.name || "").trim().split(/\s+/);
  return {
    id: r.id,
    firstName: parts[0] || r.email || "Applicant",
    lastName: parts.slice(1).join(" "),
    email: r.email || "—",
    role: r.role || "—",
    status: String(r.status || "pending").toLowerCase(),
    reviewedBy: r.reviewedBy || "",
    submittedAt: fmtStamp(r.submittedAt) || "—",
    reason: r.reason || "",
  };
}

// Map the server review status to display text + badge styling.
function reviewInfo(status) {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        badge: "badge--success",
        status: "Approved",
        statusClass: "is-approved",
      };
    case "rejected":
      return {
        label: "Rejected",
        badge: "badge--blocked",
        status: "Rejected",
        statusClass: "is-rejected",
      };
    default:
      return {
        label: "Pending",
        badge: "badge--pending",
        status: "Pending approval",
        statusClass: "is-pending",
      };
  }
}

export default function RequestSubmittedPage() {
  // The request is looked up by id + email from the query string, which is
  // what the public status endpoint requires, so a refresh keeps working.
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const email = params.get("email");

  const path =
    id && email
      ? `/auth/requests/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`
      : null;

  const {
    data: request,
    isLoading,
    error,
    refetch,
  } = useEndpoint(path, (res) => mapRequest(res.request), {
    enabled: Boolean(path),
    staleTime: 0,
  });

  // Poll every 10s so an approval/rejection shows up without a reload.
  useEffect(() => {
    if (!path) return undefined;
    const timer = setInterval(() => refetch(), 10_000);
    return () => clearInterval(timer);
  }, [path, refetch]);

  // No id/email (bad link or direct visit) -> safe fallback instead of a crash.
  if (!path) {
    return (
      <AuthShell>
        <div className="request-wrapper">
          <Link to="/login" className="request-back">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
          <p className="request-eyebrow">• STAFF ACCESS</p>
          <h1 className="request-title">No request found</h1>
          <p className="request-subtitle">
            We couldn't load your account request. Please submit a new
            request or contact your barangay administrator.
          </p>
          <div className="request-actions">
            <Link to="/signup" className="request-btn request-btn--primary">
              Submit a new request
            </Link>
            <Link to="/login" className="request-btn request-btn--outline">
              Return to sign in
            </Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (isLoading && !request) {
    return (
      <AuthShell>
        <Loading label="Checking your request…" />
      </AuthShell>
    );
  }

  if (error || !request) {
    return (
      <AuthShell>
        <ErrorState
          title="Could not load your request"
          message={error || "This request could not be found."}
          onRetry={refetch}
        />
      </AuthShell>
    );
  }

  const {
    firstName,
    lastName,
    role,
    submittedAt,
    reviewedBy,
    status,
  } = request;

  const review = reviewInfo(status);
  const access =
    status === "approved"
      ? { label: "Allowed", badge: "badge--success" }
      : { label: "Not yet allowed", badge: "badge--blocked" };

  const subtitle =
    status === "approved"
      ? "Your account has been approved. You can now sign in to your assigned workspace."
      : status === "rejected"
        ? "Your account request was not approved. Contact your barangay administrator for details."
        : "Your account is awaiting Secretary (Admin) approval. This page refreshes automatically.";

  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        {/* ============ LEFT PANEL ============ */}
        <div className="auth-layout__left">
          <BrandPanel />
        </div>

        {/* ============ RIGHT PANEL ============ */}
        <div className="auth-layout__right">
          <div className="request-wrapper">
            <Link to="/login" className="request-back">
              <ArrowLeft size={14} /> Back to sign in
            </Link>

            <p className="request-eyebrow">• STAFF ACCESS</p>
            <h1 className="request-title">Your request has been submitted</h1>
            <p className="request-subtitle">{subtitle}</p>

            {/* -------- SUMMARY CARD -------- */}
            <div className="request-card">
              <div className="request-card__header">
                <p className={`request-card__status ${review.statusClass}`}>
                  • {review.status}
                </p>
                <h2 className="request-card__name">
                  {firstName} {lastName}
                </h2>
                <p className="request-card__meta">
                  <span>Request ID: {id}</span>
                  <span className="dot">·</span>
                  <span>Submitted {submittedAt}</span>
                </p>
              </div>

              {/* Requested role */}
              <div className="request-row">
                <p className="request-row__label">Requested role</p>
                <p className="request-row__value">{role}</p>
              </div>

              {/* Email */}
              <div className="request-row">
                <p className="request-row__label">Email address</p>
                <p className="request-row__value">{email}</p>
              </div>

              {/* Status timeline */}
              <div className="request-status-row">
                <div className="request-status-row__left">
                  <p className="request-status-row__title">
                    Account request received
                  </p>
                  <p className="request-status-row__desc">
                    Identity and account details queued for review.
                  </p>
                </div>
                <span className="badge badge--submitted">• Submitted</span>
              </div>

              <div className="request-status-row">
                <div className="request-status-row__left">
                  <p className="request-status-row__title">
                    Secretary (Admin) review
                  </p>
                  <p className="request-status-row__desc">
                    {reviewedBy
                      ? `Reviewed by ${reviewedBy}.`
                      : "The barangay Admin will confirm your appointment and assigned access."}
                  </p>
                </div>
                <span className={`badge ${review.badge}`}>• {review.label}</span>
              </div>

              <div className="request-status-row">
                <div className="request-status-row__left">
                  <p className="request-status-row__title">Workspace access</p>
                  <p className="request-status-row__desc">
                    After approval, sign in to your assigned workspace.
                  </p>
                </div>
                <span className={`badge ${access.badge}`}>• {access.label}</span>
              </div>
            </div>

            {/* -------- INFO BOX -------- */}
            <div className="request-info-box">
              <p className="request-info-box__title">
                No record access while pending
              </p>
              <p className="request-info-box__text">
                Access to records, registry, medical history, QR/ID and reports
                remains disabled until approval.
              </p>
            </div>

            {/* -------- ACTIONS -------- */}
            <div className="request-actions">
              <Link to="/login" className="request-btn request-btn--primary">
                Return to sign in
              </Link>
              <a
                href="mailto:example@gmail.com"
                className="request-btn request-btn--outline"
              >
                Contact support
              </a>
            </div>

            {/* -------- FOOTER -------- */}
            <div className="request-footer">
              <p>
                Questions about your request?{" "}
                <a href="mailto:example@gmail.com">example@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Reusable left panel ---------------- */

function AuthShell({ children }) {
  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        <div className="auth-layout__left">
          <BrandPanel />
        </div>
        <div className="auth-layout__right">{children}</div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <>
      <div className="login-brand">
        <div className="login-brand__icon">
          <Activity size={20} strokeWidth={2.5} />
        </div>
        <div className="login-brand__text">
          <span className="login-brand__title">QR-MedSecure</span>
          <span className="login-brand__subtitle">BARANGAY HEALTH ACCESS</span>
        </div>
      </div>

      <div className="login-hero">
        <p className="login-hero__eyebrow">
          BARANGAY 354 TAYUMAN · MANILA
        </p>
        <h1 className="login-hero__title">
          Better access.
          <br />
          Safer medicine.
          <br />
          Stronger community.
        </h1>
        <p className="login-hero__description">
          One secure workspace for the people who keep barangay healthcare
          moving.
        </p>

        <div className="login-steps">
          <div className="login-steps__icons">
            <div className="login-steps__icon-box">
              <Users size={24} strokeWidth={1.8} />
            </div>
            <div className="login-steps__icon-box">
              <QrCode size={24} strokeWidth={1.8} />
            </div>
            <div className="login-steps__icon-box">
              <Pill size={24} strokeWidth={1.8} />
            </div>
          </div>
          <p className="login-steps__caption">
            People <span className="arrow">→</span> Secure identification{" "}
            <span className="arrow">→</span> Care
          </p>
          <p className="login-steps__note">
            Designed for accountable, role-based medicine access.
          </p>
        </div>
      </div>

      <div className="login-footer">
        <p>A barangay health initiative</p>
        <p>Confidentiality is part of every step.</p>
      </div>
    </>
  );
}