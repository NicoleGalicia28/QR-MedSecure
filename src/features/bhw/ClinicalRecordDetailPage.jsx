import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, Pencil } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtDate, fmtDateTime } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./ClinicalRecordDetail.css";

const TABS = [
  { key: "clinical", label: "Clinical overview" },
  { key: "history", label: "Medical history" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "dispensing", label: "Dispensing history" },
];

function mapRx(p) {
  return {
    id: p.id,
    code: p.code,
    status: p.status,
    prescriber: p.prescribedBy || "—",
    validUntil: p.validUntil,
    medicine: p.medicine,
    dosage: p.dosage || "—",
    quantity: p.quantity,
    remaining: p.remaining,
  };
}

export default function ClinicalRecordDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("clinical");

  // Live record detail (id may be numeric or a code like CR-2026-0001).
  const {
    data: record,
    isLoading,
    error,
    refetch,
  } = useEndpoint(`/clinical-records/${id}`, (res) => res.record);

  const beneficiaryId = record?.beneficiaryId;
  const recordId = record?.id;

  // Active prescriptions drive the overview; all prescriptions fill the tab.
  const activeRx = useEndpoint(
    beneficiaryId ? `/prescriptions/active/${beneficiaryId}` : "",
    (res) => (res.prescriptions || []).map(mapRx),
    { enabled: Boolean(beneficiaryId) }
  );
  const allRx = useEndpoint(
    beneficiaryId ? `/prescriptions?beneficiaryId=${beneficiaryId}` : "",
    (res) => (res.prescriptions || []).map(mapRx),
    { enabled: Boolean(beneficiaryId) }
  );
  // Dispensing history for this beneficiary.
  const transactions = useEndpoint(
    beneficiaryId ? `/transactions?beneficiaryId=${beneficiaryId}` : "",
    (res) => res.transactions || [],
    { enabled: Boolean(beneficiaryId) }
  );

  if (isLoading && !record) {
    return <Loading label="Loading clinical record…" />;
  }
  if (error) {
    return (
      <>
        <Link to="/bhw/clinical-records" className="crd-back">
          <ArrowLeft size={14} /> Clinical records
        </Link>
        <ErrorState
          title="Could not load this record"
          message={error}
          onRetry={refetch}
        />
      </>
    );
  }
  if (!record) {
    return (
      <>
        <Link to="/bhw/clinical-records" className="crd-back">
          <ArrowLeft size={14} /> Clinical records
        </Link>
        <ErrorState
          title="Record not found"
          message="This clinical record does not exist."
        />
      </>
    );
  }

  const activeList = activeRx.data || [];
  const currentRx = activeList[0] || null;

  // The single record is also the latest medical-history entry.
  const history = [
    {
      title: record.type,
      meta: `${fmtDate(record.recordedAt)} · ${record.findings || "—"} · ${record.recordedBy}`,
      tag: `• ${record.type}`,
    },
  ];

  return (
    <>
      {/* Back */}
      <Link to="/bhw/clinical-records" className="crd-back">
        <ArrowLeft size={14} /> Clinical records
      </Link>

      {/* ---------- HEADER ---------- */}
      <div className="crd-header">
        <div>
          <h1 className="crd-header__title">{record.beneficiary}</h1>
          <p className="crd-header__subtitle">
            Clinical records / {record.beneficiaryId} · BHW clinical access
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            to={`/bhw/beneficiaries/${record.beneficiaryId}/clinical/${recordId}/edit`}
            className="btn btn--outline"
          >
            <Pencil size={14} strokeWidth={2.5} /> Edit record
          </Link>
          <Link
            to={`/bhw/clinical-records/${recordId}/add-history`}
            className="crd-btn-primary"
          >
            <Plus size={15} strokeWidth={2.5} />
            Add medical history
          </Link>
        </div>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="crd-layout">
        {/* ============ LEFT: BENEFICIARY INFORMATION ============ */}
        <aside className="crd-side">
          <h2 className="crd-side__title">Record information</h2>
          <span className="crd-side__status">• Complete</span>

          <div className="crd-side__field">
            <p className="crd-side__label">Beneficiary ID</p>
            <p className="crd-side__value">{record.beneficiaryId}</p>
          </div>

          <div className="crd-side__field">
            <p className="crd-side__label">Record code</p>
            <p className="crd-side__value">{record.code}</p>
          </div>

          <div className="crd-side__row">
            <div className="crd-side__field">
              <p className="crd-side__label">Type</p>
              <p className="crd-side__value">{record.type}</p>
            </div>
            <div className="crd-side__field">
              <p className="crd-side__label">Recorded</p>
              <p className="crd-side__value">{fmtDate(record.recordedAt)}</p>
            </div>
          </div>

          <div className="crd-side__field">
            <p className="crd-side__label">Blood pressure</p>
            <p className="crd-side__value crd-side__value--muted">
              {record.bloodPressure || "—"}
            </p>
          </div>

          <div className="crd-side__field">
            <p className="crd-side__label">Weight</p>
            <p className="crd-side__value crd-side__value--muted">
              {record.weight || "—"}
            </p>
          </div>

          <div className="crd-side__field">
            <p className="crd-side__label">Recorded by</p>
            <p className="crd-side__value">{record.recordedBy}</p>
          </div>

          <div className="crd-side__note">
            Identity fields are read-only for BHW. Registry staff manage
            beneficiary details.
          </div>
        </aside>

        {/* ============ RIGHT: TABBED CONTENT ============ */}
        <section className="crd-main">
          {/* Tabs */}
          <div className="crd-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={
                  "crd-tab" + (activeTab === t.key ? " crd-tab--active" : "")
                }
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ---------- CLINICAL OVERVIEW TAB ---------- */}
          {activeTab === "clinical" && (
            <>
              {/* Findings panel */}
              <div className="crd-panel">
                <h2 className="crd-panel__title">Clinical findings</h2>
                <p className="crd-panel__subtitle">
                  Recorded during this visit.
                </p>

                {record.reasonForVisit ? (
                  <div className="crd-field-line">
                    <span className="crd-field-line__label">Reason for visit</span>
                    <span className="crd-field-line__value">{record.reasonForVisit}</span>
                  </div>
                ) : null}

                {record.symptoms ? (
                  <div className="crd-field-line">
                    <span className="crd-field-line__label">Symptoms</span>
                    <span className="crd-field-line__value">{record.symptoms}</span>
                  </div>
                ) : null}

                {record.findings ? (
                  <div className="crd-field-line">
                    <span className="crd-field-line__label">Findings / assessment</span>
                    <span className="crd-field-line__value">{record.findings}</span>
                  </div>
                ) : null}

                {record.medicalHistory ? (
                  <div className="crd-field-line">
                    <span className="crd-field-line__label">Medical history</span>
                    <span className="crd-field-line__value">{record.medicalHistory}</span>
                  </div>
                ) : null}

                {record.notes ? (
                  <div className="crd-field-line">
                    <span className="crd-field-line__label">Notes</span>
                    <span className="crd-field-line__value">{record.notes}</span>
                  </div>
                ) : null}

                {record.prescription ? (
                  <div className="crd-field-line">
                    <span className="crd-field-line__label">Prescription (recorded)</span>
                    <span className="crd-field-line__value">{record.prescription}</span>
                  </div>
                ) : null}

                {!record.reasonForVisit &&
                !record.symptoms &&
                !record.findings &&
                !record.medicalHistory &&
                !record.notes &&
                !record.prescription ? (
                  <p style={{ fontSize: 12.5, color: "#374151" }}>
                    No findings recorded.
                  </p>
                ) : null}
              </div>

              {/* Prescription panel */}
              <div className="crd-panel">
                <div className="crd-panel__head">
                  <div>
                    <h2 className="crd-panel__title">Current prescription</h2>
                    <p className="crd-panel__subtitle">
                      Prescription reference · BHW view only.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="crd-panel__link"
                    onClick={() => setActiveTab("prescriptions")}
                  >
                    All prescriptions <ArrowRight size={12} />
                  </button>
                </div>

                {activeRx.isLoading && !activeRx.data ? (
                  <Loading label="Loading prescriptions…" />
                ) : activeRx.error ? (
                  <ErrorState
                    message={activeRx.error}
                    onRetry={activeRx.refetch}
                  />
                ) : !currentRx && !record.prescription ? (
                  <EmptyState
                    title="No active prescription"
                    message="This beneficiary has no active prescription."
                  />
                ) : (
                  <>
                    {record.prescription && (
                      <div style={{ marginBottom: currentRx ? 14 : 0 }}>
                        <div className="rx-meta__left" style={{ marginBottom: 6 }}>
                          <span className="rx-meta__label">Prescription (recorded)</span>
                        </div>
                        <p style={{ fontSize: 12.5, color: "#1f2937", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                          {record.prescription}
                        </p>
                      </div>
                    )}
                    {currentRx && (
                      <>
                        <div className="rx-meta">
                          <div className="rx-meta__left">
                            <span className="rx-meta__label">Prescription ID</span>
                            <span className="rx-meta__value">{currentRx.code}</span>
                          </div>
                          <div className="rx-meta__left">
                            <span className="rx-meta__label">Prescriber</span>
                            <span className="rx-meta__value">
                              {currentRx.prescriber}
                            </span>
                          </div>
                          <div className="rx-meta__right">
                            <span className="rx-meta__valid">
                              • Valid through{" "}
                              {fmtDate(currentRx.validUntil) || "—"}
                            </span>
                          </div>
                        </div>

                        <table className="rx-table">
                          <thead>
                            <tr>
                              <th>Medicine</th>
                              <th>Directions</th>
                              <th>Authorized quantity</th>
                              <th>Remaining</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="rx-table__med">
                                {currentRx.medicine}
                              </td>
                              <td>{currentRx.dosage}</td>
                              <td>{currentRx.quantity}</td>
                              <td>{currentRx.remaining}</td>
                            </tr>
                          </tbody>
                        </table>

                        <p className="rx-note">
                          Remaining allocation updates after each confirmed release.
                        </p>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Medical history panel */}
              <div className="crd-panel">
                <h2 className="crd-panel__title">Medical history</h2>
                <p className="crd-panel__subtitle">
                  Latest entries · Updates are attributable to the recording
                  staff.
                </p>

                {history.map((h, i) => (
                  <div className="history-item" key={i}>
                    <div>
                      <p className="history-item__title">{h.title}</p>
                      <p className="history-item__meta">{h.meta}</p>
                    </div>
                    <span className="history-item__tag">{h.tag}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ---------- MEDICAL HISTORY TAB ---------- */}
          {activeTab === "history" && (
            <div className="crd-panel">
              <h2 className="crd-panel__title">Full medical history</h2>
              <p className="crd-panel__subtitle">
                Chronological log of recorded clinical entries for this
                beneficiary.
              </p>
              {history.map((h, i) => (
                <div className="history-item" key={i}>
                  <div>
                    <p className="history-item__title">{h.title}</p>
                    <p className="history-item__meta">{h.meta}</p>
                  </div>
                  <span className="history-item__tag">{h.tag}</span>
                </div>
              ))}
            </div>
          )}

          {/* ---------- PRESCRIPTIONS TAB ---------- */}
          {activeTab === "prescriptions" && (
            <div className="crd-panel">
              <h2 className="crd-panel__title">All prescriptions</h2>
              <p className="crd-panel__subtitle">
                Historic and active prescriptions for this beneficiary.
              </p>

              {record.prescription && (
                <div className="crd-panel" style={{ padding: "14px 16px", marginBottom: 14 }}>
                  <div className="crd-panel__title" style={{ fontSize: 12.5 }}>
                    Prescription (recorded) · {record.code}
                  </div>
                  <p style={{ fontSize: 12.5, color: "#1f2937", margin: "8px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {record.prescription}
                  </p>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 0" }}>
                    Recorded by {record.recordedBy} on {fmtDate(record.recordedAt)}
                  </p>
                </div>
              )}

              {allRx.isLoading && !allRx.data ? (
                <Loading label="Loading prescriptions…" />
              ) : allRx.error ? (
                <ErrorState message={allRx.error} onRetry={allRx.refetch} />
              ) : (allRx.data || []).length === 0 && !record.prescription ? (
                <EmptyState
                  title="No prescriptions"
                  message="No prescriptions are on file for this beneficiary."
                />
              ) : (allRx.data || []).length === 0 ? (
                <p style={{ fontSize: 12.5, color: "#6b7280" }}>
                  No formal prescriptions have been issued for this beneficiary yet.
                </p>
              ) : (
                (allRx.data || []).map((rx) => (
                  <div className="rx-card" key={rx.id}>
                    <div className="rx-card__head">
                      <div className="rx-card__tags">
                        <span className="rx-card__id">{rx.code}</span>
                        <span
                          className={
                            "rx-card__status" +
                            (rx.status === "active"
                              ? " rx-card__status--active"
                              : "")
                          }
                        >
                          • {rx.status}
                        </span>
                      </div>
                      <span className="rx-card__prescriber">
                        {rx.prescriber}
                      </span>
                    </div>

                    <p className="rx-card__meta">
                      Valid until {fmtDate(rx.validUntil) || "—"}
                    </p>

                    <table className="rx-table">
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Directions</th>
                          <th>Authorized quantity</th>
                          <th>Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="rx-table__med">{rx.medicine}</td>
                          <td>{rx.dosage}</td>
                          <td>{rx.quantity}</td>
                          <td>{rx.remaining}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ---------- DISPENSING TAB ---------- */}
          {activeTab === "dispensing" && (
            <div className="crd-panel">
              <h2 className="crd-panel__title">Dispensing history</h2>
              <p className="crd-panel__subtitle">
                All confirmed dispensing events for this beneficiary.
              </p>

              {transactions.isLoading && !transactions.data ? (
                <Loading label="Loading dispensing history…" />
              ) : transactions.error ? (
                <ErrorState
                  message={transactions.error}
                  onRetry={transactions.refetch}
                />
              ) : (transactions.data || []).length === 0 ? (
                <EmptyState
                  title="No dispensing events"
                  message="Confirmed releases for this beneficiary will appear here."
                />
              ) : (
                <table className="rx-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Medicine</th>
                      <th>Quantity</th>
                      <th>Dispensed by</th>
                      <th>At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transactions.data || []).map((t) => (
                      <tr key={t.id}>
                        <td className="rx-table__med">
                          <Link to={`/bhw/dispensing/${t.id}`}>{t.code}</Link>
                        </td>
                        <td>{t.medicine}</td>
                        <td>{t.quantity}</td>
                        <td>{t.dispensedBy}</td>
                        <td>{fmtDateTime(t.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="crd-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
