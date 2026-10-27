import { useMemo, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { getSession, roleKey } from "../auth/authStore";
import { fmtDate, fmtTime, fmtMonthYear, dateKey } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./TransactionHistory.css";

function displayStatus(t) {
  if (t.status === "completed") return "dispensed";
  if (t.status === "voided") return "voided";
  return String(t.status || "").toLowerCase();
}

// The page is shared by the BHW and admin workspaces, so every workspace
// link has to point at the signed-in user's own workspace.
function useWorkspaceBase() {
  const session = getSession();
  const key = roleKey(session);
  if (key === "admin") return "/admin";
  if (key === "chairman") return "/chairman";
  return "/bhw";
}

export default function TransactionHistoryPage() {
  const navigate = useNavigate();
  const base = useWorkspaceBase();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState(null);

  // Live dispensing log straight from the server.
  const { data: transactions, isLoading, error, refetch } = useEndpoint(
    "/transactions",
    (res) =>
      (res.transactions || []).map((t) => ({
        id: t.id,
        code: t.code,
        time: fmtTime(t.at),
        date: fmtDate(t.at),
        beneficiary: t.beneficiary,
        beneficiaryId: t.beneficiaryId,
        medicine: t.medicine,
        quantity: t.quantity,
        status: displayStatus(t),
        dispensedBy: t.dispensedBy,
        machine: t.machine,
        note: t.note,
        at: t.at,
        dateKey: dateKey(t.at),
        confirmedAt: `${fmtDate(t.at)}, ${fmtTime(t.at)}`,
        period: fmtMonthYear(t.at),
      }))
  );

  const rows = transactions || [];

  const filtered = useMemo(() => {
    return rows.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        String(t.code).toLowerCase().includes(q) ||
        t.beneficiary.toLowerCase().includes(q) ||
        t.medicine.toLowerCase().includes(q) ||
        String(t.date || "").toLowerCase().includes(q) ||
        String(t.dateKey || "").toLowerCase().includes(q) ||
        String(t.confirmedAt || "").toLowerCase().includes(q);
      const matchesStatus = status === "all" || t.status === status;
      const matchesDate = !dateFilter || t.dateKey === dateFilter;
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [search, status, dateFilter, rows]);

  const selected =
    rows.find((t) => t.id === selectedId) || filtered[0] || rows[0] || null;

  // Real client-side CSV export of the currently filtered log.
  const handleExport = () => {
    const header = [
      "Code",
      "Date",
      "Time",
      "Beneficiary",
      "Beneficiary ID",
      "Medicine",
      "Quantity",
      "Dispensed by",
      "Machine",
      "Status",
      "Note",
    ];
    const lines = filtered.map((t) =>
      [
        t.code,
        t.dateKey,
        t.time,
        t.beneficiary,
        t.beneficiaryId,
        t.medicine,
        t.quantity,
        t.dispensedBy,
        t.machine,
        t.status,
        t.note,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="th-header">
        <div>
          <h1 className="th-header__title">Transaction history</h1>
          <p className="th-header__subtitle">
            Every confirmed medicine release recorded by the dispensing machine and
            the health center staff.
          </p>
        </div>
        <button
          type="button"
          className="th-export-btn"
          onClick={handleExport}
          disabled={filtered.length === 0}
        >
          <Download size={14} strokeWidth={2.5} />
          Export CSV
        </button>
      </div>

      {/* ---------- FILTER PANEL ---------- */}
      <div className="th-filter-panel">
        <h2 className="th-filter-panel__title">Search transactions</h2>

        <div className="th-filters">
          <div className="th-filter-group">
            <label className="th-filter-label">Search</label>
            <input
              type="text"
              className="th-filter-input"
              placeholder="Beneficiary, medicine, date, or transaction code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="th-filter-group">
            <label className="th-filter-label">Date</label>
            <input
              type="date"
              className="th-filter-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="th-filter-group">
            <label className="th-filter-label">Status</label>
            <select
              className="th-filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="dispensed">Dispensed</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading && !transactions ? (
        <Loading label="Loading dispensing log." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          message="Confirmed dispensing entries will appear here."
        />
      ) : (
        <>
          {/* ---------- MAIN LAYOUT ---------- */}
          <div className="th-layout">
            {/* ============ LEFT: LOG ============ */}
            <div className="th-log-panel">
              <h2 className="th-log-panel__title">Dispensing log</h2>
              <p className="th-log-panel__subtitle">Most recent first</p>

              {filtered.length === 0 ? (
                <EmptyState
                  title="No matching transactions"
                  message="Adjust the search, date or status filter to see entries."
                />
              ) : (
                <table className="th-table">
                  <thead>
                    <tr>
                      <th>Date / time</th>
                      <th>Transaction</th>
                      <th>Beneficiary</th>
                      <th>Medicine / quantity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr
                        key={t.id}
                        className={selected?.id === t.id ? "th-row--active" : ""}
                        onClick={() => setSelectedId(t.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="th-table__tx">
                          {t.date} · {t.time}
                        </td>
                        <td>{t.code}</td>
                        <td className="th-table__name">{t.beneficiary}</td>
                        <td>
                          {t.medicine} · {t.quantity}
                        </td>
                        <td>
                          <StatusPill status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="th-footer">
                <span>
                  Showing {filtered.length} of {rows.length} dispensing
                  transaction(s)
                </span>
              </div>
            </div>

            {/* ============ RIGHT: DETAIL ============ */}
            <aside className="th-detail">
              <h2 className="th-detail__title">Transaction details</h2>
              <p className="th-detail__subtitle">
                Full record of the selected dispensing entry.
              </p>

              {selected ? (
                <>
                  <div className={`th-detail__badge th-detail__badge--${selected.status}`}>
                    {selected.status === "dispensed" ? "Dispensed" : selected.status}
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Transaction code</p>
                    <p className="th-detail__value">{selected.code}</p>
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Date dispensed</p>
                    <p className="th-detail__value">{selected.confirmedAt}</p>
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Beneficiary</p>
                    <p className="th-detail__value">
                      {selected.beneficiary} · {selected.beneficiaryId}
                    </p>
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Medicine</p>
                    <p className="th-detail__value">
                      {selected.medicine} · {selected.quantity}
                    </p>
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Dispensed by</p>
                    <p className="th-detail__value">{selected.dispensedBy}</p>
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Machine</p>
                    <p className="th-detail__value">{selected.machine}</p>
                  </div>

                  <div className="th-detail__row">
                    <p className="th-detail__label">Allocation period</p>
                    <p className="th-detail__value">{selected.period}</p>
                  </div>

                  <div className="th-detail__actions">
                    <button
                      type="button"
                      className="th-detail__action"
                      onClick={() => navigate(`${base}/dispensing/${selected.id}`)}
                    >
                      <FileText size={12} /> Dispensed receipt
                    </button>
                    {base === "/bhw" ? (
                      <Link
                        to={`${base}/clinical-records`}
                        className="th-detail__action"
                      >
                        View clinical records <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <Link
                        to={`${base}/beneficiaries`}
                        className="th-detail__action"
                      >
                        View beneficiaries <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <p className="th-detail__empty">
                  Select a transaction from the log to see the details.
                </p>
              )}
            </aside>
          </div>

          <div className="th-footer-note">
            <strong>Audit trail</strong>
            Each entry records the beneficiary, medicine, quantity, staff member
            and exact time of release. Entries cannot be edited — a mistake is
            voided so the original record stays visible.
          </div>
        </>
      )}

      <div className="th-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Dispensing log</span>
      </div>
    </>
  );
}

function StatusPill({ status }) {
  const label =
    status === "dispensed"
      ? "Dispensed"
      : status === "voided"
        ? "Voided"
        : status;
  const cls =
    status === "dispensed"
      ? "th-pill--dispensed"
      : status === "voided"
        ? "th-pill--cancelled"
        : "th-pill--restock";
  return <span className={`th-pill ${cls}`}>{label}</span>;
}
