import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, FileText, RefreshCw, FilePlus2, ChevronRight } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./ClinicalRecords.css";
import "./BhwButtons.css";
import "./BeneficiariesPage.css";

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PH");
  } catch {
    return d;
  }
}

export default function BeneficiariesPage() {
  const [q, setQ] = useState("");
  const [needsRecord, setNeedsRecord] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useEndpoint(
    "/beneficiaries",
    (res) => res.beneficiaries || []
  );

  const list = (data || [])
    .filter((b) => {
      if (needsRecord && Number(b.recordsCount || 0) > 0) return false;
      if (!q) return true;
      const hay = `${b.name} ${b.publicId} ${b.phone} ${b.address}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.publicId || "").localeCompare(a.publicId || "");
    });

  const total = (data || []).length;
  const withoutRecord = (data || []).filter((b) => Number(b.recordsCount || 0) === 0).length;

  return (
    <div className="benef-page">
      <div className="cr-header">
        <div>
          <h1 className="cr-header__title">Beneficiaries</h1>
          <p className="cr-header__subtitle">
            Barangay 354 Tayuman · Every registered beneficiary, newest first. Open
            a record to add or edit the medical record.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} strokeWidth={2.5} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <Link to="/bhw/clinical-records" className="btn btn--primary">
            <FileText size={14} strokeWidth={2.5} /> Clinical records
          </Link>
        </div>
      </div>

      <div className="cr-panel" style={{ marginBottom: 12 }}>
        <div className="cr-filters">
          <div className="cr-search">
            <Search size={14} />
            <input
              placeholder="Search by name, ID, phone..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label className="cr-filter-group" style={{ flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={needsRecord}
              onChange={(e) => setNeedsRecord(e.target.checked)}
            />
            <span className="cr-filter-label" style={{ margin: 0 }}>
              Needs a medical record ({withoutRecord})
            </span>
          </label>
        </div>
      </div>

      {isLoading && !data ? (
        <Loading label="Loading beneficiaries…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No beneficiaries found"
          message={
            needsRecord
              ? "Every beneficiary already has a clinical record."
              : "Try adjusting your search or check if records exist."
          }
        />
      ) : (
        <div className="cr-table-wrap">
          <table className="cr-table">
            <thead>
              <tr>
                <th>Beneficiary ID</th>
                <th>Name</th>
                <th>Age/Sex</th>
                <th>Program</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Registered</th>
                <th>Medical record</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const count = Number(b.recordsCount || 0);
                return (
                  <tr key={b.id}>
                    <td>
                      <span className="cr-id">{b.publicId}</span>
                    </td>
                    <td>
                      <Link to={`/bhw/beneficiaries/${b.publicId}`} className="cr-patient__name">
                        {b.name}
                      </Link>
                      <div className="cr-patient__sub">{b.civilStatus || "—"}</div>
                    </td>
                    <td>
                      {b.birthDate ? (
                        <>
                          {new Date().getFullYear() - parseInt(b.birthDate.slice(0, 4), 10)} yrs · {b.sex || "—"}
                        </>
                      ) : (
                        b.sex || "—"
                      )}
                    </td>
                    <td>{b.program || "General"}</td>
                    <td>{b.phone || "—"}</td>
                    <td style={{ maxWidth: 220 }}>{b.address || "—"}</td>
                    <td>{fmtDate(b.createdAt)}</td>
                    <td>
                      {count > 0 ? (
                        <span className="cr-pill cr-pill--active">
                          • {count} record{count > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="cr-pill cr-pill--review">• None yet</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        className="cr-action"
                        to={`/bhw/beneficiaries/${b.publicId}/clinical/new`}
                      >
                        <FilePlus2 size={11} /> Add record
                      </Link>
                      <Link
                        className="cr-action"
                        to={`/bhw/beneficiaries/${b.publicId}`}
                      >
                        <ChevronRight size={11} /> Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="cr-footer">
        <span>
          Showing {list.length} of {total} beneficiary(ies) · {withoutRecord} without a
          medical record
        </span>
      </div>
    </div>
  );
}
