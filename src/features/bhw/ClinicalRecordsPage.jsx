import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtDate } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./ClinicalRecords.css";

export default function ClinicalRecordsPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  // Deep link from the beneficiary detail page: /clinical-records?beneficiaryId=BEN-0452
  const [searchParams, setSearchParams] = useSearchParams();
  const beneficiaryFilter = searchParams.get("beneficiaryId") || "";

  // Live clinical record entries.
  const { data: records, isLoading, error, refetch } = useEndpoint(
    "/clinical-records",
    (res) => res.records || []
  );

  const rows = (records || []).map((r) => ({
    recordId: r.id,
    code: r.code,
    name: r.beneficiary,
    id: r.beneficiaryId,
    type: r.type,
    recordedBy: r.recordedBy,
    recordedAt: r.recordedAt,
  }));

  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.type).filter(Boolean))),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        String(r.name).toLowerCase().includes(q) ||
        String(r.id).toLowerCase().includes(q) ||
        String(r.code).toLowerCase().includes(q);

      const matchesType = type === "all" || r.type === type;
      const matchesBeneficiary =
        !beneficiaryFilter || String(r.id) === beneficiaryFilter;

      return matchesSearch && matchesType && matchesBeneficiary;
    });
  }, [search, type, beneficiaryFilter, rows]);

  return (
    <>
      {/* Back */}
      <Link to="/bhw/dashboard" className="cr-back">
        <ArrowLeft size={14} /> BHW dashboard
      </Link>

      {/* Header */}
      <div className="cr-header">
        <h1 className="cr-header__title">Clinical records</h1>
        <p className="cr-header__subtitle">
          Search beneficiaries and view clinical history, prescriptions and
          dispensing records.
        </p>
      </div>

      {isLoading && !records ? (
        <Loading label="Loading clinical records…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* Main panel */}
          <div className="cr-panel">
            <h2 className="cr-panel__title">Clinical records directory</h2>
            <p className="cr-panel__subtitle">
              Access limited to Barangay 354 Tayuman, Manila.
            </p>

            {/* Filters */}
            <div className="cr-filters">
              <div className="cr-filter-group">
                <label className="cr-filter-label">Search beneficiary</label>
                <input
                  type="text"
                  className="cr-filter-input"
                  placeholder="Name, beneficiary or record ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="cr-filter-group">
                <label className="cr-filter-label">Record type</label>
                <select
                  className="cr-filter-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="all">All types</option>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {beneficiaryFilter ? (
              <div className="cr-active-filter">
                <span>
                  Filtered to beneficiary <strong>{beneficiaryFilter}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("beneficiaryId");
                    setSearchParams(next);
                  }}
                >
                  Clear filter
                </button>
              </div>
            ) : null}

            {/* Table */}
            {rows.length === 0 ? (
              <EmptyState
                title="No clinical records"
                message="Records created at the health center will appear here."
              />
            ) : (
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Beneficiary</th>
                    <th>Beneficiary ID</th>
                    <th>Type</th>
                    <th>Recorded by</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.recordId}>
                      <td className="cr-table__name">{r.name}</td>
                      <td className="cr-table__id">{r.id}</td>
                      <td>{r.type}</td>
                      <td>
                        {r.recordedBy} · {fmtDate(r.recordedAt)}
                      </td>
                      <td>
                        <Link
                          to={`/bhw/clinical-records/${r.recordId}`}
                          className="cr-table__action"
                        >
                          View clinical record <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                          padding: "30px",
                          color: "#9ca3af",
                        }}
                      >
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Footer */}
            <div className="cr-footer">
              <span>
                Showing {filtered.length} of {rows.length} record(s)
              </span>
              <div className="cr-footer__pagination">
                <button type="button" disabled>
                  ‹
                </button>
                <button type="button">1</button>
                <button type="button" disabled>
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* ---------- BHW CLINICAL ACCESS NOTE ---------- */}
          <div className="cr-access-note">
            <strong>BHW clinical access</strong>
            Identity details are read-only. Add attributable medical history;
            view clinician prescriptions.
          </div>
        </>
      )}

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="cr-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
