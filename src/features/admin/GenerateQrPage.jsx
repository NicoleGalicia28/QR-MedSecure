import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, QrCode, Download, CheckCircle2, RefreshCcw, Ban } from "lucide-react";
import { sendApi, useEndpoint, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import { getSession } from "../auth/authStore";
import "../admin/DashboardPage.css";
import "./GenerateQr.css";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDob(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "—";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function fmtStamp(value) {
  if (!value) return "—";
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

// GET /beneficiaries/:id → identity panel fields.
const selectBeneficiary = (res) => {
  const b = res?.beneficiary;
  if (!b) return null;
  const year = parseInt(String(b.birthDate || "").slice(0, 4), 10);
  const age = year ? new Date().getFullYear() - year : null;
  return {
    name: b.name || `${b.firstName || ""} ${b.lastName || ""}`.trim() || "—",
    publicId: b.publicId || "—",
    program: age !== null && age >= 60 ? "Senior Citizen · Maintenance" : "General",
    dob: `${fmtDob(b.birthDate)}${b.sex ? " · " + b.sex : ""}`,
    address: b.address || "—",
    contact: b.phone || "—",
    status: String(b.status || "active").toLowerCase() === "active"
      ? "Active beneficiary"
      : `Status: ${b.status}`,
  };
};

export default function GenerateQrPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useApiRefresh();
  const beneficiaryId = id || "";

  const session = getSession();
  const issuedBy = session
    ? `${session.firstName} ${session.lastName}`
    : "Secretary (Admin)";

  // Identity panel for the selected beneficiary.
  const identityQuery = useEndpoint(
    beneficiaryId ? `/beneficiaries/${encodeURIComponent(beneficiaryId)}` : "",
    selectBeneficiary,
    { enabled: Boolean(beneficiaryId) }
  );
  const identity = identityQuery.data;

  // ----- real single-use QR issuance -----
  const [qr, setQr] = useState(null); // { qr: {...}, dataUrl, expiresAt }
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [issueSeq, setIssueSeq] = useState(0);
  const [notice, setNotice] = useState(null); // { kind, text }
  const issuedForRef = { current: "" };

  const issue = useCallback(async (force = false) => {
    if (!beneficiaryId) return;
    if (!force && issuedForRef.current === beneficiaryId && qr) return;
    issuedForRef.current = beneficiaryId;
    setIssuing(true);
    setIssueError(null);
    setNotice(null);
    const res = await sendApi(
      `/qr/generate/${encodeURIComponent(beneficiaryId)}`,
      {},
      "POST"
    );
    setIssuing(false);
    if (!res.ok) {
      setIssueError(res.error);
      return;
    }
    setQr(res.data);
    // Keep the ID directory and token history fresh.
    await refresh("/admin/beneficiary-ids");
    await refresh("/qr/tokens");
  }, [beneficiaryId, refresh]);

  useEffect(() => {
    if (!beneficiaryId) return;
    issue(issueSeq > 0);
  }, [beneficiaryId, issueSeq]);

  // Tick so the expiry countdown stays accurate.
  useEffect(() => {
    if (!qr?.expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [qr?.expiresAt]);

  const expiresAt = qr?.expiresAt ? new Date(qr.expiresAt).getTime() : null;
  const isExpired = expiresAt ? expiresAt <= now : false;
  const token = qr?.qr?.token;
  const status = qr?.qr?.status || (qr ? "active" : "");
  const isActive = status === "active" && !isExpired;

  const handleDownload = () => {
    if (qr?.dataUrl) {
      const link = document.createElement("a");
      link.href = qr.dataUrl;
      link.download = `QR-${beneficiaryId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const handleRevoke = async () => {
    if (!token) return;
    setNotice(null);
    const res = await sendApi(
      `/qr/revoke/${encodeURIComponent(token)}`,
      {},
      "POST"
    );
    if (!res.ok) {
      setNotice({ kind: "error", text: res.error });
      return;
    }
    setQr((prev) =>
      prev ? { ...prev, qr: { ...prev.qr, status: "revoked" } } : prev
    );
    setNotice({
      kind: "success",
      text: "QR revoked. Issue a new QR code to continue.",
    });
    await refresh("/admin/beneficiary-ids");
    await refresh("/qr/tokens");
  };

  const handleCreateId = () => {
    navigate(`/admin/beneficiaries/${encodeURIComponent(beneficiaryId)}/id`, {
      state: { qrDataUrl: qr?.dataUrl || null, token: token || null },
    });
  };

  const STEPS = [
    { key: "beneficiary", label: "1 Beneficiary verified", done: Boolean(identity) },
    { key: "generate", label: "2 QR generated", done: Boolean(qr && !isExpired && status === "active") },
    { key: "create", label: "3 Create ID", active: Boolean(qr) },
    { key: "print", label: "4 Save or print", pending: Boolean(qr) },
  ];

  return (
    <>
      {/* Back */}
      <Link to="/admin/ids" className="gq-back">
        <ArrowLeft size={14} /> Beneficiary IDs
      </Link>

      {/* Header */}
      <div className="gq-header">
        <h1 className="gq-header__title">
          {issuing ? "Issuing beneficiary QR…" : qr ? "Beneficiary QR is ready" : "Issue beneficiary QR"}
        </h1>
        <p className="gq-header__subtitle">
          Secretary (Admin) · Beneficiary registry · {identity?.name || "—"} ·{" "}
          {beneficiaryId}
        </p>
      </div>

      {/* Steps */}
      <div className="gq-steps">
        {STEPS.map((s) => (
          <div
            key={s.key}
            className={
              "gq-step" +
              (s.done ? " gq-step--done" : "") +
              (s.active ? " gq-step--active" : "")
            }
          >
            <span className="gq-step__num">{s.label.split(" ")[0]}</span>
            {s.label.replace(/^\d+\s/, "")}
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="gq-info-banner">
        <strong>Single-use QR credential · AES-256 encrypted payload</strong>
        {qr && expiresAt ? (
          <>
            {" "}
            This code expires{" "}
            {new Date(expiresAt).toLocaleString("en-PH", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" "}and is consumed on the first successful scan. Replaying a
            photographed code fails.
          </>
        ) : (
          <> A fresh code is created for this beneficiary each time you issue one.</>
        )}
      </div>

      {notice && (
        <div style={{ marginBottom: 16 }}>
          <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>
        </div>
      )}

      {/* ---------- LAYOUT ---------- */}
      <div className="gq-layout">
        {/* ============ LEFT: QR ============ */}
        <div className="gq-panel">
          <h2 className="gq-panel__title">Generated beneficiary QR</h2>
          <p className="gq-panel__subtitle">
            Single-use credential · Encrypted with AES-256
          </p>

          <div className="gq-qr-wrap">
            {issuing ? (
              <Loading label="Issuing QR code…" />
            ) : issueError ? (
              <ErrorState
                title="Could not issue the QR code"
                message={issueError}
                onRetry={issue}
              />
            ) : (
              <>
                <div className="gq-qr">
                  {qr?.dataUrl ? (
                    <img
                      src={qr.dataUrl}
                      alt={`QR code for ${beneficiaryId}`}
                      width={180}
                      height={180}
                      style={{ display: "block" }}
                    />
                  ) : (
                    <QrCode size={180} strokeWidth={1} color="#0a3d3d" />
                  )}
                </div>

                <p className="gq-qr-id-label">
                  • {isActive ? "GENERATED" : status === "revoked" ? "REVOKED" : isExpired ? "EXPIRED" : "ISSUED"}
                </p>
                <p className="gq-qr-id">{beneficiaryId}</p>
                <p className="gq-qr-meta">
                  {qr ? `${fmtStamp(qr.qr?.issuedAt || qr.expiresAt)} · ${issuedBy}` : "Awaiting issuance"}
                </p>
                {qr && (
                  <p className="gq-qr-meta" style={{ marginTop: 2 }}>
                    {isExpired ? (
                      <span style={{ color: "#b91c1c" }}>Expired · issue a new code</span>
                    ) : (
                      <>
                        Expires{" "}
                        {new Date(expiresAt).toLocaleTimeString("en-PH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                )}

                <button
                  type="button"
                  className="gq-download"
                  onClick={handleDownload}
                  disabled={!qr?.dataUrl}
                >
                  <Download size={14} /> Save QR image
                </button>

                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="gq-download"
                    onClick={() => {
                      issuedForRef.current = "";
                      setQr(null);
                      setIssueSeq((n) => n + 1);
                    }}
                    disabled={issuing}
                  >
                    <RefreshCcw size={14} /> {qr ? "Issue new QR" : "Retry"}
                  </button>
                  {qr && status === "active" && (
                    <button
                      type="button"
                      className="gq-download"
                      onClick={handleRevoke}
                      disabled={!isActive}
                      style={{ color: "#b91c1c" }}
                    >
                      <Ban size={14} /> Revoke
                    </button>
                  )}
                </div>

                <p className="gq-qr-note">
                  Single use: the first successful scan consumes this code. If it
                  is lost or photographed, revoke it and issue a new one from the
                  beneficiary record.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ============ RIGHT: IDENTITY + NEXT STEP ============ */}
        <div>
          {/* Identity details */}
          <div className="gq-panel">
            <h2 className="gq-panel__title">Identity details</h2>

            {identityQuery.isLoading ? (
              <Loading label="Loading beneficiary…" />
            ) : identityQuery.error ? (
              <ErrorState message={identityQuery.error} onRetry={identityQuery.refetch} />
            ) : !identity ? (
              <ErrorState
                title="Beneficiary not found"
                message="Open this screen from the registry or ID directory."
              />
            ) : (
              <>
                <div className="gq-identity-header">
                  <div>
                    <p className="gq-identity__name">{identity.name}</p>
                    <p className="gq-identity__program">{identity.program}</p>
                  </div>
                  <span className="gq-active-pill">
                    • {identity.status}
                  </span>
                </div>

                <div className="gq-grid">
                  <div className="gq-field">
                    <span className="gq-field__label">Beneficiary ID</span>
                    <span className="gq-field__value">{identity.publicId}</span>
                  </div>
                  <div className="gq-field">
                    <span className="gq-field__label">Date of birth</span>
                    <span className="gq-field__value">{identity.dob}</span>
                  </div>
                  <div className="gq-field">
                    <span className="gq-field__label">Address</span>
                    <span className="gq-field__value gq-field__value--muted">
                      {identity.address}
                    </span>
                  </div>
                  <div className="gq-field">
                    <span className="gq-field__label">Contact</span>
                    <span className="gq-field__value">{identity.contact}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Next step */}
          <div className="gq-panel">
            <h2 className="gq-panel__title">
              Next step: create a beneficiary ID
            </h2>
            <p className="gq-panel__subtitle">
              Use the QR with basic ID print services.
            </p>

            <div className="gq-next__list">
              <div className="gq-next__item">
                <CheckCircle2 size={14} strokeWidth={2.5} />
                Beneficiary details reviewed against the registry.
              </div>
              <div className="gq-next__item">
                <CheckCircle2 size={14} strokeWidth={2.5} />
                QR reference linked to{" "}
                <strong style={{ marginLeft: 4 }}>{beneficiaryId}</strong>.
              </div>
              <div className="gq-next__item">
                <CheckCircle2 size={14} strokeWidth={2.5} />
                Create a front-and-back ID preview, then save the ID for print
                or print at a physical card. Creating an ID does not change
                medicine eligibility.
              </div>
            </div>

            <div className="gq-actions">
              <button
                type="button"
                className="gq-btn gq-btn--primary"
                onClick={handleCreateId}
                disabled={!qr}
              >
                <QrCode size={14} strokeWidth={2.5} />
                Create ID
              </button>
              <Link
                to="/admin/beneficiaries"
                className="gq-btn gq-btn--outline"
              >
                Back to registry
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="gq-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
