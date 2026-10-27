import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Plus,
  Eye,
  QrCode,
  ArrowRight,
} from "lucide-react";
import "../admin/DashboardPage.css";
import "./BeneficiaryRegistry.css";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";

const TABS = [
  { key: "all", label: "All records" },
];

const STATUSES = ["All statuses", "Active", "For review", "Archived"];

// Maps the status dropdown label back to the record field value.
const STATUS_KEY = {
  Active: "active",
  "For review": "review",
  Archived: "archived",
};
const PROGRAMS = [
  "All programs",
  "Senior Citizen · Maintenance",
  "Hypertension",
  "Diabetes",
  "General",
];

// ---- helpers: map API beneficiary rows onto the table's render props -------
function ageFrom(birthDate) {
  const year = parseInt(String(birthDate || "").slice(0, 4), 10);
  return year ? new Date().getFullYear() - year : null;
}

function normStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("review") || s === "for_review") return "review";
  if (s === "inactive" || s === "archived") return "archived";
  return "active";
}

// GET /beneficiaries → { beneficiaries: [{ publicId, firstName, lastName,
// birthDate, sex, area, status }] }. Program is derived from age (senior
// citizen eligibility) since the registry tracks no program field.
const selectBeneficiaries = (res) => {
  const rows = Array.isArray(res.beneficiaries) ? res.beneficiaries : [];
  return rows.map((b) => {
    const age = ageFrom(b.birthDate);
    return {
      name: `${b.firstName || ""} ${b.lastName || ""}`.trim() || "—",
      id: b.publicId || "—",
      age: age === null ? "—" : age,
      sex: b.sex || "—",
      area: b.area || "—",
      program: b.program || (age !== null && age >= 60 ? "Senior Citizen" : "General"),
      status: normStatus(b.status),
      createdAt: b.createdAt,
    };
  });
};

