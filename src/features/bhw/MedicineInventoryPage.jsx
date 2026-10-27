import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState, EmptyState } from "../../lib/ui";
import { fmtDate } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./MedicineInventory.css";

function statusOf(item) {
  if (Number(item.stock) <= 0) return "low";
  if (String(item.status || "").toLowerCase().includes("low")) return "low";
  if (String(item.status || "").toLowerCase().includes("expir")) return "expiry";
  return "available";
}

export default function MedicineInventoryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: items, isLoading, error, refetch } = useEndpoint(
    "/inventory",
    (res) => res.items || []
  );

  const allowed = new Set(["Amlodipine", "Metformin", "Losartan"]);
  const rows = (items || []).filter((i) => allowed.has(String(i.name || "").split(" ")[0]));

  const lowCount = rows.filter((i) => statusOf(i) === "low").length;
  const availableCount = rows.filter((i) => statusOf(i) === "available").length;
  const expiryCount = rows.filter((i) => statusOf(i) === "expiry").length;

  const filtered = rows.filter((i) => {
    const haystack = `${i.name} ${i.code} ${i.slot}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const s = statusOf(i);
    const matchesFilter =
      filter === "all" ||
      (filter === "low" && s === "low") ||
      (filter === "available" && s === "available") ||
      (filter === "expiry" && s === "expiry");
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <div className="inv-header">
        <div>
          <h1 className="inv-header__title">Medicine inventory</h1>
          <p className="inv-header__subtitle">
            BHW · Track supplies, expiry dates, and replenishment at the health center.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="inv-export-btn" onClick={() => refetch()}>
            <Download size={14} strokeWidth={2.5} />
            Export inventory
          </button>
        </div>
      </div>

      <div className="inv-kpi-grid">
        <div className="kpi-card">
          <p className="kpi-card__label">Medicine types</p>
          <p className="kpi-card__value">{rows.length}</p>
          <p className="kpi-card__hint">{filtered.length} shown</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Below minimum</p>
          <p className="kpi-card__value">{lowCount}</p>
          <p className="kpi-card__hint">Restocking is recommended</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-card__label">Expiring within 90 days</p>
          <p className="kpi-card__value">{expiryCount}</p>
          <p className="kpi-card__hint">No critical items if 0</p>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="inv-low-stock-banner">
          <strong>Low stock alert · Action required</strong>
          <br />
          Some medicines are below their minimum threshold.
        </div>
      )}

      <div className="inv-layout">
        <div className="inv-panel">
          <h2 className="inv-panel__title">Current stock</h2>
          <p className="inv-panel__subtitle">Live inventory from the server.</p>

          <div className="inv-filters">
            <div className="inv-filter-group">
              <label className="inv-filter-label">Search</label>
              <input
                className="inv-filter-input"
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="inv-filter-group">
              <label className="inv-filter-label">Status</label>
              <select className="inv-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="low">Low stock</option>
                <option value="expiry">Expiry review</option>
              </select>
            </div>
          </div>

          {isLoading && !items ? (
            <Loading label="Loading inventory…" />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No medicines found" message="Try adjusting filters." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Code</th>
                    <th>Slot</th>
                    <th>Category</th>
                    <th>Minimum</th>
                    <th>Unit</th>
                    <th>Expiry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const s = statusOf(m);
                    return (
                      <tr key={m.id}>
                        <td className="inv-table__name">{m.name}</td>
                        <td>{m.code}</td>
                        <td>{m.slot || "—"}</td>
                        <td>{m.category || "—"}</td>
                        <td>{m.minimum}</td>
                        <td>{m.unit}</td>
                        <td>{fmtDate(m.expiryDate)}</td>
                        <td>
                          <span className={"inv-pill " + (s === "low" ? "inv-pill--low" : s === "expiry" ? "inv-pill--out" : "inv-pill--ok")}>
                            {s === "low" ? "Low stock" : s === "expiry" ? "Expiry review" : "Available"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="inv-panel">
          <h2 className="inv-panel__title">Restock entry</h2>
          <p className="inv-panel__subtitle">Record new batch received</p>
          <Link to="/bhw/restock" className="restock-submit" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Plus size={14} strokeWidth={2.5} /> Record restock
          </Link>
        </div>
      </div>

      <div className="inv-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
