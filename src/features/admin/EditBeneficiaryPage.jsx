import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./EditBeneficiary.css";

const SEXES = ["Female", "Male"];
const PROGRAMS = [
  "Senior Citizen · Maintenance",
  "Hypertension",
  "Diabetes",
  "General",
];
const STATUSES = ["Active", "For review", "Archived"];

// Form status → the status vocabulary the backend stores (and back).
const STATUS_TO_SERVER = {
  Active: "active",
  "For review": "review",
  Archived: "inactive",
};
const STATUS_FROM_SERVER = {
  active: "Active",
  review: "For review",
  for_review: "For review",
  inactive: "Archived",
  archived: "Archived",
};

// GET /beneficiaries/:id → summary + the form fields the API exposes.
const selectRecord = (res) => {
  const b = res?.beneficiary;
  if (!b) return null;
  const ageYear = parseInt(String(b.birthDate || "").slice(0, 4), 10);
  const age = ageYear ? new Date().getFullYear() - ageYear : null;
  return {
    publicId: b.publicId || "",
    registeredAt: String(b.createdAt || "").slice(0, 10),
    registeredBy: b.registeredBy || "—",
    status: STATUS_FROM_SERVER[String(b.status || "").toLowerCase()] || "Active",
    area: b.area || "",
    program: age !== null && age >= 60 ? "Senior Citizen" : "General",
    formPatch: {
      firstName: b.firstName || "",
      middleName: "",
      lastName: b.lastName || "",
      dob: String(b.birthDate || "").slice(0, 10),
      sex: SEXES.includes(b.sex) ? b.sex : "Female",
      address: b.address || "",
      mobile: b.phone || "",
      status:
        STATUS_FROM_SERVER[String(b.status || "").toLowerCase()] || "Active",
    },
  };
};

const EMPTY_FORM = {
  firstName: "",
  middleName: "",
  lastName: "",
  dob: "",
  sex: "Female",
  status: "Active",
  houseNo: "",
  street: "",
  city: "Manila",
  barangay: "Barangay 354 Tayuman",
  address: "",
  mobile: "",
  program: PROGRAMS[0],
  emergencyName: "",
  emergencyRelationship: "",
  emergencyNumber: "",
  changeReason: "",
  documentsReviewed: false,
};

