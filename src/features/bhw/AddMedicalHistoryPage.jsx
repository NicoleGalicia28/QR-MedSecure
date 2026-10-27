import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Info } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import { fmtDate } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./AddMedicalHistory.css";

const ENTRY_TYPES = [
  "Consultation",
  "Follow-up",
  "Referral",
  "Health education",
  "Immunization",
];

export default function AddMedicalHistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useApiRefresh();

  // The clinical record being extended — supplies the beneficiary to attach.
  const {
    data: record,
    isLoading,
    error,
    refetch,
  } = useEndpoint(`/clinical-records/${id}`, (res) => res.record);

  const session = getSession();
  const currentUser = {
    name: session ? `${session.firstName} ${session.lastName}` : "BHW Staff",
    role: session?.role || "BHW",
    staffId: session?.id || "—",
  };

  const [form, setForm] = useState({
    entryType: ENTRY_TYPES[0],
    reasonForVisit: "",
    symptoms: "",
    bloodPressure: "",
    weight: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !record) return;

    // Minimal client-side checks so the server is not called with empties.
    const errs = {};
    if (!form.entryType) errs.entryType = "Select an entry type.";
    if (!form.reasonForVisit.trim() && !form.notes.trim())
      errs.reasonForVisit = "Enter a reason for visit or consultation notes.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setNotice(null);

    const findings = [
      form.reasonForVisit.trim(),
      form.symptoms.trim(),
      form.notes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const res = await sendApi("/clinical-records", {
      beneficiaryId: record.beneficiaryId,
      type: form.entryType,
      findings,
      bloodPressure: form.bloodPressure,
      weight: form.weight,
    });

    setSubmitting(false);
    if (!res.ok) {
      // Surface the server message and, when it names a field, flag it.
      const msg = res.error || "Could not save the entry.";
      const next = {};
      if (/type/i.test(msg)) next.entryType = msg;
      if (/beneficiary/i.test(msg)) next.reasonForVisit = msg;
      setFieldErrors(next);
      setNotice({ kind: "error", message: msg });
      return;
    }

    // Refresh the affected endpoints, then return to the record detail.
    await refresh("/clinical-records");
    await refresh(`/clinical-records/${record.id}`);
    if (record.beneficiaryId) {
      await refresh(`/prescriptions?beneficiaryId=${record.beneficiaryId}`);
      await refresh(`/transactions?beneficiaryId=${record.beneficiaryId}`);
      await refresh(`/beneficiaries/${record.beneficiaryId}`);
    }
    await refresh("/beneficiaries");
    await refresh("/dashboard");
    await refresh("/bhw/dashboard");
    await refresh("/bhw/recent-records");
    navigate(`/bhw/clinical-records/${record.id}`);
  };

  if (isLoading && !record) {
    return <Loading label="Loading record…" />;
  }
  if (error) {
    return (
      <>
        <Link to="/bhw/clinical-records" className="amh-back">
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
        <Link to="/bhw/clinical-records" className="amh-back">
          <ArrowLeft size={14} /> Clinical records
        </Link>
        <ErrorState
          title="Record not found"
          message="This clinical record does not exist."
        />
      </>
    );
  }

  const beneficiary = {
    name: record.beneficiary,
    id: record.beneficiaryId,
  };
  const existingHistory = [
    {
      title: record.type,
      meta: `${fmtDate(record.recordedAt)} · ${record.findings || "—"} · ${record.recordedBy}`,
      tag: `• ${record.type}`,
    },
  ];

  return (
    <>
      {/* Back */}
      <Link
        to={`/bhw/clinical-records/${record.id}`}
        className="amh-back"
      >
        <ArrowLeft size={14} /> Clinical records / {beneficiary.name}
      </Link>

      {/* Header */}
      <div className="amh-header">
        <h1 className="amh-header__title">Add medical history</h1>
        <p className="amh-header__subtitle">
          {beneficiary.name} · {beneficiary.id} · Attributable history entry.
        </p>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="amh-layout">
        {/* ============ LEFT: FORM ============ */}
        <form onSubmit={handleSubmit}>
          {/* --- Consultation details --- */}
          <div className="amh-panel">
            <h2 className="amh-panel__title">Consultation details</h2>
            <p className="amh-panel__subtitle">Required fields marked *</p>

            {/* Entry type */}
            <div className="amh-field">
              <label className="amh-label">
                Entry type <span className="req">*</span>
              </label>
              <select
                className="amh-select"
                value={form.entryType}
                onChange={(e) => update("entryType", e.target.value)}
                required
              >
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {fieldErrors.entryType && (
                <div style={{ marginTop: 6 }}>
                  <InlineNotice kind="error">{fieldErrors.entryType}</InlineNotice>
                </div>
              )}
            </div>

            {/* Reason for visit */}
            <div className="amh-field">
              <label className="amh-label">
                Reason for visit <span className="req">*</span>
              </label>
              <input
                type="text"
                className="amh-input"
                placeholder="Hypertension follow-up"
                value={form.reasonForVisit}
                onChange={(e) => update("reasonForVisit", e.target.value)}
              />
              {fieldErrors.reasonForVisit && (
                <div style={{ marginTop: 6 }}>
                  <InlineNotice kind="error">
                    {fieldErrors.reasonForVisit}
                  </InlineNotice>
                </div>
              )}
            </div>

            {/* Symptoms / complaints */}
            <div className="amh-field">
              <label className="amh-label">Symptoms / complaints</label>
              <textarea
                className="amh-textarea"
                placeholder="e.g. Headache for 3 days, mild dizziness in the morning"
                value={form.symptoms}
                onChange={(e) => update("symptoms", e.target.value)}
              />
            </div>

            {/* Vital signs */}
            <div className="amh-row">
              <div className="amh-field">
                <label className="amh-label">Blood pressure</label>
                <input
                  type="text"
                  className="amh-input"
                  placeholder="132/82 mmHg"
                  value={form.bloodPressure}
                  onChange={(e) => update("bloodPressure", e.target.value)}
                />
              </div>
              <div className="amh-field">
                <label className="amh-label">Weight (kg)</label>
                <input
                  type="text"
                  className="amh-input"
                  placeholder="64"
                  value={form.weight}
                  onChange={(e) => update("weight", e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="amh-field">
              <label className="amh-label">Consultation notes</label>
              <textarea
                className="amh-textarea"
                placeholder="Beneficiary reports stable symptoms. Reviewed existing clinician plan."
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Feedback */}
          {notice ? (
            <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>
          ) : null}

          {/* Actions */}
          <div className="amh-actions">
            <button
              type="submit"
              className="amh-btn amh-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save medical history"}
            </button>
            <Link
              to={`/bhw/clinical-records/${record.id}`}
              className="amh-btn amh-btn--outline"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* ============ RIGHT: ATTRIBUTION + HISTORY ============ */}
        <div>
          {/* Attribution */}
          <div className="amh-panel">
            <h2 className="amh-panel__title">Recording attribution</h2>
            <p className="amh-panel__subtitle">Entry will be recorded under:</p>

            <div className="amh-attr-row">
              <p className="amh-attr__label">Recorded by</p>
              <p className="amh-attr__value">
                {currentUser.name} · {currentUser.role}
              </p>
            </div>

            <div className="amh-attr-row">
              <p className="amh-attr__label">Staff ID</p>
              <p className="amh-attr__value">{currentUser.staffId}</p>
            </div>

            <div className="amh-attr-row">
              <p className="amh-attr__label">Recording time</p>
              <p className="amh-attr__value">
                {new Date().toLocaleString("en-PH", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="amh-attr__status">
              <Info size={13} /> Source and details reviewed
            </div>
          </div>

          {/* History snapshot */}
          <div className="amh-panel">
            <h2 className="amh-panel__title">Medical history</h2>
            <p className="amh-panel__subtitle">
              Entries are attributable to the recording staff.
            </p>

            {existingHistory.map((h, i) => (
              <div className="amh-history-item" key={i}>
                <div>
                  <p className="amh-history-item__title">{h.title}</p>
                  <p className="amh-history-item__meta">{h.meta}</p>
                </div>
                <span className="amh-history-item__tag">{h.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="amh-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
