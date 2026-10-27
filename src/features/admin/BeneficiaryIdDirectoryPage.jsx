import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  QrCode,
  Printer,
  Download,
  Activity,
} from "lucide-react";
import QRCode from "qrcode";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./BeneficiaryIdDirectory.css";

const TABS = [
  { key: "all", label: "All IDs" },
  { key: "pending", label: "Awaiting print" },
  { key: "inactive", label: "Inactive" },
];

const STATUS_OPTIONS = ["All statuses", "Issued", "Pending", "Inactive"];

// Maps each tab key to the statuses it shows.
const TAB_MATCH = {
  all: () => true,
  pending: (row) => row.status === "pending",
  inactive: (row) => row.status === "inactive",
};

// ---- helpers: map API beneficiary-id rows onto the directory's statuses ----
// GET /admin/beneficiary-ids → { ids: [{ publicId, name, area, status }] }.
// status is "issued" (QR exists), "pending" (no QR yet) or "inactive"
// (archived record), so the pill labels map 1:1 onto the lifecycle.
function idStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("pending")) return "pending";
  if (s.includes("inactive") || s.includes("archived") || s.includes("expired"))
    return "inactive";
  if (s.includes("printed")) return "issued";
  return "issued";
}

const selectIds = (res) => {
  const rows = Array.isArray(res.ids) ? res.ids : [];
  return rows.map((r) => ({
    name: r.name || "—",
    id: r.publicId || "—",
    status: idStatus(r.status),
    program: r.program || "—",
    area: r.area || "—",
    createdAt: r.createdAt,
  }));
};

// Full registry row for the selected ID (address, program, dates).
const selectBeneficiary = (res) => {
  const b = res?.beneficiary;
  if (!b) return null;
  const year = parseInt(String(b.birthDate || "").slice(0, 4), 10);
  const age = year ? new Date().getFullYear() - year : null;
  return { 
    name: b.name || `${b.firstName || ""} ${b.lastName || ""}`.trim() || "—", 
    publicId: b.publicId || "—", 
    address: b.address || "—", 
    area: b.area || "—", 
    program: age !== null && age >= 60 ? "Senior Citizen · Maintenance" : "General", 
    issued: String(b.createdAt || "").slice(0, 10), 
    createdAt: b.createdAt,
  }; 
};

export default function BeneficiaryIdDirectoryPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);
  const [selected, setSelected] = useState(id || "");

  const { data, isLoading, error, refetch } = useEndpoint(
    "/admin/beneficiary-ids",
    selectIds
  );
  const rows = data ?? [];

  // Detail row behind the card preview (address/program/dates).
  const detailQuery = useEndpoint(
    selected ? `/beneficiaries/${encodeURIComponent(selected)}` : "",
    selectBeneficiary,
    { enabled: Boolean(selected) }
  );
  const detail = detailQuery.data;

  // Default the preview selection to the first directory row.
  useEffect(() => {
    if (!selected && rows.length > 0) setSelected(rows[0].id);
  }, [rows, selected]);

  const filtered = useMemo(() => { 
    return rows
      .filter((row) => { 
        const matchesSearch = 
          !search || 
          row.name.toLowerCase().includes(search.toLowerCase()) || 
          row.id.toLowerCase().includes(search.toLowerCase()); 

        const matchesStatus = 
          status === STATUS_OPTIONS[0] || 
          row.status === status.toLowerCase(); 

        const matchesTab = (TAB_MATCH[activeTab] || TAB_MATCH.all)(row); 

        return matchesSearch && matchesStatus && matchesTab; 
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : (a.id ? 0 : 0);
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
  }, [rows, search, status, activeTab]);

  // Tab counts from the loaded directory.
  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
  };

  // ----- real QR image for the selected card -----
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [includeQr, setIncludeQr] = useState(true);

  useEffect(() => {
    let alive = true;
    setQrDataUrl("");
    setQrError("");
    if (!selected) return () => { alive = false; };
    QRCode.toDataURL(`MEDID:${selected}`, { width: 320, margin: 1 })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch((err) => {
        if (alive) setQrError(err?.message || "QR image could not be generated.");
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  const fileName = `${selected || "beneficiary"}-id-qr.png`;

  // Save ID → downloads the real QR image for the selected beneficiary.
  const handleSave = () => {
    setSaveError("");
    if (!qrDataUrl) {
      setSaveError("Generate the QR image first.");
      return;
    }
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSavedName(fileName);
  };

  // Print ID → the browser print dialog (print-ready card layout).
  const handlePrint = () => {
    if (!selected) {
      setSaveError("Select a beneficiary first.");
      return;
    }
    window.print();
  };

  const previewName = detail?.name || rows.find((r) => r.id === selected)?.name || "—";
  const previewAddress = detail?.address || "—";
  const previewProgram = detail?.program || "—";

  return (
    <>
      {/* Back */}
      <Link to="/admin/beneficiaries" className="bid-back">
        <ArrowLeft size={14} /> Beneficiary registry
      </Link>

      {/* Header */}
      <div className="bid-header">
        <div>
          <h1 className="bid-header__title">Beneficiary IDs</h1>
          <p className="bid-header__subtitle">
            Secretary (Admin) · Generate, view and print beneficiary QR-based
            IDs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bid-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={
              "bid-tab" + (activeTab === t.key ? " bid-tab--active" : "")
            }
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            <span className="bid-tab__count"> ({counts[t.key]})</span>
          </button>
        ))}
      </div>

      {/* ---------- ID DIRECTORY TABLE ---------- */}
      <div className="bid-panel">
        <h2 className="bid-panel__title">ID directory</h2>
        <p className="bid-panel__subtitle">
          Access limited to your assigned barangay.
        </p>

        {isLoading ? (
          <Loading label="Loading beneficiary IDs…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No beneficiary IDs yet"
            message="IDs appear once beneficiaries are registered in the registry."
            action={
              <Link to="/admin/beneficiaries/new" className="bid-btn bid-btn--primary">
                Add beneficiary
              </Link>
            }
          />
        ) : (
          <>
            {/* Filters */}
            <div className="bid-filters">
              <div className="bid-filter-group">
                <label className="bid-filter-label">Search beneficiary</label>
                <input
                  type="text"
                  className="bid-filter-input"
                  placeholder="Name or beneficiary ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="bid-filter-group"> 
                <label className="bid-filter-label">Status</label> 
                <select 
                  className="bid-filter-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <table className="bid-table"> 
              <thead> 
                <tr> 
                  <th>Beneficiary</th> 
                  <th>Beneficiary ID</th> 
                  <th>Status</th> 
                </tr> 
              </thead> 
              <tbody> 
                {filtered.map((row) => ( 
                  <tr 
                    key={row.id} 
                    onClick={() => setSelected(row.id)} 
                    style={{ 
                      cursor: "pointer", 
                      background: row.id === selected ? "#f0fdfa" : undefined, 
                    }} 
                  > 
                    <td className="bid-table__name">{row.name}</td> 
                    <td className="bid-table__id">{row.id}</td> 
                    <td> 
                      <IdStatusPill status={row.status} /> 
                    </td> 
                  </tr> 
                ))} 
                {filtered.length === 0 && ( 
                  <tr> 
                    <td  
                      colSpan={3}  
                      style={{ textAlign: "center", padding: "30px", color: "#9ca3af" }}  
                    > 
                      No IDs match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="bid-footer">
              <span>
                Showing {filtered.length} of {rows.length} beneficiary ID
                {rows.length === 1 ? "" : "s"} · select a row to preview it
              </span>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="bid-actions">
          {selected ? (
            <Link
              to={`/admin/beneficiaries/${encodeURIComponent(selected)}/qr`}
              className="bid-btn bid-btn--primary"
            >
              Generate QR / Create ID
            </Link>
          ) : (
            <button type="button" className="bid-btn bid-btn--primary" disabled>
              Generate QR / Create ID
            </button>
          )}
          <Link to="/admin/beneficiaries" className="bid-btn bid-btn--outline">
            Back to registry
          </Link>
        </div>
      </div>

      {/* Info box */}
      <div className="bid-info">
        <strong>Selected beneficiary ID · {selected || "—"}</strong>
        The QR code contains identity reference only. All 30 data fields remain
        visible; QR code generation does not expose the beneficiary record
        itself.
      </div>

      {saveError && (
        <div style={{ marginBottom: 16 }}>
          <InlineNotice kind="error">{saveError}</InlineNotice>
        </div>
      )}

      {/* ---------- PREVIEW LAYOUT ---------- */}
      <div className="bid-preview-layout">
        {/* ============ LEFT: ID CARD PREVIEWS ============ */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1a1a1a",
              margin: "0 0 14px 0",
            }}
          >
            Beneficiary ID · Front
          </h3>

          {/* Front card */}
          <div className="id-card">
            <div className="id-card__brand">
              <div className="id-card__brand-icon">
                <Activity size={16} strokeWidth={2.5} />
              </div>
              <div>
                <div className="id-card__brand-title">QR-MedSecure</div>
                <div className="id-card__brand-sub">BARANGAY HEALTH ACCESS</div>
              </div>
            </div>

            <hr className="id-card__divider" />

            <p className="id-card__name">{previewName}</p>
            <p className="id-card__sub">
              {previewProgram} · Barangay 354 Tayuman, Manila
            </p>

            <div className="id-card__body">
              <div className="id-card__meta">
                <p className="id-card__meta-label">Beneficiary ID</p>
                <p className="id-card__meta-value">{selected || "—"}</p>

                <p className="id-card__meta-label">Address</p>
                <p className="id-card__meta-value id-card__meta-value--muted">
                  {previewAddress}
                </p>

                <p className="id-card__meta-label">Program</p>
                <p className="id-card__meta-value id-card__meta-value--muted">
                  {previewProgram}
                </p>
              </div>

              <div className="id-card__qr">
                {!includeQr ? (
                  <span
                    className="id-card__qr-label"
                    style={{ textAlign: "center" }}
                  >
                    QR omitted from print
                  </span>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${selected}`}
                    width={96}
                    height={96}
                    style={{ display: "block" }}
                  />
                ) : (
                  <QrCode size={64} strokeWidth={1} color="#0a3d3d" />
                )}
                <span className="id-card__qr-label">Scan to verify</span>
              </div>
            </div>
          </div>

          {/* Back card */}
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#1a1a1a",
              margin: "24px 0 14px 0",
            }}
          >
            Beneficiary ID · Back
          </h3>

          <div className="id-card--back">
            <p className="id-card__back-title">Beneficiary ID · Back</p>
            <p className="id-card__back-text">
              Property of the barangay health center. If found, please return
              to Barangay 354 Tayuman Health Center. If the QR code cannot be
              scanned, present the printed beneficiary number to staff for
              manual verification.
            </p>
            <p className="id-card__back-contact">
              <strong>Barangay 354 Tayuman Health Center</strong>
              <br />
              0917 555 0142 · example@gmail.com
            </p>
          </div>
        </div>

        {/* ============ RIGHT: SIDEBAR ============ */}
        <div>
          {/* Save ID settings */}
          <div className="bid-side-panel">
            <h3 className="bid-side-panel__title">Save ID settings</h3>

            <label className="bid-side-label">File format</label>
            <select className="bid-side-select" disabled>
              <option>PNG · QR image (front)</option>
            </select>

            <label className="bid-side-label">File name</label>
            <input
              type="text"
              className="bid-side-input"
              value={fileName}
              readOnly
            />

            <button
              type="button"
              className="bid-side-btn"
              onClick={handleSave}
              disabled={!qrDataUrl}
            >
              <Download size={13} /> Save ID
            </button>

            {qrError && (
              <p style={{ fontSize: 11, color: "#b91c1c", marginTop: 8 }}>
                {qrError}
              </p>
            )}

            {savedName && (
              <div className="bid-side-success">
                <strong>Saved · {savedName}</strong>
                QR image attached for beneficiary issuance. Print from a
                color printer, glue onto cardstock, and laminate.
              </div>
            )}
          </div>

          {/* Print ID settings */}
          <div className="bid-side-panel">
            <h3 className="bid-side-panel__title">Print ID settings</h3>

            <label className="bid-side-label">Selection</label>
            <input
              type="text"
              className="bid-side-input"
              value={selected || "—"}
              readOnly
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#374151",
                cursor: "pointer",
                margin: "6px 0 12px",
              }}
            >
              <input
                type="checkbox"
                style={{ accentColor: "#0a3d3d" }}
                checked={includeQr}
                onChange={(e) => setIncludeQr(e.target.checked)}
              />
              Include QR on print
            </label>

            <button type="button" className="bid-side-btn" onClick={handlePrint}>
              <Printer size={13} /> Print ID
            </button>

            <p
              style={{
                fontSize: 10.5,
                color: "#9ca3af",
                margin: "8px 0 0",
                lineHeight: 1.5,
              }}
            >
              Print opens your browser's print dialog for the selected ID card.
            </p>
          </div>

          <Link
            to="/admin/beneficiaries"
            className="bid-side-btn bid-side-btn--outline"
          >
            Back to beneficiary IDs
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <div className="bid-footer-note">
        <strong>Confidential beneficiary IDs</strong>
        QR codes contain identity reference only. Do not share or duplicate ID
        files outside the authorized workspace.
      </div>

      {/* Page footer */}
      <div className="bid-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}

/* ---------------- Helper ---------------- */

function IdStatusPill({ status }) {
  if (status === "issued") {
    return <span className="bid-pill bid-pill--issued">• Issued</span>;
  }
  if (status === "pending") {
    return <span className="bid-pill bid-pill--pending">• Pending</span>;
  }
  if (status === "inactive") {
    return <span className="bid-pill bid-pill--expired">• Inactive</span>;
  }
  return null;
}