export default function EditBeneficiaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useApiRefresh();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Live record from the backend.
  const { data: record, isLoading, error: loadError, refetch } = useEndpoint(
    id ? `/beneficiaries/${encodeURIComponent(id)}` : "",
    selectRecord,
    { enabled: Boolean(id) }
  );

  // Pre-fill the form once when the server record arrives; after that the
  // local form state is the source of truth so typing is never overwritten.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!record || seededRef.current) return;
    seededRef.current = true;
    setForm((prev) => ({ ...prev, ...record.formPatch }));
  }, [record]);

  const summary = record;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.changeReason.trim()) {
      setError("Please provide a reason for this change.");
      return;
    }

    setSubmitting(true);
    const fullAddress = [
      form.houseNo.trim(),
      form.street.trim(),
      form.barangay.trim(),
      form.city.trim(),
    ]
      .filter(Boolean)
      .join(", ") || form.address.trim();

    // PUT /beneficiaries/:id — only the fields the controller reads.
    const res = await sendApi(
      `/beneficiaries/${encodeURIComponent(id)}`,
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthDate: form.dob || null,
        sex: form.sex,
        address: fullAddress,
        area: form.barangay.trim() || "Barangay 354 Tayuman",
        phone: form.mobile.trim(),
        status: STATUS_TO_SERVER[form.status] || "active",
        program: form.program,
        reason: form.changeReason.trim(),
      },
      "PUT"
    );
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSaved("Changes saved.");
    await refresh(`/beneficiaries/${encodeURIComponent(id)}`);
    await refresh("/beneficiaries");
    await refresh("/dashboard");
    // Success → back to the detail page.
    setTimeout(() => navigate(`/admin/beneficiaries/${encodeURIComponent(id)}`), 700);
  };

  if (isLoading && !record) return <Loading label="Loading beneficiary…" />;
  if (loadError && !record) {
    return (
      <ErrorState
        title="Could not load this beneficiary"
        message={loadError}
        onRetry={refetch}
      />
    );
  }
  if (!record) {
    return (
      <EmptyState
        title="Beneficiary not found"
        message="This record may have been removed."
        action={
          <Link to="/admin/beneficiaries" className="eb-btn eb-btn--outline">
            Back to registry
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Back */}
      <Link to={`/admin/beneficiaries/${encodeURIComponent(id)}`} className="eb-back">
        <ArrowLeft size={14} /> Beneficiary detail
      </Link>

      {/* Header */}
      <div className="eb-header">
        <h1 className="eb-header__title">Edit beneficiary details</h1>
        <p className="eb-header__subtitle">
          Beneficiary registry / {record?.publicId || "—"}
        </p>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="eb-layout">
        {/* ============ LEFT: FORM ============ */}
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ marginBottom: 16 }}>
              <InlineNotice kind="error">{error}</InlineNotice>
            </div>
          )}
          {saved && (
            <div style={{ marginBottom: 16 }}>
              <InlineNotice kind="success">{saved}</InlineNotice>
            </div>
          )}

          {/* --- Identity information --- */}
          <div className="eb-panel">
            <h2 className="eb-panel__title">Identity information</h2>

            {/* Name row */}
            <div className="eb-row" style={{ marginBottom: 16 }}>
              <div className="eb-field" style={{ marginBottom: 0 }}>
                <label className="eb-label">
                  First name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  required
                />
              </div>
              <div className="eb-field" style={{ marginBottom: 0 }}>
                <label className="eb-label">Middle name</label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.middleName}
                  onChange={(e) => update("middleName", e.target.value)}
                />
              </div>
              <div className="eb-field" style={{ marginBottom: 0 }}>
                <label className="eb-label">
                  Last name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  required
                />
              </div>
            </div>

            {/* DOB + Sex */}
            <div className="eb-row">
              <div className="eb-field">
                <label className="eb-label">
                  Date of birth <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className="eb-input"
                  value={form.dob}
                  onChange={(e) => update("dob", e.target.value)}
                  required
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">
                  Sex <span className="req">*</span>
                </label>
                <select
                  className="eb-select"
                  value={form.sex}
                  onChange={(e) => update("sex", e.target.value)}
                  required
                >
                  {SEXES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div className="eb-row--3 eb-row">
              <div className="eb-field">
                <label className="eb-label">
                  House No. <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.houseNo}
                  onChange={(e) => update("houseNo", e.target.value)}
                  required
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">
                  Street <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                  required
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">
                  City <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="eb-row">
              <div className="eb-field">
                <label className="eb-label">Barangay</label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.barangay}
                  onChange={(e) => update("barangay", e.target.value)}
                />
              </div>
            </div>

            {/* Contact & Program */}
            <div className="eb-row">
              <div className="eb-field">
                <label className="eb-label">
                  Mobile number <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                  required
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">Program</label>
                <select
                  className="eb-select"
                  value={form.program}
                  onChange={(e) => update("program", e.target.value)}
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Beneficiary ID (read-only) */}
            <div className="eb-row">
              <div className="eb-field">
                <label className="eb-label">
                  Beneficiary ID (read-only)
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={record?.publicId || id || ""}
                  readOnly
                  style={{ background: "#f9fafb", color: "#4b5563" }}
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">
                  Status <span className="req">*</span>
                </label>
                <select
                  className="eb-select"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                  required
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* --- Emergency contact --- */}
          <div className="eb-panel">
            <h2 className="eb-panel__title">Emergency contact</h2>

            <div className="eb-row">
              <div className="eb-field">
                <label className="eb-label">Emergency contact</label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.emergencyName}
                  onChange={(e) => update("emergencyName", e.target.value)}
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">Relationship</label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.emergencyRelationship}
                  onChange={(e) =>
                    update("emergencyRelationship", e.target.value)
                  }
                />
              </div>
              <div className="eb-field">
                <label className="eb-label">
                  Emergency contact number
                </label>
                <input
                  type="text"
                  className="eb-input"
                  value={form.emergencyNumber}
                  onChange={(e) =>
                    update("emergencyNumber", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* --- Change record --- */}
          <div className="eb-panel">
            <h2 className="eb-panel__title">Change record</h2>

            <div className="eb-field">
              <label className="eb-label">
                Reason for update <span className="req">*</span>
              </label>
              <textarea
                className="eb-textarea"
                placeholder="Confirm current address and emergency contact during October review."
                value={form.changeReason}
                onChange={(e) => update("changeReason", e.target.value)}
                required
              />
            </div>

            <label className="eb-check">
              <input
                type="checkbox"
                checked={form.documentsReviewed}
                onChange={(e) =>
                  update("documentsReviewed", e.target.checked)
                }
              />
              I have reviewed these changes with the beneficiary or authorized
              representative.
            </label>

            {/* Actions */}
            <div className="eb-actions">
              <button
                type="submit"
                className="eb-btn eb-btn--primary"
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save beneficiary changes"}
              </button>
              <Link
                to={`/admin/beneficiaries/${encodeURIComponent(id)}`}
                className="eb-btn eb-btn--outline"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>

        {/* ============ RIGHT: RECORD SUMMARY + NOTES ============ */}
        <div>
          {/* Record summary */}
          <div className="eb-side">
            <h2 className="eb-side__title">Record summary</h2>

            <span className="eb-side__status">
              • {summary ? summary.status : "Loading"}
            </span>

            <div className="eb-side__field">
              <p className="eb-side__label">Beneficiary ID</p>
              <p className="eb-side__value">
                {summary ? summary.publicId : "—"}
              </p>
            </div>

            <div className="eb-side__field">
              <p className="eb-side__label">Registered</p>
              <p className="eb-side__value">
                {summary ? summary.registeredAt : "—"}
              </p>
            </div>

            <div className="eb-side__field">
              <p className="eb-side__label">Registered by</p>
              <p className="eb-side__value">
                {summary ? summary.registeredBy : "—"}
              </p>
            </div>

            <div className="eb-side__field">
              <p className="eb-side__label">Address</p>
              <p className="eb-side__value eb-side__value--muted">
                {summary?.address || "—"}
              </p>
            </div>

            <div className="eb-side__field">
              <p className="eb-side__label">Program</p>
              <p className="eb-side__value">
                {form.program || summary?.program || "—"}
              </p>
            </div>

            <div className="eb-side__field">
              <p className="eb-side__label">Source</p>
              <p className="eb-side__value eb-side__value--muted">
                Barangay 354 Tayuman Health Center
              </p>
            </div>
          </div>

          {/* Identity note */}
          <div className="eb-info">
            <strong>Identity edits are reviewed</strong>
            Changes to name, birth date or address are logged. Secretary
            (Admin) edits require a reason and may trigger a new ID
            print.
          </div>

          {/* Clinical note */}
          <div className="eb-info">
            <strong>Clinical data is separate</strong>
            Prescriptions and medical history are managed in the clinical
            record. Edits here do not change clinical information.
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="eb-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
