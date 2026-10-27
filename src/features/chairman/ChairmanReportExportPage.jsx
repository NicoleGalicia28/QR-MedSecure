import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Download } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { downloadFile } from "../../lib/api";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./ChairmanReportExport.css";

const TABS = [
  { key: "preview", label: "Report preview" },
  { key: "export", label: "Export setup" },
  { key: "alerts", label: "Aggregate alerts" },
];

// The backend report endpoints understand today / week / month.
const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Last 7 days" },
  { key: "month", label: "Last 30 days" },
];

export default function ChairmanReportExportPage() {
  const [searchParams] = useSearchParams();
  const initialPeriod = PERIODS.some((p) => p.key === searchParams.get("period"))
    ? searchParams.get("period")
    : "month";

  const [activeTab, setActiveTab] = useState("preview");
  const [period, setPeriod] = useState(initialPeriod);
  const [generated, setGenerated] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState(null);

  const periodLabel =
    PERIODS.find((p) => p.key === period)?.label || "Last 30 days";

  // Live preview lines for the selected period.
  const {
    data: preview,
    isLoading,
    error,
    refetch,
  } = useEndpoint(`/chairman/reports/preview?period=${period}`, (res) => res.preview);

  const lines = Array.isArray(preview?.lines) ? preview.lines : [];

  const handleGenerate = async () => {
    setNotice(null);
    const res = await refetch();
    if (res.error) {
      setNotice({
        kind: "error",
        text: res.error.message || "Could not generate the report.",
      });
      return;
    }
    setGenerated(true);
    setActiveTab("preview");
    setNotice({ kind: "success", text: "Report regenerated from live data." });
  };

  const handleDownload = async () => {
    setDownloading(true);
    setNotice(null);
    try {
      await downloadFile(
        `/chairman/reports/export.csv?period=${encodeURIComponent(period)}`,
        `dispensing-${period}.csv`
      );
      setNotice({ kind: "success", text: "Export downloaded." });
    } catch (err) {
      setNotice({ kind: "error", text: err.message || "Download failed." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Back */}
      <Link to="/chairman/reports" className="cre-back">
        <ArrowLeft size={14} /> Statistics &amp; reports
      </Link>

      {/* Header */}
      <div className="cre-header">
        <h1 className="cre-header__title">Report preview &amp; export</h1>
        <p className="cre-header__subtitle">
          {periodLabel} · Aggregate oversight only.
        </p>
      </div>

      {/* Tabs */}
      <div className="cre-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={
              "cre-tab" + (activeTab === t.key ? " cre-tab--active" : "")
            }
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && <InlineNotice kind={notice.kind}>{notice.text}</InlineNotice>}

      {/* ---------- EXPORT SETUP ---------- */}
      {activeTab === "export" && (
        <div className="cre-panel">
          <h2 className="cre-panel__title">Report period</h2>
          <p className="cre-panel__subtitle">
            Configure the data range, then generate the report before exporting.
          </p>

          <div className="cre-filters">
            <div className="cre-filter-group">
              <label className="cre-filter-label">Period</label>
              <select
                className="cre-filter-select"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setGenerated(false);
                }}
              >
                {PERIODS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="cre-actions">
            <button
              type="button"
              className="cre-btn cre-btn--primary"
              onClick={handleGenerate}
            >
              <FileSpreadsheet size={14} strokeWidth={2.5} />
              Generate report
            </button>
            <button
              type="button"
              className="cre-btn cre-btn--outline"
              onClick={handleDownload}
              disabled={!generated || downloading}
              title={generated ? undefined : "Generate the report first"}
            >
              <Download size={14} strokeWidth={2.5} />
              {downloading ? "Downloading…" : "Download CSV"}
            </button>
            <button
              type="button"
              className="cre-btn cre-btn--outline"
              onClick={() => setActiveTab("preview")}
            >
              Preview report
            </button>
          </div>

          {!generated && (
            <p className="cre-table-footer" style={{ marginTop: 12 }}>
              Generate the report to unlock the CSV download.
            </p>
          )}
        </div>
      )}

      {/* ---------- REPORT PREVIEW ---------- */}
      {activeTab === "preview" && (
        <div style={{ marginTop: 24 }}>
          <div className="cre-panel">
            <div className="cre-filters">
              <div className="cre-filter-group">
                <label className="cre-filter-label">Period</label>
                <select
                  className="cre-filter-select"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setGenerated(false);
                  }}
                >
                  {PERIODS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <Loading label="Loading report preview…" />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : lines.length === 0 ? (
            <EmptyState
              title="Nothing to preview"
              message="There is no data for this period yet."
            />
          ) : (
            <div className="cre-kpi-grid">
              {lines.map((l) => (
                <div className="kpi-card" key={l.metric}>
                  <p className="kpi-card__label">{l.metric}</p>
                  <p className="kpi-card__value">{l.value}</p>
                  <p className="kpi-card__hint">{preview?.period || periodLabel}</p>
                </div>
              ))}
            </div>
          )}

          {/* Privacy note */}
          <div className="cre-info">
            <strong>Privacy-safe report</strong>
            Counts and coverage include aggregate totals only. No names,
            prescriptions or medical histories are included.
          </div>

          {/* Jump to export setup */}
          <div className="cre-bottom-actions">
            <div className="cre-bottom-meta">
              <strong>Ready to export?</strong>
              {periodLabel} · {generated ? "Report generated" : "Not generated yet"}
            </div>
            <div>
              <button
                type="button"
                className="cre-btn cre-btn--primary"
                onClick={() => setActiveTab("export")}
              >
                <Download size={14} strokeWidth={2.5} />
                Export this report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- AGGREGATE ALERTS ---------- */}
      {activeTab === "alerts" && (
        <div style={{ marginTop: 24 }}>
          <div className="cre-panel">
            <h2 className="cre-panel__title">Aggregate alert overview</h2>
            <p className="cre-panel__subtitle">Operational alerts · {periodLabel}</p>

            <InlineNotice kind="info">
              Alert detail is managed in the notification workspace, where each
              alert can be reviewed and acknowledged.
            </InlineNotice>

            <div style={{ marginTop: 16 }}>
              <Link to="/chairman/notifications" className="cre-btn cre-btn--primary">
                Open notifications
              </Link>
              <Link
                to="/chairman/reports"
                className="cre-btn cre-btn--outline"
                style={{ marginLeft: 12 }}
              >
                Return to reports
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Page footer */}
      <div className="cre-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman · Aggregate reports</span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
