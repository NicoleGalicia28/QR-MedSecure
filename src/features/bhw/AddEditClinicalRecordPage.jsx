import { useState, useEffect, Fragment } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./AddMedicalHistory.css";
import "./AddEditClinicalRecord.css";

const STEPS = [
  { key: 1, label: "Record details" },
  { key: 2, label: "Clinical findings" },
  { key: 3, label: "Prescription & review" },
];

const ENTRY_TYPES = ["Consultation", "Follow-up", "Referral", "Health education", "Immunization"];

const EMPTY_FORM = {
  type: ENTRY_TYPES[0],
  bloodPressure: "",
  weight: "",
  reasonForVisit: "",
  symptoms: "",
  findings: "",
  medicalHistory: "",
  prescription: "",
  notes: "",
};

// Creates a new record for a beneficiary, or edits an existing one when the
// route carries a record id (`/bhw/beneficiaries/:id/clinical/:recordId/edit`).
export default function AddEditClinicalRecordPage() {
  const { id, recordId } = useParams();
  const navigate = useNavigate();
  const refresh = useApiRefresh();
  const [step, setStep] = useState(1);
  const isEdit = Boolean(recordId);

  const { data: beneficiary, isLoading: bLoading, error: bError, refetch: refetchB } = useEndpoint(
    `/beneficiaries/${id}`,
    (res) => res.beneficiary
  );

  const {
    data: record,
    isLoading: rLoading,
    error: rError,
    refetch: refetchR,
  } = useEndpoint(
    isEdit ? `/clinical-records/${recordId}` : "",
    (res) => res.record,
    { enabled: isEdit }
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  // Pre-fill the form when an existing record is opened for editing.
  useEffect(() => {
    if (!record) return;
    setForm({
      type: record.type || ENTRY_TYPES[0],
      bloodPressure: record.bloodPressure || "",
      weight: record.weight || "",
      reasonForVisit: record.reasonForVisit || "",
      symptoms: record.symptoms || "",
      findings: record.findings || "",
      medicalHistory: record.medicalHistory || "",
      prescription: record.prescription || "",
      notes: record.notes || "",
    });
  }, [record]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const next = () => setStep((s) => Math.min(3, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !beneficiary) return;
    if (step < 3) {
      next();
      return;
    }
    setSubmitting(true);
    setNotice(null);

    // `findings` stays the free-text assessment; the structured parts are
    // stored in their own columns so the record can be edited field-by-field.
    const payload = {
      type: form.type,
      findings: form.findings.trim(),
      reasonForVisit: form.reasonForVisit.trim(),
      symptoms: form.symptoms.trim(),
      medicalHistory: form.medicalHistory.trim(),
      notes: form.notes.trim(),
      prescription: form.prescription.trim(),
      bloodPressure: form.bloodPressure.trim(),
      weight: form.weight.trim(),
      // Status is owned by the server: a filled-in form is saved as complete.
    };

    const res = isEdit
      ? await sendApi(`/clinical-records/${record.id}`, payload, "PUT")
      : await sendApi("/clinical-records", {
          ...payload,
          beneficiaryId: beneficiary.publicId || beneficiary.id,
        });

    setSubmitting(false);
    if (!res.ok) {
      setNotice({ kind: "error", message: res.error || "Failed to save clinical record." });
      return;
    }

    await refresh("/clinical-records");
    await refresh("/beneficiaries");
    // The dashboard counters and the recent-records panel must reflect the
    // new record straight away.
    await refresh("/bhw/recent-records");
    await refresh("/bhw/dashboard");
    await refresh("/dashboard");
    if (beneficiary.publicId) {
      await refresh(`/beneficiaries/${beneficiary.publicId}`);
      await refresh(`/beneficiaries/${beneficiary.publicId}/records`);
    }
    if (isEdit) {
      await refresh(`/clinical-records/${record.id}`);
      navigate(`/bhw/clinical-records/${record.id}`);
    } else {
      navigate(`/bhw/beneficiaries/${beneficiary.publicId || id}`);
    }
  };

  if (bLoading && !beneficiary) return <Loading label="Loading beneficiary…" />;
  if (bError) {
    return (
      <>
        <Link to="/bhw/beneficiaries" className="amh-back">
          <ArrowLeft size={14} /> Beneficiaries
        </Link>
        <ErrorState message={bError} onRetry={refetchB} />
      </>
    );
  }
  if (isEdit && rLoading && !record) return <Loading label="Loading clinical record…" />;
  if (isEdit && rError) {
    return (
      <>
        <Link to="/bhw/beneficiaries" className="amh-back">
          <ArrowLeft size={14} /> Beneficiaries
        </Link>
        <ErrorState message={rError} onRetry={refetchR} />
      </>
    );
  }

  const backHref = isEdit
    ? `/bhw/beneficiaries/${beneficiary?.publicId || id}`
    : "/bhw/beneficiaries";

  return (
    <>
      <Link to={backHref} className="amh-back">
        <ArrowLeft size={14} /> {isEdit ? "Beneficiary" : "Beneficiaries"}
      </Link>

      <div className="aecr-header">
        <div>
          <h1 className="aecr-header__title">
            {isEdit ? "Edit clinical record" : "New clinical record"}
          </h1>
          <p className="aecr-header__subtitle">
            {beneficiary?.name || "—"} · {beneficiary?.publicId || id}
            {isEdit && record?.code ? ` · ${record.code}` : ""} · Barangay 354 Tayuman
          </p>
        </div>
      </div>

      <div className="aecr-steps">
        {STEPS.map((s, idx) => (
          <Fragment key={s.key}>
            <div className={"aecr-step " + (step > s.key ? "aecr-step--done" : step === s.key ? "aecr-step--active" : "")}>
              <span className="aecr-step__num">{s.key}</span>
              {s.label}
            </div>
            {idx < STEPS.length - 1 && <div className="aecr-sep" />}
          </Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="aecr-layout">
          <div>
            {step === 1 && (
              <div className="aecr-panel">
                <h2 className="aecr-panel__title">1. Record details</h2>
                <p className="aecr-panel__subtitle">Basic visit information</p>

                <div className="aecr-field">
                  <label className="aecr-label">Type *</label>
                  <select className="aecr-select" value={form.type} onChange={(e) => update("type", e.target.value)}>
                    {ENTRY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="aecr-row">
                  <div className="aecr-field">
                    <label className="aecr-label">Weight</label>
                    <input className="aecr-input" placeholder="e.g., 65 kg" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
                  </div>
                  <div className="aecr-field">
                    <label className="aecr-label">Blood pressure</label>
                    <input className="aecr-input" placeholder="e.g., 120/80 mmHg" value={form.bloodPressure} onChange={(e) => update("bloodPressure", e.target.value)} />
                  </div>
                </div>

                <div className="aecr-field">
                  <label className="aecr-label">Reason for visit</label>
                  <input className="aecr-input" value={form.reasonForVisit} onChange={(e) => update("reasonForVisit", e.target.value)} />
                </div>

                <div className="aecr-actions aecr-actions--end">
                  <button type="button" className="btn btn--primary" onClick={next}>
                    Next <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="aecr-panel">
                <h2 className="aecr-panel__title">2. Clinical findings</h2>
                <p className="aecr-panel__subtitle">Symptoms, history, and assessment</p>

                <div className="aecr-field">
                  <label className="aecr-label">Symptoms</label>
                  <textarea className="aecr-textarea" rows={4} value={form.symptoms} onChange={(e) => update("symptoms", e.target.value)} placeholder="Chief complaints, onset, duration..." />
                </div>

                <div className="aecr-field">
                  <label className="aecr-label">Medical history</label>
                  <textarea className="aecr-textarea" rows={4} value={form.medicalHistory} onChange={(e) => update("medicalHistory", e.target.value)} placeholder="Past illnesses, allergies, surgeries, medications..." />
                </div>

                <div className="aecr-field">
                  <label className="aecr-label">Findings / Assessment</label>
                  <textarea className="aecr-textarea" rows={5} value={form.findings} onChange={(e) => update("findings", e.target.value)} placeholder="Physical exam findings, diagnosis/assessment..." />
                </div>

                <div className="aecr-field">
                  <label className="aecr-label">Notes</label>
                  <textarea className="aecr-textarea" rows={4} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
                </div>

                <div className="aecr-actions">
                  <button type="button" className="btn btn--outline" onClick={back}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button type="button" className="btn btn--primary" onClick={next}>
                    Next <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="aecr-panel">
                <h2 className="aecr-panel__title">3. Prescription & review</h2>
                <p className="aecr-panel__subtitle">Prescribe and finalize</p>

                <div className="aecr-field">
                  <label className="aecr-label">Prescription</label>
                  <textarea className="aecr-textarea" rows={6} value={form.prescription} onChange={(e) => update("prescription", e.target.value)} placeholder="Medicine, dosage, frequency, duration, instructions..." />
                </div>

                <div className="aecr-review">
                  <div className="aecr-review__title">Review</div>
                  <div><strong>Type:</strong> {form.type}</div>
                  <div><strong>Weight / BP:</strong> {form.weight || "—"} / {form.bloodPressure || "—"}</div>
                  {form.reasonForVisit && <div><strong>Reason:</strong> {form.reasonForVisit}</div>}
                  {form.symptoms && <div><strong>Symptoms:</strong> {form.symptoms}</div>}
                  {form.findings && <div><strong>Findings:</strong> {form.findings}</div>}
                  {form.prescription && <div><strong>Prescription:</strong> {form.prescription}</div>}
                </div>

                {notice && <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>}

                <div className="aecr-actions">
                  <button type="button" className="btn btn--outline" onClick={back}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={submitting}>
                    <Save size={14} strokeWidth={2.5} /> {submitting ? "Saving…" : isEdit ? "Save changes" : "Save clinical record"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="aecr-side">
              <h2 className="aecr-side__title">Beneficiary</h2>
              <div className="aecr-side__row"><span>Name</span><strong>{beneficiary?.name || "—"}</strong></div>
              <div className="aecr-side__row"><span>ID</span><strong>{beneficiary?.publicId || id}</strong></div>
              <div className="aecr-side__row"><span>Birth date</span><span>{beneficiary?.birthDate || "—"}</span></div>
              <div className="aecr-side__row"><span>Sex</span><span>{beneficiary?.sex || "—"}</span></div>
              <div className="aecr-side__row"><span>Phone</span><span>{beneficiary?.phone || "—"}</span></div>
              <div className="aecr-side__row"><span>Address</span><span>{beneficiary?.address || "—"}</span></div>
              <div className="aecr-side__row"><span>Program</span><span>{beneficiary?.program || "General"}</span></div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
