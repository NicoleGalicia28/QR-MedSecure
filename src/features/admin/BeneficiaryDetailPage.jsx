import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  SquarePen,
  FileText,
  QrCode,
  CheckCircle2,
} from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./BeneficiaryDetail.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "medical", label: "Medical history" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "dispensing", label: "Dispensing" },
];

// ---- helpers --------------------------------------------------------------
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function ageFrom(birthDate) {
  const year = parseInt(String(birthDate || "").slice(0, 4), 10);
  return year ? new Date().getFullYear() - year : null;
}

// "1964-02-14" → "14 Feb 1964" (manual parse, no timezone drift).
function fmtDob(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "—";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// ISO timestamp → "01 Oct 2026"
function fmtDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "—";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// ISO timestamp → "05 Oct 2026, 10:08"
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

function normStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("review") || s === "for_review") return "review";
  if (s === "inactive" || s === "archived") return "archived";
  return "active";
}

const STATUS_LABEL = {
  active: "Active beneficiary",
  review: "For review",
  archived: "Archived record",
};

// GET /beneficiaries/:id → { beneficiary, records }
const selectDetail = (res) => {
  const b = res?.beneficiary;
  if (!b) return null;
  const age = ageFrom(b.birthDate);
  return {
    key: b.publicId || String(b.id),
    name: b.name || `${b.firstName || ""} ${b.lastName || ""}`.trim() || "—",
    publicId: b.publicId || "—",
    status: normStatus(b.status),
    registeredAt: fmtDate(b.createdAt),
    registeredBy: b.registeredBy || "—",
    dob: fmtDob(b.birthDate),
    age: age === null ? "—" : age,
    sex: b.sex || "—",
    area: b.area || "—",
    address: b.address || "—",
    contact: b.phone || "—",
    program: b.program || (age !== null && age >= 60 ? "Senior Citizen · Maintenance" : "General"),
    records: Array.isArray(res.records) ? res.records : [],
  };
};

// GET /prescriptions?beneficiaryId= → { prescriptions: [...] }
const selectPrescriptions = (res) =>
  Array.isArray(res.prescriptions) ? res.prescriptions : [];

// GET /transactions?beneficiaryId= → { transactions: [...] }
const selectTransactions = (res) =>
  Array.isArray(res.transactions) ? res.transactions : [];

