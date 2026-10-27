import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Check, X } from "lucide-react";
import { useEndpoint, sendApi } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./ApprovalRequestReview.css";

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

// GET /admin/users/requests/:id → { request: { id, name, email, role, status,
// reason, reviewedBy, submittedAt } }.
function mapRequest(r) {
  if (!r || !r.id) return null;
  return {
    id: r.id,
    name: r.name || r.email || "Applicant",
    email: r.email || "—",
    role: r.role || "—",
    status: String(r.status || "pending").toLowerCase(),
    reason: r.reason || "",
    reviewedBy: r.reviewedBy || "",
    submittedAt: fmtStamp(r.submittedAt) || "—",
  };
}

export default function ApprovalRequestReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const {
    data: applicant,
    isLoading,
    error,
    refetch,
  } = useEndpoint(
    id ? `/admin/users/requests/${id}` : null,
    (res) => mapRequest(res.request),
    { enabled: Boolean(id) },
  );

  const decide = async (decision) => {
    if (!applicant) return;
    setBusy(true);
    setNotice(null);
    const res = await sendApi(`/admin/users/requests/${applicant.id}/review`, {
      decision,
    });
    if (!res.ok) {
      setBusy(false);
      setNotice({ kind: "error", text: res.error });
      return;
    }
    if (decision === "rejected" && rejectReason.trim()) {
      await sendApi("/admin/audit", {
        action: "Rejected account request",
        target: applicant.email,
        reason: rejectReason.trim(),
      });
    }
    setBusy(false);
    navigate("/admin/users/requests");
  };

  if (isLoading && !applicant) {
    return <Loading label="Loading approval request…" />;
  }

  if (error || !applicant) {
    return (
      <ErrorState
        title="Approval request not found"
        message={error || "No account request matches this id."}
        onRetry={refetch}
      />
    );
  }

  const isPending = applicant.status === "pending";

  // Timeline derived from the real request record.
  const audit = [
    {
      time: applicant.submittedAt,
      event: "Request submitted",
      by: applicant.name,
      reason: null,
      badge: "• Open",
      badgeClass: "ar-timeline__badge--open",
    },
  ];
  if (!isPending) {
    audit.push({
      time: applicant.reviewedBy ? "Reviewed" : "Reviewed",
      event:
        applicant.status === "approved" ? "Request approved" : "Request rejected",
      by: applicant.reviewedBy || "Secretary (Admin)",
      reason: applicant.reason || null,
      badge: applicant.status === "approved" ? "• Approved" : "• Rejected",
      badgeClass:
        applicant.status === "approved"
          ? "ar-timeline__badge--open"
          : "ar-timeline__badge--pending",
    });
  }

  return (
    <>
      {/* Back */}
      <Link to="/admin/users" className="ar-back">
        <ArrowLeft size={14} /> User &amp; role management · Approval requests
      </Link>

      {/* Header */}
      <div className="ar-header">
        <h1 className="ar-header__title">Review account request</h1>
        <p className="ar-header__subtitle">
          Approval request · {applicant.id} · Submitted {applicant.submittedAt}
        </p>
      </div>

      {notice ? <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice> : null}

      {/* ---------- LAYOUT ---------- */}
      <div className="ar-layout">
        {/* ============ LEFT ============ */}
        <div>
          {/* Applicant details */}
          <div className="ar-panel">
            <h2 className="ar-panel__title">Applicant details</h2>

            <span
              className={
                "ar-status-pill" +
                (applicant.status === "approved"
                  ? " ar-status-pill--approved"
                  : applicant.status === "rejected"
                    ? " ar-status-pill--rejected"
                    : "")
              }
            >
              •{" "}
              {applicant.status === "approved"
                ? "Approved · Access allowed"
                : applicant.status === "rejected"
                  ? "Rejected · Access not allowed"
                  : "Pending approval"}
            </span>

            <div className="ar-grid">
              <div className="ar-field">
                <span className="ar-field__label">Full name</span>
                <span className="ar-field__value">{applicant.name}</span>
              </div>
              <div className="ar-field">
                <span className="ar-field__label">Requested role</span>
                <span className="ar-field__value">{applicant.role}</span>
              </div>

              <div className="ar-field">
                <span className="ar-field__label">Email address</span>
                <span className="ar-field__value">{applicant.email}</span>
              </div>
              <div className="ar-field">
                <span className="ar-field__label">Date submitted</span>
                <span className="ar-field__value">{applicant.submittedAt}</span>
              </div>

              <div className="ar-field">
                <span className="ar-field__label">Reviewed by</span>
                <span className="ar-field__value">
                  {applicant.reviewedBy || "Not yet reviewed"}
                </span>
              </div>
              <div className="ar-field">
                <span className="ar-field__label">Status</span>
                <span className="ar-field__value">
                  {applicant.status === "approved"
                    ? "Approved"
                    : applicant.status === "rejected"
                      ? "Rejected"
                      : "Pending"}
                </span>
              </div>
            </div>

            {applicant.reason ? (
              <div className="ar-field" style={{ marginTop: 14 }}>
                <span className="ar-field__label">Reason on file</span>
                <span className="ar-field__value">{applicant.reason}</span>
              </div>
            ) : null}

            {isPending ? (
              <>
                <div className="ar-check">
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Application details confirmed against the request record
                </div>
                <div className="ar-check">
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Approving grants workspace access for the {applicant.role} scope
                </div>

                <div className="ar-note">
                  Approve to grant the {applicant.role} workspace, or reject to
                  block sign-in for this account.
                </div>

                <div className="ar-actions">
                  <button
                    type="button"
                    className="ar-btn ar-btn--primary"
                    onClick={() => decide("approved")}
                    disabled={busy}
                  >
                    <Check size={14} strokeWidth={2.5} />
                    {busy ? "Working…" : `Approve ${applicant.role} access`}
                  </button>
                  <Link to="/admin/users/requests" className="ar-btn ar-btn--outline">
                    Back to requests
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="ar-note">
                  {applicant.reviewedBy
                    ? `Reviewed by ${applicant.reviewedBy}.`
                    : "This request has already been reviewed."}
                </div>
                <div className="ar-actions">
                  <Link to="/admin/users/requests" className="ar-btn ar-btn--outline">
                    Back to requests
                  </Link>
                  <Link to="/admin/users" className="ar-btn ar-btn--outline">
                    Back to registry
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Access audit */}
          <div className="ar-panel">
            <h2 className="ar-panel__title">Access audit</h2>

            {audit.map((a, i) => (
              <div className="ar-timeline-item" key={i}>
                <span className="ar-timeline__time">{a.time}</span>
                <div>
                  <p className="ar-timeline__event">{a.event}</p>
                  <p className="ar-timeline__by">{a.by}</p>
                  {a.reason && <p className="ar-timeline__reason">{a.reason}</p>}
                </div>
                <span className={`ar-timeline__badge ${a.badgeClass}`}>
                  {a.badge}
                </span>
              </div>
            ))}

            <div className="ar-timeline-footer">
              <span>
                Showing {audit.length} of {audit.length} event
                {audit.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        <div>
          {/* Outcome */}
          <div className="ar-side-panel">
            <h2 className="ar-side-panel__title">
              {applicant.status === "approved" ? "Approved outcome" : "Review status"}
            </h2>

            {applicant.status === "approved" ? (
              <>
                <span className="ar-approved-pill">
                  • Approved · {applicant.role}
                </span>

                <div className="ar-side-row">
                  <p className="ar-side__label">Approved by</p>
                  <p className="ar-side__value">
                    {applicant.reviewedBy || "Secretary (Admin)"}
                  </p>
                </div>

                <div className="ar-success">
                  <strong>Access assigned for {applicant.name}</strong>
                  The {applicant.role} account can now sign in to its workspace.
                </div>
              </>
            ) : (
              <>
                <div className="ar-side-row">
                  <p className="ar-side__label">Requested role</p>
                  <p className="ar-side__value">{applicant.role}</p>
                </div>
                <div className="ar-side-row">
                  <p className="ar-side__label">Status</p>
                  <p className="ar-side__value">
                    {applicant.status === "rejected" ? "Rejected" : "Pending review"}
                  </p>
                </div>
                <div className="ar-side-row">
                  <p className="ar-side__label">Submitted</p>
                  <p className="ar-side__value">{applicant.submittedAt}</p>
                </div>
              </>
            )}

            <div className="ar-side-actions" style={{ marginTop: 14 }}>
              <Link
                to="/admin/users"
                className="ar-side-btn ar-side-btn--outline"
              >
                Return to staff directory
              </Link>
            </div>
          </div>

          {/* Reject request (only while pending) */}
          {isPending ? (
            <div className="ar-side-panel">
              <h2 className="ar-side-panel__title">Reject request?</h2>

              <label className="ar-danger-label" htmlFor="reject-reason">
                Reason (recorded in the audit trail)
              </label>
              <textarea
                id="reject-reason"
                className="ar-danger-textarea"
                placeholder="Appointment document could not be verified. Please re-submit an updated document."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />

              <div className="ar-side-actions">
                <button
                  type="button"
                  className="ar-side-btn ar-side-btn--danger"
                  onClick={() => decide("rejected")}
                  disabled={busy}
                >
                  <X size={13} strokeWidth={2.5} />
                  {busy ? "Working…" : "Confirm rejection"}
                </button>
              </div>

              <div className="ar-warning">
                <strong>Alternative action</strong>
                Hold the request and return to the account requests queue. The
                request will remain pending without a decision.
              </div>
            </div>
          ) : null}

          {/* Approval boundary info box */}
          <div className="ar-info">
            <strong>Approval boundary</strong>
            Secretary (Admin) approves and assigns roles. No other role performs
            staff approvals. The Secretary (Admin) role cannot be self-assigned.
          </div>
        </div>
      </div>

      {/* Page footer */}
      <div className="ar-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
