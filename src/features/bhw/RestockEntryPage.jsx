import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./MedicineInventory.css";

export default function RestockEntryPage() {
  const session = getSession();
  const currentUser = session
    ? { name: `${session.firstName} ${session.lastName}`, role: session.role }
    : { name: "BHW Staff", role: "BHW" };
  const navigate = useNavigate();
  const refresh = useApiRefresh();

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const allowed = new Set(["Amlodipine", "Metformin", "Losartan"]);
  const { data: medicines, isLoading, error, refetch } = useEndpoint(
    "/inventory",
    (res) =>
      (res.items || [])
        .filter((i) => allowed.has(String(i.name || "").split(" ")[0]))
        .map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          currentBalance: Number(i.stock) || 0,
          minimum: Number(i.minimum) || 0,
        }))
  );

  const [form, setForm] = useState({
    medicine: "",
    medicineId: "",
    quantity: "",
    unit: "",
    batch: "",
    expiry: "",
    notes: "",
  });

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const selectedMed = useMemo(
    () =>
      (medicines ?? []).find(
        (m) => String(m.id) === String(form.medicineId) || m.name === form.medicine
      ) || null,
    [form.medicineId, form.medicine, medicines]
  );

  const handleMedicineChange = (e) => {
    const val = e.target.value;
    const med = (medicines ?? []).find((m) => m.name === val);
    setForm((prev) => ({
      ...prev,
      medicine: val,
      medicineId: med?.id || "",
      unit: med?.unit || prev.unit,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!selectedMed) {
      setNotice({ kind: "error", message: "Select a medicine." });
      return;
    }
    const qty = Number(form.quantity);
    if (!qty || qty <= 0) {
      setNotice({ kind: "error", message: "Enter a valid quantity." });
      return;
    }
    setSubmitting(true);
    setNotice(null);

    const res = await sendApi("/inventory/restock", {
      medicineId: selectedMed.id,
      quantity: qty,
      expiryDate: form.expiry || undefined,
    });

    setSubmitting(false);
    if (!res.ok) {
      setNotice({ kind: "error", message: res.error });
      return;
    }
    setNotice({ kind: "success", message: "Restock entry saved." });
    setForm({
      medicine: "",
      medicineId: "",
      quantity: "",
      unit: "",
      batch: "",
      expiry: "",
      notes: "",
    });
    await refresh("/inventory");
    await refresh("/medicines");
  };

  return (
    <>
      <div className="inv-header">
        <div>
          <h1 className="inv-header__title">Record medicine restock</h1>
          <p className="inv-header__subtitle">
            BHW · Add a new batch received at the health center.
          </p>
        </div>
        <Link to="/bhw/inventory" className="inv-export-btn" style={{ textDecoration: "none" }}>
          <ArrowLeft size={14} strokeWidth={2.5} />
          Back to inventory
        </Link>
      </div>

      {isLoading && !medicines ? (
        <Loading label="Loading medicines…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="inv-layout">
          <form className="restock-panel" onSubmit={handleSubmit}>
            <h2 className="restock-panel__title">Record medicine restock</h2>
            <p className="restock-panel__subtitle">
              Add a new batch of medicine received at the health center.
            </p>

            <div className="restock-field">
              <label className="restock-label">
                Medicine <span className="req">*</span>
              </label>
              <select
                className="restock-select"
                value={form.medicine}
                onChange={handleMedicineChange}
                required
              >
                <option value="">Select medicine</option>
                {(medicines ?? []).map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="restock-row">
              <div className="restock-field">
                <label className="restock-label">
                  Quantity received <span className="req">*</span>
                </label>
                <input
                  type="number"
                  className="restock-input"
                  value={form.quantity}
                  onChange={(e) => update("quantity", e.target.value)}
                  required
                />
              </div>
              <div className="restock-field">
                <label className="restock-label">Unit</label>
                <input
                  className="restock-input"
                  value={form.unit || selectedMed?.unit || ""}
                  onChange={(e) => update("unit", e.target.value)}
                  placeholder="tablets"
                />
              </div>
            </div>

            <div className="restock-row">
              <div className="restock-field">
                <label className="restock-label">Batch number</label>
                <input
                  className="restock-input"
                  value={form.batch}
                  onChange={(e) => update("batch", e.target.value)}
                />
              </div>
              <div className="restock-field">
                <label className="restock-label">Expiry date</label>
                <input
                  type="date"
                  className="restock-input"
                  value={form.expiry}
                  onChange={(e) => update("expiry", e.target.value)}
                />
              </div>
            </div>

            <div className="restock-field">
              <label className="restock-label">Received by</label>
              <div className="restock-readonly">
                {currentUser.name} · {currentUser.role}
              </div>
            </div>

            <div className="restock-field">
              <label className="restock-label">Notes (optional)</label>
              <textarea
                className="restock-textarea"
                rows={3}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>

            {notice && <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>}

            <button type="submit" className="restock-submit" disabled={submitting}>
              <Save size={14} strokeWidth={2.5} />
              {submitting ? "Saving..." : "Save restock entry"}
            </button>
            <p className="restock-note">
              This will update the current stock levels in the inventory.
            </p>
          </form>

          <div className="restock-panel">
            <h2 className="restock-panel__title">Current stock</h2>
            <p className="restock-panel__subtitle">Summary for selected medicine</p>
            {selectedMed ? (
              <div>
                <div className="restock-row">
                  <div className="restock-field">
                    <label className="restock-label">Current balance</label>
                    <div className="restock-readonly">
                      {selectedMed.currentBalance} {selectedMed.unit || ""}
                    </div>
                  </div>
                  <div className="restock-field">
                    <label className="restock-label">Minimum</label>
                    <div className="restock-readonly">{selectedMed.minimum}</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="restock-note">Select a medicine to view current stock.</p>
            )}
          </div>
        </div>
      )}

      <div className="inv-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