export default function BeneficiaryDetailPage() {
  const { id } = useParams();
  const refresh = useApiRefresh();
  const [activeTab, setActiveTab] = useState("overview");

  const detailQuery = useEndpoint(
    id ? `/beneficiaries/${encodeURIComponent(id)}` : "",
    selectDetail,
    { enabled: Boolean(id) }
  );
  const rxQuery = useEndpoint(
    id ? `/prescriptions?beneficiaryId=${encodeURIComponent(id)}` : "",
    selectPrescriptions,
    { enabled: Boolean(id) }
  );
  const txQuery = useEndpoint(
    id ? `/transactions?beneficiaryId=${encodeURIComponent(id)}` : "",
    selectTransactions,
    { enabled: Boolean(id) }
  );

  const [reviewState, setReviewState] = useState(null); // {kind, text}

  const detail = detailQuery.data;
  const prescriptions = rxQuery.data ?? [];
  const transactions = txQuery.data ?? [];

  // Last dispensed per medicine, from this beneficiary's real transactions.
  const lastDispensed = {};
  for (const t of transactions) {
    const name = t.medicine || "";
    if (name && !lastDispensed[name]) {
      lastDispensed[name] = `${fmtDate(t.at)} · ${t.quantity} ${t.quantity === 1 ? "unit" : "units"}`;
    }
  }

  // "Mark as reviewed" — flips a for-review record to active via the real
  // PUT /beneficiaries/:id endpoint.
  const [reviewBusy, setReviewBusy] = useState(false);
  const handleMarkReviewed = async () => {
    setReviewBusy(true);
    setReviewState(null);
    const res = await sendApi(
      `/beneficiaries/${encodeURIComponent(id)}`,
      { status: "active" },
      "PUT"
    );
    setReviewBusy(false);
    if (!res.ok) {
      setReviewState({ kind: "error", text: res.error });
      return;
    }
    setReviewState({ kind: "success", text: "Record marked as reviewed." });
    await refresh(`/beneficiaries/${encodeURIComponent(id)}`);
    await refresh("/beneficiaries");
    await refresh("/dashboard");
  };

  if (detailQuery.isLoading && !detail) {
    return <Loading label="Loading beneficiary record…" />;
  }
  if (detailQuery.error && !detail) {
    return (
      <ErrorState
        title="Could not load this beneficiary"
        message={detailQuery.error}
        onRetry={detailQuery.refetch}
      />
    );
  }
  if (!detail) {
    return (
      <EmptyState
        title="Beneficiary not found"
        message="This record does not exist or was removed."
        action={
          <Link to="/admin/beneficiaries" className="bd-btn bd-btn--outline">
            Back to registry
          </Link>
        }
      />
    );
  }

  const allergyRecord = detail.records.find((r) => /allerg/i.test(r.type || ""));
  const activeRx = prescriptions.find((p) => p.status === "active") || prescriptions[0];
  const isReviewed = detail.status === "active";

  return (
    <>
      {/* Back */}
      <Link to="/admin/beneficiaries" className="bd-back">
        <ArrowLeft size={14} /> Beneficiary registry
      </Link>

      {/* Header */}
      <div className="bd-header">
        <div>
          <h1 className="bd-header__title">{detail.name}</h1>
          <p className="bd-header__subtitle">
            Clinical record · {detail.publicId} · Secretary (Admin)
          </p>
        </div>
        <div className="bd-actions">
          <Link
            to={`/admin/beneficiaries/${detail.publicId}/edit`}
            className="bd-btn bd-btn--primary"
          >
            <SquarePen size={14} strokeWidth={2.5} />
            Edit beneficiary
          </Link>
          <button
            type="button"
            className="bd-btn bd-btn--outline"
            onClick={() => setActiveTab("medical")}
          >
            <FileText size={14} strokeWidth={2.5} />
            Medical history
          </button>
          <Link
            to={`/admin/beneficiaries/${detail.publicId}/qr`}
            className="bd-btn bd-btn--outline"
          >
            <QrCode size={14} strokeWidth={2.5} />
            QR / ID
          </Link>
        </div>
      </div>

      {/* Allergy banner — only when the record carries an allergy entry */}
      {allergyRecord && (
        <div className="bd-banner">
          <strong>Recorded allergy: {allergyRecord.type}</strong>
          <br />
          {fmtDate(allergyRecord.recordedAt)} · {allergyRecord.findings || "Reported by " + allergyRecord.recordedBy}
          . Review the allergy record and clinician prescription before dispensing.
        </div>
      )}

      {/* Tabs */}
      <div className="bd-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={
              "bd-tab" + (activeTab === t.key ? " bd-tab--active" : "")
            }
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="bd-layout">
        {/* ============ LEFT: BENEFICIARY INFORMATION ============ */}
        <aside className="bd-side">
          <h2 className="bd-side__title">Beneficiary information</h2>
          <span className="bd-side__status">
            • {STATUS_LABEL[detail.status] || "Beneficiary"}
          </span>

          <div className="bd-side__field">
            <p className="bd-side__label">Registered</p>
            <p className="bd-side__value bd-side__value--muted">
              {detail.registeredAt} · {detail.registeredBy}
            </p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Beneficiary ID</p>
            <p className="bd-side__value bd-side__value--muted">
              {detail.publicId}
            </p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Date of birth</p>
            <p className="bd-side__value">{detail.dob}</p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Age / sex</p>
            <p className="bd-side__value">
              {detail.age} · {detail.sex}
            </p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Area</p>
            <p className="bd-side__value">{detail.area}</p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Address</p>
            <p className="bd-side__value bd-side__value--muted">
              {detail.address}
            </p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Contact number</p>
            <p className="bd-side__value">{detail.contact}</p>
          </div>

          <div className="bd-side__field">
            <p className="bd-side__label">Program</p>
            <p className="bd-side__value">{detail.program}</p>
          </div>

          <p className="bd-side__note">
            Identity fields come from the barangay registry record.
          </p>
        </aside>

        {/* ============ RIGHT: TAB CONTENT ============ */}
        <div>
          {/* ---- OVERVIEW TAB ---- */}
          {activeTab === "overview" && (
            <>
              {/* Current prescription */}
              <div className="bd-panel">
                <h2 className="bd-panel__title">Current prescription</h2>
                <p className="bd-panel__subtitle">
                  Prescribed by attending clinician.
                </p>

                {rxQuery.isLoading ? (
                  <Loading label="Loading prescriptions…" />
                ) : rxQuery.error ? (
                  <ErrorState message={rxQuery.error} onRetry={rxQuery.refetch} />
                ) : !activeRx && detail.records.every((r) => !r.prescription) ? (
                  <EmptyState
                    title="No prescriptions on file"
                    message="Prescriptions issued for this beneficiary will appear here."
                  />
                ) : (
                  <>
                    {detail.records
                      .filter((r) => r.prescription)
                      .slice(0, 1)
                      .map((r) => (
                        <div key={`rec-${r.id}`} style={{ marginBottom: activeRx ? 14 : 0 }}>
                          <div className="bd-rx-meta__label" style={{ marginBottom: 6 }}>
                            Prescription (recorded)
                          </div>
                          <p style={{ fontSize: 12.5, color: "#1f2937", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                            {r.prescription}
                          </p>
                          <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0 0" }}>
                            Recorded by {r.recordedBy} on {fmtStamp(r.recordedAt)} · {r.code}
                          </p>
                        </div>
                      ))}

                    {activeRx && (
                      <>
                        <div className="bd-rx-meta" style={{ marginTop: detail.records.some((r) => r.prescription) && activeRx ? 12 : 0 }}>
                          <div>
                            <p className="bd-rx-meta__label">Prescription</p>
                            <p className="bd-rx-meta__value">{activeRx.code}</p>
                          </div>
                          <div>
                            <p className="bd-rx-meta__label">Prescriber</p>
                            <p className="bd-rx-meta__value">
                              {activeRx.prescribedBy || "—"}
                            </p>
                          </div>
                          <span className="bd-rx-valid">
                            • Valid through {fmtDate(activeRx.validUntil)}
                          </span>
                        </div>

                        <table className="bd-table">
                          <thead>
                            <tr>
                              <th>Medicine</th>
                              <th>Directions</th>
                              <th>Authorized quantity</th>
                              <th>Last dispensed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prescriptions.map((p) => (
                              <tr key={p.id}>
                                <td className="bd-table__med">{p.medicine}</td>
                                <td>{p.dosage || "—"}</td>
                                <td>
                                  {p.quantity != null
                                    ? `${p.quantity} (${p.remaining ?? 0} remaining)`
                                    : "—"}
                                </td>
                                <td>{lastDispensed[p.medicine] || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="bd-table-footer">
                          <span>
                            {prescriptions.length} prescription
                            {prescriptions.length === 1 ? "" : "s"} · valid until{" "}
                            {fmtDate(activeRx.validUntil)}
                          </span>
                        </div>

                        <p style={{ fontSize: 11.5, color: "#6b7280", marginTop: 14 }}>
                          Quantities and remaining balances are read from the server
                          record; dispensing is performed by BHW staff.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Medical history preview */}
              <div className="bd-panel">
                <h2 className="bd-panel__title">Medical history</h2>

                {detail.records.length === 0 ? (
                  <EmptyState
                    title="No medical history yet"
                    message="Clinical records entered by BHW staff will appear here."
                  />
                ) : (
                  detail.records.slice(0, 3).map((r) => (
                    <div className="bd-history-item" key={r.id} style={{ alignItems: "flex-start" }}>
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <p className="bd-history__title" style={{ fontSize: 13 }}>{r.type} · {r.code}</p>
                          <span className="bd-history__tag" style={{ fontSize: 11 }}>
                            • Complete
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
                          {fmtStamp(r.recordedAt)} · {r.recordedBy || "—"}
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                          {r.reasonForVisit ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Reason: {r.reasonForVisit}</li> : null}
                          {r.symptoms ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Symptoms: {r.symptoms}</li> : null}
                          {r.medicalHistory ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Medical history: {r.medicalHistory}</li> : null}
                          {r.findings ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Findings: {r.findings}</li> : null}
                          {r.notes ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Notes: {r.notes}</li> : null}
                          {r.bloodPressure ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>BP: {r.bloodPressure}</li> : null}
                          {r.weight ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Weight: {r.weight} kg</li> : null}
                          {!r.reasonForVisit && !r.symptoms && !r.medicalHistory && !r.findings && !r.notes && !r.bloodPressure && !r.weight ? (
                            <li style={{ fontSize: 12.5, color: "#1f2937" }}>—</li>
                          ) : null}
                        </ul>
                      </div>
                    </div>
                  ))
                )}
                {detail.records.length > 0 && (
                  <button
                    type="button"
                    className="bd-btn bd-btn--outline"
                    style={{ marginTop: 12 }}
                    onClick={() => setActiveTab("medical")}
                  >
                    View full medical history
                  </button>
                )}
              </div>

              {/* Read-only transactions */}
              <div className="bd-panel">
                <h2 className="bd-panel__title">Read-only transactions</h2>
                <p className="bd-actions-note">
                  Recently released medicine; view only for this role.
                </p>

                {txQuery.isLoading ? (
                  <Loading label="Loading transactions…" />
                ) : txQuery.error ? (
                  <ErrorState message={txQuery.error} onRetry={txQuery.refetch} />
                ) : transactions.length === 0 ? (
                  <EmptyState
                    title="No dispensing transactions"
                    message="Releases for this beneficiary will appear here."
                  />
                ) : (
                  <>
                    <table className="bd-table">
                      <thead>
                        <tr>
                          <th>Transaction</th>
                          <th>Medicine</th>
                          <th>Released by</th>
                          <th>Date / time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.slice(0, 5).map((t) => (
                          <tr key={t.id}>
                            <td className="bd-table__med">
                              {t.code} · {fmtStamp(t.at)}
                            </td>
                            <td>
                              {t.medicine} · {t.quantity}{" "}
                              {t.quantity === 1 ? "unit" : "units"}
                            </td>
                            <td>{t.dispensedBy || "—"}</td>
                            <td>{fmtStamp(t.at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="bd-table-footer">
                      <button
                        type="button"
                        className="bd-rx-valid"
                        style={{
                          background: "transparent",
                          color: "#0a3d3d",
                          padding: 0,
                          fontWeight: 700,
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => setActiveTab("dispensing")}
                      >
                        View full transaction history →
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Registry review */}
              <div className="bd-panel">
                <h2 className="bd-panel__title">Registry review</h2>

                <div className="bd-review-header">
                  <div>
                    <p className="bd-review__label">Review status</p>
                    <p className="bd-review__value">
                      {isReviewed ? "Active · Verified" : "For review"}
                    </p>
                  </div>
                  <div>
                    <p className="bd-review__label">Registered</p>
                    <p className="bd-review__value">
                      {detail.registeredAt} · {detail.registeredBy}
                    </p>
                  </div>
                </div>

                <div className="bd-review-check">
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Name, birth date and identity document verified
                </div>
                <div className="bd-review-check">
                  <CheckCircle2 size={14} strokeWidth={2.5} />
                  Eligibility and consent acknowledgment completed
                </div>

                {reviewState && (
                  <div style={{ marginTop: 12 }}>
                    <InlineNotice kind={reviewState.kind}>
                      {reviewState.text}
                    </InlineNotice>
                  </div>
                )}

                <div className="bd-actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="bd-btn bd-btn--primary"
                    onClick={handleMarkReviewed}
                    disabled={reviewBusy || isReviewed}
                  >
                    {reviewBusy
                      ? "Saving…"
                      : isReviewed
                        ? "Reviewed ✓"
                        : "Mark as reviewed"}
                  </button>
                  <Link to="/admin/beneficiaries" className="bd-btn bd-btn--outline">
                    Back to registry
                  </Link>
                </div>
              </div>
            </>
          )}

          {/* ---- MEDICAL HISTORY TAB ---- */}
          {activeTab === "medical" && (
            <div className="bd-panel">
              <h2 className="bd-panel__title">Full medical history</h2>
              {detail.records.length === 0 ? (
                <EmptyState
                  title="No medical history yet"
                  message="Clinical records entered by BHW staff will appear here."
                />
              ) : (
                detail.records.map((r) => (
                  <div className="bd-history-item" key={r.id} style={{ alignItems: "flex-start" }}>
                    <div style={{ width: "100%" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <p className="bd-history__title" style={{ fontSize: 13 }}>{r.type} · {r.code}</p>
                        <span className="bd-history__tag" style={{ fontSize: 11 }}>
                          • Complete
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
                        {fmtStamp(r.recordedAt)} · {r.recordedBy || "—"}
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                        {r.reasonForVisit ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Reason: {r.reasonForVisit}</li> : null}
                        {r.symptoms ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Symptoms: {r.symptoms}</li> : null}
                        {r.medicalHistory ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Medical history: {r.medicalHistory}</li> : null}
                        {r.findings ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Findings: {r.findings}</li> : null}
                        {r.notes ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Notes: {r.notes}</li> : null}
                        {r.bloodPressure ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>BP: {r.bloodPressure}</li> : null}
                        {r.weight ? <li style={{ fontSize: 12.5, color: "#1f2937" }}>Weight: {r.weight} kg</li> : null}
                        {!r.reasonForVisit && !r.symptoms && !r.medicalHistory && !r.findings && !r.notes && !r.bloodPressure && !r.weight ? (
                          <li style={{ fontSize: 12.5, color: "#1f2937" }}>—</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ---- PRESCRIPTIONS TAB ---- */}
          {activeTab === "prescriptions" && (
            <div className="bd-panel">
              <h2 className="bd-panel__title">All prescriptions</h2>
              <p className="bd-panel__subtitle">
                Historic and active prescriptions for this beneficiary.
              </p>

              {detail.records
                .filter((r) => r.prescription)
                .map((r) => (
                  <div className="bd-panel" style={{ padding: "14px 16px", marginBottom: 14 }} key={`rec-tab-${r.id}`}>
                    <div className="bd-panel__title" style={{ fontSize: 12.5 }}>
                      Prescription (recorded) · {r.code}
                    </div>
                    <p style={{ fontSize: 12.5, color: "#1f2937", margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                      {r.prescription}
                    </p>
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0" }}>
                      Recorded by {r.recordedBy} on {fmtStamp(r.recordedAt)}
                    </p>
                  </div>
                ))}

              {rxQuery.isLoading ? (
                <Loading label="Loading prescriptions…" />
              ) : rxQuery.error ? (
                <ErrorState message={rxQuery.error} onRetry={rxQuery.refetch} />
              ) : prescriptions.length === 0 && detail.records.every((r) => !r.prescription) ? (
                <EmptyState
                  title="No prescriptions on file"
                  message="Prescriptions issued for this beneficiary will appear here."
                />
              ) : prescriptions.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#6b7280" }}>
                  No formal prescriptions have been issued for this beneficiary yet.
                </p>
              ) : (
                <table className="bd-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Medicine</th>
                      <th>Directions</th>
                      <th>Prescriber</th>
                      <th>Valid until</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((p) => (
                      <tr key={p.id}>
                        <td className="bd-table__med">{p.code}</td>
                        <td>{p.medicine}</td>
                        <td>{p.dosage || "—"}</td>
                        <td>{p.prescribedBy || "—"}</td>
                        <td>{fmtDate(p.validUntil)}</td>
                        <td>{p.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ---- DISPENSING TAB ---- */}
          {activeTab === "dispensing" && (
            <div className="bd-panel">
              <h2 className="bd-panel__title">Dispensing history</h2>
              {txQuery.isLoading ? (
                <Loading label="Loading dispensing history…" />
              ) : txQuery.error ? (
                <ErrorState message={txQuery.error} onRetry={txQuery.refetch} />
              ) : transactions.length === 0 ? (
                <EmptyState
                  title="No dispensing transactions"
                  message="Releases for this beneficiary will appear here."
                />
              ) : (
                <table className="bd-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Medicine</th>
                      <th>Released by</th>
                      <th>Status</th>
                      <th>Date / time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="bd-table__med">{t.code}</td>
                        <td>
                          {t.medicine} · {t.quantity}{" "}
                          {t.quantity === 1 ? "unit" : "units"}
                        </td>
                        <td>{t.dispensedBy || "—"}</td>
                        <td>{t.status || "—"}</td>
                        <td>{fmtStamp(t.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="bd-footer-note">
        <strong>Prescriptions remain clinician-controlled</strong>
        Registration and registry updates do not change a prescription. All
        changes are recorded in the audit log.
      </div>

      {/* Page footer */}
      <div className="bd-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
