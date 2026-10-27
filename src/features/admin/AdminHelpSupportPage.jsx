import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import "./DashboardPage.css";
import "../bhw/HelpSupport.css";

/* -----------------------------------------------------------
   Replace with API + auth user later:
   const { user } = useAuth();
   ----------------------------------------------------------- */

const FAQS = [
  {
    q: "How do I review account requests?",
    a: "Open Account requests to review onboarding records. Approve verified staff and assign one of three distinct roles.",
  },
  {
    q: "Which roles can I assign?",
    a: "Secretary (Admin), BHW and Chairman. Each role gates access to its workspace pages.",
  },
  {
    q: "Can I edit beneficiary identity records?",
    a: "Secretary (Admin) maintains identity records. BHW identity access is read-only.",
  },
  {
    q: "Can staff create prescriptions?",
    a: "No. Clinical authorization stays with the prescribing clinician; all staff roles view prescriptions read-only.",
  },
  {
    q: "What happens when synchronization is off?",
    a: "Local recording continues on the workspace. Changes sync automatically when the connection returns.",
  },
];

const TOPICS = [
  "Account and workspace access",
  "Inventory and restock issue",
  "Machine or device problem",
  "Clinical record question",
  "Synchronization issue",
  "Other",
];

const SUPPORT = {
  contactRole: "Barangay 354 Tayuman · Barangay Captain",
  email: "example@gmail.com",
  inPerson: "Barangay 354 Tayuman Health Center · Staff desk",
  hours: "Monday–Friday · 08:00–17:00 PST",
};

export default function AdminHelpSupportPage() {
  const [form, setForm] = useState({
    topic: TOPICS[0],
    subject: "",
    message: "",
  });

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // No ticket system exists: compose a prefilled email to the health center
    // so the message is actually delivered through the user's mail client.
    const subject = `[${form.topic}] ${form.subject || "Support request"}`;
    const body = form.message || "";
    window.location.href = `mailto:${SUPPORT.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      {/* Back */}
      <Link to="/admin/dashboard" className="hs-back">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="hs-header">
        <h1 className="hs-header__title">Help &amp; support</h1>
        <p className="hs-header__subtitle">
          Get assistance without exposing confidential beneficiary information.
        </p>
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="hs-layout">
        {/* ============ LEFT ============ */}
        <div>
          {/* Common questions */}
          <div className="hs-panel">
            <h2 className="hs-panel__title">Common questions</h2>

            {FAQS.map((f, i) => (
              <div className="hs-faq-item" key={i}>
                <p className="hs-faq__q">{f.q}</p>
                <p className="hs-faq__a">{f.a}</p>
              </div>
            ))}
          </div>

          {/* Contact the health center */}
          <form className="hs-panel" onSubmit={handleSubmit}>
            <h2 className="hs-panel__title">Contact the health center</h2>

            <div className="hs-field">
              <label className="hs-label">Topic</label>
              <select
                className="hs-select"
                value={form.topic}
                onChange={(e) => update("topic", e.target.value)}
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="hs-field">
              <label className="hs-label">Subject</label>
              <input
                type="text"
                className="hs-input"
                placeholder="Question about my assigned workspace"
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
              />
            </div>

            <div className="hs-field">
              <label className="hs-label">Message</label>
              <textarea
                className="hs-textarea"
                placeholder="Describe the issue using a reference number only. Do not include medical history, passwords or a beneficiary QR."
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
              />
            </div>

            <div className="hs-actions">
              <button type="submit" className="hs-btn hs-btn--primary">
                Send email to support
              </button>
              <Link to="/admin/dashboard" className="hs-btn hs-btn--outline">
                Cancel · Back to dashboard
              </Link>
            </div>
          </form>
        </div>

        {/* ============ RIGHT ============ */}
        <div>
          {/* Support routes */}
          <div className="hs-panel">
            <h2 className="hs-panel__title">Support routes</h2>

            <div className="hs-support__group">
              <p className="hs-support__label">Account and role questions</p>
              <p className="hs-support__value">{SUPPORT.contactRole}</p>
            </div>

            <div className="hs-support__group">
              <p className="hs-support__label">Email</p>
              <p className="hs-support__value">
                <a href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</a>
              </p>
            </div>

            <div className="hs-support__group">
              <p className="hs-support__label">In-person assistance</p>
              <p className="hs-support__value hs-support__value--muted">
                {SUPPORT.inPerson}
              </p>
            </div>

            <div className="hs-support__group">
              <p className="hs-support__label">Support hours</p>
              <p className="hs-support__value hs-support__value--muted">
                {SUPPORT.hours}
              </p>
            </div>

            <a href={`mailto:${SUPPORT.email}`} className="hs-side-btn">
              Contact via email <ArrowUpRight size={13} />
            </a>

            <Link to="/admin/profile/security" className="hs-side-btn">
              Review account security
            </Link>
          </div>

          {/* Protect privacy */}
          <div className="hs-info">
            <strong>Protect privacy</strong>
            Use only records necessary for your role. Never send full patient
            records, ID files, QR tokens or passwords through unsecured
            channels.
          </div>

          {/* Urgent concerns */}
          <div className="hs-warning">
            <strong>Urgent concerns</strong>
            For a clinical or medicine safety concern, route it to the barangay
            health team immediately. For a medical emergency, use the local
            emergency care route, not this support form.
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="hs-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}