export default function BeneficiaryRegistryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(STATUSES[0]);
  const [program, setProgram] = useState(PROGRAMS[0]);

  const { data, isLoading, error, refetch } = useEndpoint(
    "/beneficiaries",
    selectBeneficiaries
  );
  const beneficiaries = data ?? [];

  const filtered = useMemo(() => { 
    return beneficiaries
      .filter((b) => { 
        const matchesSearch = 
          !search || 
          b.name.toLowerCase().includes(search.toLowerCase()) || 
          b.id.toLowerCase().includes(search.toLowerCase()); 

        const matchesStatus = 
          status === STATUSES[0] || 
          b.status === (STATUS_KEY[status] || status.toLowerCase()); 

        const matchesProgram = program === PROGRAMS[0] || b.program === program; 

        return (
          matchesSearch && matchesStatus && matchesProgram
        );
      })
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
  }, [beneficiaries, search, status, program]);

  // Tab counts follow the loaded registry rows.
  const counts = {
    all: beneficiaries.length,
    active: beneficiaries.filter((b) => b.status === "active").length,
    review: beneficiaries.filter((b) => b.status === "review").length,
    archived: beneficiaries.filter((b) => b.status === "archived").length,
  };

  // Real CSV export of the loaded registry rows (filtered view).
  const handleExport = () => {
    const header = "name,beneficiary_id,age,sex,program,status";
    const lines = filtered.map((b) =>
      [
        `"${b.name}"`,
        b.id,
        b.age,
        b.sex,
        `"${b.program}"`,
        b.status,
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "beneficiary-registry.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="br-header">
        <div>
          <h1 className="br-header__title">Beneficiary registry</h1>
          <p className="br-header__subtitle">
            Secretary (Admin) · Manage identity records, eligibility, and
            QR-based beneficiary IDs.
          </p>
        </div>
        <div className="br-header__actions">
          <button
            type="button"
            className="br-btn br-btn--outline"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download size={14} strokeWidth={2.5} />
            Export records
          </button>
          <Link to="/admin/beneficiaries/new" className="br-btn br-btn--primary">
            <Plus size={14} strokeWidth={2.5} />
            Add beneficiary
          </Link>
        </div>
      </div>

      {/* ---------- TABS ---------- */}
      <div className="br-tabs">
        <span className="br-tab br-tab--active">
          All records <span className="br-tab__count"> ({counts.all})</span>
        </span>
      </div>

      {/* ---------- MAIN PANEL ---------- */}
      <div className="br-panel">
        <h2 className="br-panel__title">Beneficiary records</h2>
        <p className="br-panel__subtitle">
          Access limited to your assigned barangay.
        </p>

        {isLoading ? (
          <Loading label="Loading beneficiary registry…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <>
            {/* Filters */}
            <div className="br-filters">
              <div className="br-filter-group">
                <label className="br-filter-label">Search beneficiary</label>
                <input
                  type="text"
                  className="br-filter-input"
                  placeholder="Name or beneficiary ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="br-filter-group">
                <label className="br-filter-label">Status</label>
                <select
                  className="br-filter-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="br-filter-group">
                <label className="br-filter-label">Program</label>
                <select
                  className="br-filter-select"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {beneficiaries.length === 0 ? (
              <EmptyState
                title="No beneficiaries registered yet"
                message="Register the first beneficiary to populate the registry."
                action={
                  <Link to="/admin/beneficiaries/new" className="br-btn br-btn--primary">
                    <Plus size={14} strokeWidth={2.5} />
                    Add beneficiary
                  </Link>
                }
              />
            ) : (
              <>
                {/* Table */}
                <table className="br-table">
                  <thead>
                    <tr>
                      <th>Beneficiary</th>
                      <th>Beneficiary ID</th>
                      <th>Age / sex</th>
                    <th>Program</th>
                      <th>Status</th>
                      <th>Record actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((b) => (
                      <tr key={b.id}>
                        <td className="br-table__name">{b.name}</td>
                        <td className="br-table__id">{b.id}</td>
                        <td>
                          {b.age} · {b.sex}
                        </td>
                        <td>{b.program}</td>
                        <td>
                          <StatusPill status={b.status} />
                        </td>
                        <td>
                          <div className="br-table__actions">
                            <Link
                              to={`/admin/beneficiaries/${b.id}`}
                              className="br-table__action"
                            >
                              View
                            </Link>
                            <Link
                              to={`/admin/beneficiaries/${b.id}/edit`}
                              className="br-table__action"
                            >
                              Edit
                            </Link>
                            <Link
                              to={`/admin/beneficiaries/${b.id}/qr`}
                              className="br-table__action"
                            >
                              QR / ID
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
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

                {/* Footer */}
                <div className="br-footer">
                  <span>
                    Showing {filtered.length} of {beneficiaries.length} record
                    {beneficiaries.length === 1 ? "" : "s"}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ---------- BOTTOM CARDS ---------- */}
      <div className="br-bottom-grid">
        {/* Record maintenance */}
        <div className="br-card">
          <h3 className="br-card__title">Record maintenance</h3>
          <p className="br-card__text">
            Use <strong>Edit</strong> to update identity and contact details.
            Medical history is available in each clinical record; prescriptions
            remain prescriber-controlled.
          </p>
          <div className="br-card__actions">
            <Link to="/admin/beneficiaries/new" className="br-mini-btn">
              <Eye size={13} /> Register a new record
            </Link>
          </div>
        </div>

        {/* QR / ID workflow */}
        <div className="br-card">
          <h3 className="br-card__title">QR and ID workflow</h3>
          <p className="br-card__text">
            Generate a beneficiary QR; review the identity details, then
            create ID. The ID preview includes separate Save ID and Print ID
            actions.
          </p>
          <div className="br-card__actions">
            <Link to="/admin/ids" className="br-mini-btn">
              <QrCode size={13} /> Open beneficiary IDs
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- FOOTER NOTE ---------- */}
      <div className="br-footer-note">
        <strong>Confidential beneficiary records</strong>
        Secretary (Admin) maintains registry details. BHW views
        identity information for care; Chairman accesses aggregate reports
        rather than this registry.
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="br-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}

/* ---------------- Helpers ---------------- */

function StatusPill({ status }) {
  if (status === "active") {
    return <span className="br-pill br-pill--active">• Active</span>;
  }
  if (status === "review") {
    return <span className="br-pill br-pill--review">• For review</span>;
  }
  if (status === "archived") {
    return <span className="br-pill br-pill--archived">• Archived</span>;
  }
  return null;
}
