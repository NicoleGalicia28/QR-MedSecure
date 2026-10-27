import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import "./AccountRequestsPage.css";
import "./UserRoleManagement.css";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function fmtStamp(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status) {
  switch (status) {
    case "approved":
      return { label: "Approved", cls: "req-badge--success" };
    case "rejected":
      return { label: "Rejected", cls: "req-badge--blocked" };
    default:
      return { label: "Pending", cls: "req-badge--pending" };
  }
}

export default function AccountRequestsPage() {
  const [tab, setTab] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);
  const refresh = useApiRefresh();

  const {
    data: requests,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/admin/users/requests", (res) => res.requests);

  const rows = requests || [];
  const count = (status) => rows.filter((r) => r.status === status).length;

  const visible = rows.filter((r) => r.status === tab);

  const review = async (id, decision) => {
    setBusyId(id);
    setNotice(null);
    const res = await sendApi(`/admin/users/requests/${id}/review`, { decision });
    setBusyId(null);
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setNotice({
      kind: "success",
      text: decision === "approved" ? "Request approved. The account is now active." : "Request rejected.",
    });
    await refresh("/admin/users/requests");
    await refresh("/admin/users");
  };

  return (
    <div className="req-page">
      <div className="req-head">
        <div>
          <h1 className="req-title">Account requests</h1>
          <p className="req-subtitle">
            Review staff account requests. Approving grants workspace access;
            rejecting blocks it. Decisions are saved to the request record.
          </p>
        </div>
        <div className="req-stats">
          <span className="req-stat">
            <strong>{count("pending")}</strong> Pending
          </span>
          <span className="req-stat req-stat--ok">
            <strong>{count("approved")}</strong> Approved
          </span>
          <span className="req-stat req-stat--no">
            <strong>{count("rejected")}</strong> Rejected
          </span>
        </div>
      </div>

      {notice ? (
        <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
      ) : null}

      <div className="urm-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"urm-tab" + (tab === t.key ? " urm-tab--active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {count(t.key) > 0 ? (
              <span className="urm-tab__count">({count(t.key)})</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading && !requests ? <Loading label="Loading account requests…" /> : null}

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState
          title="No account requests yet"
          message="Requests submitted from the sign-up form will appear here for review."
        />
      ) : null}

      {!error && rows.length > 0 && visible.length === 0 ? (
        <EmptyState
          title={`No ${tab} requests`}
          message="Nothing matches this filter right now."
        />
      ) : null}

      {!error && visible.length > 0 ? (
        <ul className="req-list">
          {visible.map((r) => {
            const badge = statusBadge(r.status);
            const isApproved = r.status === "approved";
            const isRejected = r.status === "rejected";
            const isBusy = busyId === r.id;

            return (
              <li key={r.id} className="req-card">
                <div className="req-card__main">
                  <div>
                    <h2 className="req-card__name">
                      <Link
                        to={`/admin/users/requests/${r.id}`}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {r.name}
                      </Link>
                    </h2>
                    <p className="req-card__meta">{r.email}</p>
                  </div>

                  <div className="req-card__facts">
                    <span className="req-fact">
                      <span className="req-fact__label">Role</span>
                      <span className="req-fact__value">{r.role}</span>
                    </span>
                    <span className="req-fact">
                      <span className="req-fact__label">Request ID</span>
                      <span className="req-fact__value">{r.id}</span>
                    </span>
                    <span className="req-fact">
                      <span className="req-fact__label">Submitted</span>
                      <span className="req-fact__value">
                        {fmtStamp(r.submittedAt)}
                      </span>
                    </span>
                  </div>

                  <div className="req-card__badges">
                    <span className={`req-badge ${badge.cls}`}>
                      • {badge.label}
                    </span>
                    {r.reviewedBy ? (
                      <span className="req-badge req-badge--pending">
                        Reviewed by {r.reviewedBy}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="req-card__actions">
                  <button
                    type="button"
                    className={
                      "req-btn req-btn--approve" + (isApproved ? " is-current" : "")
                    }
                    onClick={() => review(r.id, "approved")}
                    disabled={isApproved || isBusy}
                  >
                    <Check size={15} strokeWidth={2.5} />
                    {isApproved ? "Approved" : isBusy ? "Working…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={
                      "req-btn req-btn--reject" + (isRejected ? " is-current" : "")
                    }
                    onClick={() => review(r.id, "rejected")}
                    disabled={isRejected || isBusy}
                  >
                    <X size={15} strokeWidth={2.5} />
                    {isRejected ? "Rejected" : "Reject"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
