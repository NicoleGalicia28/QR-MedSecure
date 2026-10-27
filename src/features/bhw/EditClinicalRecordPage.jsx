import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { useEndpoint, sendApi, useApiRefresh } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./AddMedicalHistory.css";

export default function EditClinicalRecordPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const refresh = useApiRefresh();

  const { data: record, isLoading, error, refetch } = useEndpoint(
    `/clinical-records/${id}`,
    (res) => res.record
  );

  const [form, setForm] = useState({
    type: "",
    findings: "",
    bloodPressure: "",
    weight: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (record) {
      setForm({
        type: record.type || "",
        findings: record.findings || "",
        bloodPressure: record.bloodPressure || "",
        weight: record.weight || "",
      });
    }
  }, [record]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !record) return;
    setSubmitting(true);
    setNotice(null);
    const res = await sendApi(`/clinical-records/${record.id}`, form, "PUT");
    setSubmitting(false);
    if (!res.ok) {
      setNotice({ kind: "error", message: res.error || "Failed to update record." });
      return;
    }
    await refresh("/clinical-records");
    await refresh(`/clinical-records/${record.id}`);
    navigate(`/bhw/clinical-records/${record.id}`);
  };

  if (isLoading && !record) return <Loading label="Loading record…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Link to={`/bhw/clinical-records/${id}`} className="amh-back">
        <ArrowLeft size={14} /> Back to clinical record
      </Link>
      <div className="amh-header">
        <h1 className="amh-header__title">Edit clinical record</h1>
        <p className="amh-header__subtitle">
          {record?.beneficiary || "—"} · {record?.code || id}
        </p>
      </div>
      <form className="amh-panel" onSubmit={handleSubmit} style={{ maxWidth: 720 }}>
        <div className="amh-field">
          <label className="amh-label">Type</label>
          <input className="amh-input" value={form.type} onChange={(e) => update("type", e.target.value)} required />
        </div>
        <div className="amh-field">
          <label className="amh-label">Findings / Notes</label>
          <textarea className="amh-textarea" rows={6} value={form.findings} onChange={(e) => update("findings", e.target.value)} />
        </div>
        <div className="amh-row">
          <div className="amh-field">
            <label className="amh-label">Blood pressure</label>
            <input className="amh-input" value={form.bloodPressure} onChange={(e) => update("bloodPressure", e.target.value)} placeholder="120/80" />
          </div>
          <div className="amh-field">
            <label className="amh-label">Weight</label>
            <input className="amh-input" value={form.weight} onChange={(e) => update("weight", e.target.value)} placeholder="70 kg" />
          </div>
        </div>
        {notice && <InlineNotice kind={notice.kind}>{notice.message}</InlineNotice>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            <Save size={14} strokeWidth={2.5} /> {submitting ? "Saving…" : "Save changes"}
          </button>
          <Link to={`/bhw/clinical-records/${id}`} className="btn btn--outline">Cancel</Link>
        </div>
      </form>
    </>
  );
}
