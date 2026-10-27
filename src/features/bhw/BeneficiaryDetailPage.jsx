import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Plus, FilePlus2, Pencil } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./ClinicalRecordDetail.css";
import "./BhwButtons.css";

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PH");
  } catch {
    return d;
  }
}

export default function BeneficiaryDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useEndpoint(
    `/beneficiaries/${id}`,
    (res) => ({ beneficiary: res.beneficiary, records: res.records || [] })
  );

  const beneficiary = data?.beneficiary;
  const records = data?.records || [];

  if (isLoading && !beneficiary) return <Loading label="Loading beneficiary…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!beneficiary) return <ErrorState title="Not found" message="Beneficiary not found." />;

  const age = beneficiary.birthDate
    ? new Date().getFullYear() - parseInt(beneficiary.birthDate.slice(0, 4), 10)
    : null;

  return (
    <>
      <Link to="/bhw/beneficiaries" className="crd-back">
        <ArrowLeft size={14} /> Beneficiaries
      </Link>

      <div className="crd-header">
        <div>
          <h1 className="crd-header__title">
            {beneficiary.name} · {beneficiary.publicId}
          </h1>
          <p className="crd-header__subtitle">
            {age ? `${age} yrs` : "—"} · {beneficiary.sex || "—"} ·{" "}
            {beneficiary.program || "General"} · Registered{" "}
            {fmtDate(beneficiary.createdAt)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to={`/bhw/clinical-records?beneficiaryId=${beneficiary.publicId}`} className="btn btn--outline">
            <FileText size={14} strokeWidth={2.5} /> View all records
          </Link>
          <Link
            to={`/bhw/beneficiaries/${beneficiary.publicId}/clinical/new`}
            className="btn btn--primary"
          >
            <FilePlus2 size={14} strokeWidth={2.5} /> Add clinical record
          </Link>
        </div>
      </div>

      <div className="crd-grid">
        <div className="crd-main">
          <div className="crd-panel">
            <h2 className="crd-panel__title">Beneficiary details</h2>
            <div className="crd-section">
              <div className="crd-row">
                <span className="crd-row__label">Birth date</span>
                <span className="crd-row__value">{fmtDate(beneficiary.birthDate)}</span>
              </div>
              <div className="crd-row">
                <span className="crd-row__label">Civil status</span>
                <span className="crd-row__value">{beneficiary.civilStatus || "—"}</span>
              </div>
              <div className="crd-row">
                <span className="crd-row__label">Phone</span>
                <span className="crd-row__value">{beneficiary.phone || "—"}</span>
              </div>
              <div className="crd-row">
                <span className="crd-row__label">Address</span>
                <span className="crd-row__value">{beneficiary.address || "—"}</span>
              </div>
              <div className="crd-row">
                <span className="crd-row__label">Status</span>
                <span className="crd-row__value">{beneficiary.status || "active"}</span>
              </div>
              <div className="crd-row">
                <span className="crd-row__label">Registered</span>
                <span className="crd-row__value">{fmtDate(beneficiary.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="crd-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="crd-panel__title">
                Clinical records{" "}
                <span style={{ fontWeight: 500, color: "#6b7280", fontSize: 13 }}>
                  ({records.length})
                </span>
              </h2>
              <Link to={`/bhw/clinical-records?beneficiaryId=${beneficiary.publicId}`} className="cr-action">
                Open full list
              </Link>
            </div>

            {records.length === 0 ? (
              <div className="crd-empty">
                <p className="crd-empty__title">No medical record yet</p>
                <p className="crd-empty__text">
                  This beneficiary was registered without a clinical record. Create the
                  first one so the health center can track their medical history.
                </p>
                <Link
                  to={`/bhw/beneficiaries/${beneficiary.publicId}/clinical/new`}
                  className="btn btn--primary"
                >
                  <Plus size={14} strokeWidth={2.5} /> Create the first clinical record
                </Link>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {records.slice(0, 8).map((r) => (
                  <div key={r.id} className="crd-entry">
                    <Link to={`/bhw/clinical-records/${r.id}`}>
                      <div>
                        <div className="crd-entry__title">
                          {r.type} · {r.code}
                        </div>
                        <div className="crd-entry__meta">
                          {fmtDate(r.recordedAt)} · {r.recordedBy || "—"}
                        </div>
                      </div>
                    </Link>
                    <span className="crd-entry__actions">
                      <span className="cr-pill cr-pill--active">• Complete</span>
                      <Link
                        to={`/bhw/beneficiaries/${beneficiary.publicId}/clinical/${r.id}/edit`}
                        className="cr-action"
                      >
                        <Pencil size={11} /> Edit
                      </Link>
                    </span>
                  </div>
                ))}
                {records.length > 8 ? (
                  <Link
                    to={`/bhw/clinical-records?beneficiaryId=${beneficiary.publicId}`}
                    className="cr-action"
                    style={{ display: "inline-block", marginTop: 10 }}
                  >
                    View all {records.length} records
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="restock-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
