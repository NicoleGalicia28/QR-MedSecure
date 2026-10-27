import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./ChairmanReports.css";

// Maps a report catalog row onto the period key the export endpoint accepts
// (the backend understands today / week / month).
function periodKeyForReport(r) {
  const p = String(r?.period || "").toLowerCase();
  const id = String(r?.id || "").toLowerCase();
  if (p.includes("today") || id.includes("today")) return "today";
  if (p.includes("7 day") || p.includes("week") || id.endsWith("-7")) return "week";
  return "month";
}

export default function ChairmanReportsPage() {
  const navigate = useNavigate();
  const [reportId, setReportId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [search, setSearch] = useState("");

  // Live report catalog from /chairman/reports.
  const {
    data: reports,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/chairman/reports", (res) => res.reports);

  const catalog = Array.isArray(reports) ? reports : [];

  const periodOptions = useMemo(
    () => Array.from(new Set(catalog.map((r) => r.period).filter(Boolean))),
    [catalog]
  );

  const rows = catalog.filter((r) => {
    if (reportId !== "all" && r.id !== reportId) return false;
    if (period !== "all" && r.period !== period) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !String(r.title || "").toLowerCase().includes(q) &&
        !String(r.id || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalRecords = catalog.reduce((sum, r) => sum + (r.records || 0), 0);
  const readyCount = catalog.filter((r) => r.status === "Ready").length;
  const kpis = [
    { label: "Available reports", value: String(catalog.length), hint: "Generated from live data" },
    { label: "Records covered", value: totalRecords.toLocaleString(), hint: "Rows across all reports" },
    { label: "Ready to export", value: String(readyCount), hint: "Generated from the current database" },
  ];

  const openExport = (r) => {
    const key = periodKeyForReport(r);
    navigate(`/chairman/reports/export?period=${key}`);
  };

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="chr-header">
        <div>
          <h1 className="chr-header__title">Statistics &amp; reports</h1>
          <p className="chr-header__subtitle">
            Chairman · Shared aggregate reports for Secretary (Admin).
          </p>
        </div>
        <div className="chr-header__actions">
          <button
            type="button"
            className="chr-btn chr-btn--outline"
            onClick={() => navigate("/chairman/reports/export?period=month")}
          >
            <Download size={14} strokeWidth={2.5} />
            Export CSV
          </button>
          <button
            type="button"
            className="chr-btn chr-btn--primary"
            onClick={() => navigate("/chairman/reports/export?period=month")}
          >
            <FileText size={14} strokeWidth={2.5} />
            Export / Generate
          </button>
        </div>
      </div>

      {/* ---------- FILTERS ---------- */}
      <div className="chr-filters">
        <div className="chr-filter-group">
          <label className="chr-filter-label">Report type</label>
          <select
            className="chr-filter-select"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
          >
            <option value="all">All reports</option>
            {catalog.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>

        <div className="chr-filter-group">
          <label className="chr-filter-label">Reporting period</label>
          <select
            className="chr-filter-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">All periods</option>
            {periodOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="chr-filter-group">
          <label className="chr-filter-label">Search report</label>
          <input
            type="text"
            className="chr-filter-input"
            placeholder="Report title or id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <Loading label="Loading reports…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : catalog.length === 0 ? (
        <EmptyState
          title="No reports available"
          message="The report catalog is empty. Reports appear here once there is data to summarise."
        />
      ) : (
        <>
          {/* ---------- KPI CARDS ---------- */}
          <div className="chr-kpi-grid">
            {kpis.map((k) => (
              <div className="kpi-card" key={k.label}>
                <p className="kpi-card__label">{k.label}</p>
                <p className="kpi-card__value">{k.value}</p>
                <p className="kpi-card__hint">{k.hint}</p>
              </div>
            ))}
          </div>

          {/* ---------- REPORT LIST ---------- */}
          <div className="chr-table-panel">
            <h2 className="chr-panel__title">Available reports</h2>
            <p className="chr-panel__subtitle">
              Aggregated, non-identifying figures · Open a report to preview and
              export it.
            </p>

            {rows.length === 0 ? (
              <EmptyState
                title="No reports match the filters"
                message="Try a different report type, period or search term."
              />
            ) : (
              <table className="chr-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Period</th>
                    <th>Records</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="chr-table__area">{r.title}</td>
                      <td>{r.period}</td>
                      <td className="chr-table__num">{r.records}</td>
                      <td>{r.status}</td>
                      <td>
                        <button
                          type="button"
                          className="chr-btn chr-btn--outline"
                          onClick={() => openExport(r)}
                        >
                          Open &amp; export
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="chr-table-footer">
              <span>
                Showing {rows.length} of {catalog.length} reports · {totalRecords.toLocaleString()}{" "}
                records in total
              </span>
            </div>
          </div>
        </>
      )}

      {/* Page footer */}
      <div className="chr-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman · Aggregate reports</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
