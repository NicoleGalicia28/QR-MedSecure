import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import "../admin/DashboardPage.css";
import "./HelpSupport.css";

const FAQS = [
  {
    q: "How do I request workspace access?",
    a: "Submit your appointment document. Secretary (Admin) reviews requests and assigns one of three distinct roles.",
  },
  {
    q: "Who can change beneficiary details?",
    a: "Secretary (Admin) maintains identity records. BHW identity access is read-only.",
  },
  {
    q: "Can staff create prescriptions?",
    a: "No. All staff roles view clinician prescriptions. Clinical authorization stays with the prescribing clinician.",
  },
  {
    q: "What happens when synchronization is off?",
    a: "Local recording remains available. Chairman controls resume; queued updates stay pending.",
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

// Real support mailbox: the Secretary (Admin) account on this deployment.
const SUPPORT_EMAIL = "admin@example.com";

const SUPPORT = {
  contactRole: "Secretary (Admin)",
  inPerson: "Barangay 354 Tayuman Health Center · Staff desk",
  hours: "Monday–Friday · 08:00–17:00 PST",
};

export default function HelpSupportPage() {
  const [form, setForm] = useState({
    topic: TOPICS[0],
    subject: "",
    message: "",
  });

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Opens the mail client addressed to the Secretary (Admin) with the
  // request prefilled — the request is really sent, never faked.
  const handleSubmit = (e) => {
    e.preventDefault();
    const subject =
      form.subject || `[${form.topic}] Support request from BHW`;
    const body = `Topic: ${form.topic}\n\n${form.message}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      {/* Back */}
      <Link to="/bhw/profile" className="hs-back">
        <ArrowLeft size={14} /> Profile &amp; settings
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

          {/* Contact the health center — opens your mail client */}
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
                Send support request via email
              </button>
              <Link to="/bhw/profile" className="hs-btn hs-btn--outline">
                Cancel · Back to settings
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
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
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

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="hs-side-btn"
            >
              Contact via email <ArrowUpRight size={13} />
            </a>

            <Link to="/bhw/profile/security" className="hs-side-btn">
              Security settings <ArrowUpRight size={13} />
            </Link>
          </div>

          {/* Protect privacy */}
          <div className="hs-info" id="confidentiality-guidance">
            <strong>Protect privacy</strong>
            Use only records necessary for your role. Never send full patient
            records, ID files, QR tokens or passwords through unsecured
            channels.
          </div>

          {/* Urgent concerns */}
          <div className="hs-warning">
            <strong>Urgent concerns</strong>
            For medicine safety or an allergy concern, contact the attending
            clinician before dispensing. For a medical emergency, use the local
            emergency care route, not this support form.
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="hs-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records</span>
        <span>Barangay 354 Tayuman health center</span>
      </div>
    </>
  );
}
