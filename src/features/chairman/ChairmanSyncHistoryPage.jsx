import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { downloadFile } from "../../lib/api";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDate, fmtTime, fmtDateTime, shortInitiator, syncStatusLabel } from "./format";
import "../admin/DashboardPage.css";
import "./ChairmanSyncHistory.css";

const DATE_FILTERS = [
  { key: "week", label: "Last 7 days", days: 7 },
  { key: "month", label: "Last 30 days", days: 30 },
  { key: "all", label: "All time", days: 0 },
];

const OUTCOMES = ["All outcomes", "Completed", "Failed", "Partial"];

export default function ChairmanSyncHistoryPage() {
  const [dateFilter, setDateFilter] = useState("month");
  const [outcome, setOutcome] = useState("All outcomes");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState(null);

  // Live batch history from /chairman/sync/history.
  const {
    data: batches,
    isLoading,
    error,
    refetch,
  } = useEndpoint("/chairman/sync/history", (res) => res.batches);

  const all = Array.isArray(batches) ? batches : [];

  const { days } = DATE_FILTERS.find((f) => f.key === dateFilter) || DATE_FILTERS[2];
  const from = days ? Date.now() - days * 864e5 : 0;

  const rows = all.filter((b) => {
    if (from && new Date(b.startedAt).getTime() < from) return false;
    if (outcome !== "All outcomes" && syncStatusLabel(b.status) !== outcome) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !String(b.batchId || "").toLowerCase().includes(q) &&
        !String(b.initiatedBy || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const lastSuccess = all.find((b) => b.status === "success");
  const totalRecords = all.reduce((sum, b) => sum + (b.records || 0), 0);
  const queued = all.reduce((sum, b) => sum + (b.failed || 0), 0);
  const kpis = [
    {
      label: "Last successful sync",
      value: lastSuccess ? fmtTime(lastSuccess.startedAt) : "—",
      hint: lastSuccess
        ? `${fmtDate(lastSuccess.startedAt)} · Philippine Standard Time`
        : "No successful batch recorded yet",
    },
    {
      label: "Records synchronized",
      value: totalRecords.toLocaleString(),
      hint: `${all.filter((b) => b.status === "success").length} completed batches`,
    },
    {
      label: "Queued records",
      value: String(queued),
      hint: "Records retained from partial or failed batches",
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      await downloadFile("/sync/history/export.csv", "sync-history.csv");
      setNotice({ kind: "success", text: "Sync history exported." });
    } catch (err) {
      setNotice({ kind: "error", text: err.message || "Export failed." });
    } finally {
      setExporting(false);
    }
  };

  const outcomeClass = (status) =>
    status === "success"
      ? "csh-tag csh-tag--success"
      : status === "failed"
        ? "csh-tag csh-tag--failed"
        : "csh-tag";

  const outcomeStyle = (status) =>
    status === "partial" ? { color: "#92400e" } : undefined;

  return (
    <>
      {/* Header */}
      <div className="csh-header">
        <div>
          <h1 className="csh-header__title">Synchronization history</h1>
          <p className="csh-header__subtitle">
            Audit synchronization outcomes across the Barangay 354 Tayuman workspace.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {all.length > 0 && (
            <Link
              to={`/chairman/sync/history/${all[0].batchId}`}
              className="csh-btn"
            >
              View latest batch
            </Link>
          )}
          <button
            type="button"
            className="csh-btn"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={14} strokeWidth={2.5} />
            {exporting ? "Exporting…" : "Export history"}
          </button>
        </div>
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

      {isLoading ? (
        <Loading label="Loading sync history…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : all.length === 0 ? (
        <EmptyState
          title="No sync history yet"
          message="Batches appear here once synchronization has run."
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="csh-kpi-grid">
            {kpis.map((k) => (
              <div className="csh-kpi" key={k.label}>
                <p className="csh-kpi__label">{k.label}</p>
                <p className="csh-kpi__value">{k.value}</p>
                <p className="csh-kpi__hint">{k.hint}</p>
              </div>
            ))}
          </div>

          {/* Info Banner */}
          <div className="csh-info-banner">
            <strong>Shared read-only history</strong>
            Every authorized role can audit synchronization batches. Automatic
            sync on/off is controlled from the Synchronization settings page.
          </div>

          {/* Main Panel */}
          <div className="csh-panel">
            <h2 className="csh-panel__title">Batch history</h2>
            <p className="csh-panel__subtitle">
              Shared read-only history for all authorized roles.
            </p>

            {/* Filters */}
            <div className="csh-filters">
              <div className="csh-filter-group">
                <label className="csh-filter-label">Reporting dates</label>
                <select
                  className="csh-filter-select"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                >
                  {DATE_FILTERS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="csh-filter-group">
                <label className="csh-filter-label">Outcome</label>
                <select
                  className="csh-filter-select"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  {OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div className="csh-filter-group">
                <label className="csh-filter-label">Search batch</label>
                <input
                  type="text"
                  className="csh-filter-input"
                  placeholder="Batch ID or initiated by…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <EmptyState
                title="No batches match the filters"
                message="Try a different date range, outcome or search term."
              />
            ) : (
              <table className="csh-table">
                <thead>
                  <tr>
                    <th>Batch / Initiated by</th>
                    <th>Started</th>
                    <th>Records</th>
                    <th>Failed</th>
                    <th>Outcome</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.batchId}>
                      <td className="csh-table__batch">
                        <Link
                          to={`/chairman/sync/history/${b.batchId}`}
                          className="csh-link"
                        >
                          {b.batchId}
                        </Link>
                        {" · "}
                        {shortInitiator(b.initiatedBy)}
                      </td>
                      <td className="csh-table__num">{fmtDateTime(b.startedAt)}</td>
                      <td className="csh-table__num">{b.records ?? 0}</td>
                      <td className="csh-table__num">{b.failed ?? 0}</td>
                      <td>
                        <span
                          className={outcomeClass(b.status)}
                          style={outcomeStyle(b.status)}
                        >
                          • {syncStatusLabel(b.status)}
                        </span>
                      </td>
                      <td>
                        <span className="csh-details">
                          {b.device || "—"} ·{" "}
                          <Link
                            to={`/chairman/sync/history/${b.batchId}`}
                            className="csh-link"
                          >
                            View detail
                          </Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Footer */}
            <div className="csh-table-footer">
              <span>
                Showing {rows.length} of {all.length} batches · All times PHT
              </span>
            </div>
          </div>
        </>
      )}

      {/* Page footer */}
      <div className="csh-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman · Synchronization history</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
