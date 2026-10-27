import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getSession } from "../auth/authStore";
import { sendApi, useApiRefresh } from "../../lib/useApi";
import { InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./AddBeneficiary.css";

const SEXES = ["Female", "Male"];
const PROGRAMS = [
  "Senior Citizen · Maintenance",
  "Hypertension",
  "Diabetes",
  "General",
];
const STATUSES = [
  "Active · Documents complete",
  "For review · Missing documents",
  "Archived",
];

// Form status label → the status vocabulary the backend stores.
const STATUS_TO_SERVER = {
  "Active · Documents complete": "active",
  "For review · Missing documents": "review",
  Archived: "inactive",
};

const EMPTY_FORM = {
  // Identity
  firstName: "",
  middleName: "",
  lastName: "",
  dob: "",
  sex: "Female",
  houseNo: "",
  street: "",
  city: "Manila",
  barangay: "Barangay 354 Tayuman",
  address: "",
  idNumber: "",

  // Contact
  mobile: "",
  emergencyName: "",
  relationship: "",
  emergencyNumber: "",

  // Eligibility
  program: PROGRAMS[0],
  status: STATUSES[0],
  eligibilityDoc: "",
  notes: "",

  // Consent checkboxes
  duplicateChecked: false,
  documentsReviewed: false,
  privacyAcknowledged: false,
};

export default function AddBeneficiaryPage() {
  const navigate = useNavigate();
  const refresh = useApiRefresh();

  // Recorded-by is driven by the signed-in account.
  const session = getSession();
  const recorder = {
    name: session
      ? `${session.firstName} ${session.lastName}`
      : "Secretary (Admin)",
    role: "Secretary (Admin)",
  };

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [created, setCreated] = useState(null); // server-assigned beneficiary
  const [saveMessage, setSaveMessage] = useState(null);


  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaveMessage(null);

    if (!form.duplicateChecked || !form.documentsReviewed || !form.privacyAcknowledged) {
      setFormError("Confirm the duplicate check, document review and privacy acknowledgment before registering.");
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

    // POST /beneficiaries — the exact body the controller reads.
    const res = await sendApi("/beneficiaries", {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.dob || null,
      sex: form.sex,
      address: fullAddress,
      area: form.barangay.trim() || "Barangay 354 Tayuman",
      phone: form.mobile.trim(),
      status: STATUS_TO_SERVER[form.status] || "active",
      emergencyName: form.emergencyName.trim(),
      emergencyNumber: form.emergencyNumber.trim(),
      relationship: form.relationship.trim(),
      program: form.program,
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(res.error);
      // Field-level mapping for the validation messages the server sends.
      const msg = String(res.error || "").toLowerCase();
      const errs = {};
      if (msg.includes("first name")) errs.firstName = true;
      if (msg.includes("last name")) errs.lastName = true;
      if (Object.keys(errs).length) setFieldErrors(errs);
      return;
    }

    const beneficiary = res.data?.beneficiary;
    await refresh("/beneficiaries");
    await refresh("/dashboard");
    setCreated(beneficiary);
    setSaveMessage("Beneficiary registered successfully.");

    // Success notice, then open the new record.
    if (beneficiary?.publicId) {
      setTimeout(() => {
        navigate(`/admin/beneficiaries/${beneficiary.publicId}`);
      }, 1200);
    }
  };

  const createdId = created?.publicId || "";

  return (
    <>
      {/* Back */}
      <Link to="/admin/beneficiaries" className="ab-back">
        <ArrowLeft size={14} /> Beneficiary registry
      </Link>

      {/* Header */}
      <div className="ab-header">
        <h1 className="ab-header__title">Add beneficiary</h1>
        <p className="ab-header__subtitle">
          Register identity, contact and program eligibility. Required fields
          marked *
        </p>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="ab-layout">
        {/* ============ LEFT: FORM ============ */}
        <form onSubmit={handleSubmit}>
          {formError && (
            <div style={{ marginBottom: 16 }}>
              <InlineNotice kind="error">{formError}</InlineNotice>
            </div>
          )}
          {created && (
            <div style={{ marginBottom: 16 }}>
              <InlineNotice kind="success">
                Beneficiary registered{createdId ? ` · ${createdId}` : ""}.
                Opening the record…
              </InlineNotice>
            </div>
          )}

          {/* --- Identity information --- */}
          <div className="ab-panel">
            <h2 className="ab-panel__title">Identity information</h2>
            <p className="ab-panel__subtitle">
              Required registration data · New registry record.
            </p>

            {/* Name row */}
            <div className="ab-row--3 ab-row">
              <div className="ab-field">
                <label className="ab-label">
                  First name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  required
                  style={fieldErrors.firstName ? { borderColor: "#dc2626" } : undefined}
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">Middle name</label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.middleName}
                  onChange={(e) => update("middleName", e.target.value)}
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">
                  Last name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  required
                  style={fieldErrors.lastName ? { borderColor: "#dc2626" } : undefined}
                />
              </div>
            </div>

            {/* DOB + Sex */}
            <div className="ab-row">
              <div className="ab-field">
                <label className="ab-label">
                  Date of birth <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className="ab-input"
                  value={form.dob}
                  onChange={(e) => update("dob", e.target.value)}
                  required
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">
                  Sex <span className="req">*</span>
                </label>
                <select
                  className="ab-select"
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
            <div className="ab-row--3 ab-row">
              <div className="ab-field">
                <label className="ab-label">
                  House No. <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.houseNo}
                  onChange={(e) => update("houseNo", e.target.value)}
                  required
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">
                  Street <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                  required
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">
                  City <span className="req">*</span>
                </label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="ab-row">
              <div className="ab-field">
                <label className="ab-label">Barangay</label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.barangay}
                  onChange={(e) => update("barangay", e.target.value)}
                />
              </div>
            </div>

            {/* Contact & Program */}
            <div className="ab-row">
              <div className="ab-field">
                <label className="ab-label">Mobile number</label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">
                  Program <span className="req">*</span>
                </label>
                <select
                  className="ab-select"
                  value={form.program}
                  onChange={(e) => update("program", e.target.value)}
                  required
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ID */}
            <div className="ab-field">
              <label className="ab-label">Identity document</label>
              <input
                type="text"
                className="ab-input"
                value={form.idNumber}
                onChange={(e) => update("idNumber", e.target.value)}
                placeholder="Assigned after registration"
              />
            </div>

            {/* Duplicate check */}
            <label className="ab-check">
              <input
                type="checkbox"
                checked={form.duplicateChecked}
                onChange={(e) =>
                  update("duplicateChecked", e.target.checked)
                }
              />
              Checked for duplicate name, birth date and identity document
            </label>
          </div>

          {/* --- Emergency contact information --- */}
          <div className="ab-panel">
            <h2 className="ab-panel__title">Emergency contact information</h2>

            <div className="ab-row">
              <div className="ab-field">
                <label className="ab-label">Emergency contact name</label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.emergencyName}
                  onChange={(e) => update("emergencyName", e.target.value)}
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">Relationship</label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.relationship}
                  onChange={(e) => update("relationship", e.target.value)}
                />
              </div>
              <div className="ab-field">
                <label className="ab-label">Emergency contact number</label>
                <input
                  type="text"
                  className="ab-input"
                  value={form.emergencyNumber}
                  onChange={(e) =>
                    update("emergencyNumber", e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {/* --- Eligibility and consent --- */}
          <div className="ab-panel">
            <h2 className="ab-panel__title">Eligibility and consent</h2>

            <div className="ab-field">
              <label className="ab-label">Record status</label>
              <select
                className="ab-select"
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="ab-field">
              <label className="ab-label">Eligibility document</label>
              <input
                type="text"
                className="ab-input"
                value={form.eligibilityDoc}
                onChange={(e) => update("eligibilityDoc", e.target.value)}
                placeholder="e.g. senior citizen ID and residency certificate"
              />
            </div>

            {/* Document review check */}
            <label className="ab-check">
              <input
                type="checkbox"
                checked={form.documentsReviewed}
                onChange={(e) =>
                  update("documentsReviewed", e.target.checked)
                }
              />
              Identity and residency documents reviewed
            </label>

            {/* Privacy check */}
            <label className="ab-check">
              <input
                type="checkbox"
                checked={form.privacyAcknowledged}
                onChange={(e) =>
                  update("privacyAcknowledged", e.target.checked)
                }
              />
              Privacy notice explained and acknowledgment recorded
            </label>

            {/* Registration note */}
            <div className="ab-field" style={{ marginTop: 12 }}>
              <label className="ab-label">Registration note</label>
              <textarea
                className="ab-textarea"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="ab-actions">
              <button
                type="submit"
                className="ab-btn ab-btn--primary"
                disabled={submitting || !!created}
              >
                {submitting ? "Registering…" : "Register beneficiary"}
              </button>
              <Link
                to="/admin/beneficiaries"
                className="ab-btn ab-btn--outline"
              >
                Cancel · Registry
              </Link>
            </div>
          </div>
        </form>

        {/* ============ RIGHT: REVIEW + SUCCESS ============ */}
        <div>
          {/* Review before registration */}
          <div className="ab-panel">
            <h2 className="ab-panel__title">Review before registration</h2>

            <div className="ab-review-row">
              <p className="ab-review__label">Name</p>
              <p className="ab-review__value">
                {[form.firstName, form.middleName, form.lastName]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </p>
            </div>

            <div className="ab-review-row">
              <p className="ab-review__label">Age / sex</p>
              <p className="ab-review__value">
                {form.dob
                  ? `${
                      new Date().getFullYear() -
                      new Date(form.dob).getFullYear()
                    } / ${form.sex}`
                  : "—"}
              </p>
            </div>

            <div className="ab-review-row">
              <p className="ab-review__label">Program</p>
              <p className="ab-review__value">{form.program}</p>
            </div>

            <div className="ab-review-row">
              <p className="ab-review__label">Recorded by</p>
              <p className="ab-review__value">
                {recorder.name} · {recorder.role}
              </p>
            </div>

            <div className="ab-disclaimer">
              <strong>Clinician authorization is separate</strong>
              Registration establishes a beneficiary record, not a prescription
              or medicine release authorization.
            </div>
          </div>

          {/* Registered confirmation */}
          {created && (
            <div className="ab-panel">
              <h2 className="ab-panel__title">Beneficiary registered</h2>
              <p className="ab-panel__subtitle">
                Saved on the server · Ready for review.
              </p>

              <span className="ab-success-status">• Registered</span>

              <div className="ab-review-row">
                <p className="ab-review__label">Assigned Beneficiary ID</p>
                <p className="ab-review__value">{createdId || "—"}</p>
              </div>

              <div className="ab-success-info">
                <strong>Record saved</strong>
                Identity and eligibility stored on the server. Review the
                beneficiary record before generating QR / ID.
              </div>

              {createdId && (
                <Link
                  to={`/admin/beneficiaries/${createdId}`}
                  className="ab-success-btn"
                >
                  View beneficiary details
                </Link>
              )}
              {createdId && (
                <Link
                  to={`/admin/beneficiaries/${createdId}/qr`}
                  className="ab-success-btn"
                >
                  Generate QR / Create ID
                </Link>
              )}
              <Link
                to="/admin/beneficiaries"
                className="ab-success-btn"
              >
                Return to registry
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ab-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
