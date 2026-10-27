import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, QrCode, Pill, Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { submitAccountRequest } from "./authStore";
import { InlineNotice } from "../../lib/ui";
import PasswordInput from "./PasswordInput";
import "./login-layout.css";
import "./SignupPage.css";

const ROLES = [
  { value: "bhw", label: "BHW" },
  { value: "chairman", label: "Chairman" },
  { value: "secretary", label: "Secretary (Admin)" },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    role: "bhw",
    agreed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.agreed) {
      setError("Please agree to the privacy policy and confidentiality commitment.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitAccountRequest({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        mobile: form.mobile,
        role: ROLES.find((r) => r.value === form.role)?.label || form.role,
        password: form.password,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      navigate(
        `/request-submitted?id=${res.request.id}&email=${encodeURIComponent(form.email)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        {/* ============ LEFT PANEL ============ */}
        <div className="auth-layout__left">
          <div className="login-brand">
            <div className="login-brand__icon">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div className="login-brand__text">
              <span className="login-brand__title">QR-MedSecure</span>
              <span className="login-brand__subtitle">BARANGAY HEALTH ACCESS</span>
            </div>
          </div>

          <div className="login-hero">
            <p className="login-hero__eyebrow">
              BARANGAY 354 TAYUMAN · MANILA
            </p>
            <h1 className="login-hero__title">
              Better access.
              <br />
              Safer medicine.
              <br />
              Stronger community.
            </h1>
            <p className="login-hero__description">
              One secure workspace for the people who keep
              barangay healthcare moving.
            </p>

            <div className="login-steps">
              <div className="login-steps__icons">
                <div className="login-steps__icon-box">
                  <Users size={24} strokeWidth={1.8} />
                </div>
                <div className="login-steps__icon-box">
                  <QrCode size={24} strokeWidth={1.8} />
                </div>
                <div className="login-steps__icon-box">
                  <Pill size={24} strokeWidth={1.8} />
                </div>
              </div>
              <p className="login-steps__caption">
                People <span className="arrow">→</span> Secure identification{" "}
                <span className="arrow">→</span> Care
              </p>
              <p className="login-steps__note">
                Designed for accountable, role-based medicine access.
              </p>
            </div>
          </div>

          <div className="login-footer">
            <p>A barangay health initiative</p>
            <p>Confidentiality is part of every step.</p>
          </div>
        </div>

        {/* ============ RIGHT PANEL ============ */}
        <div className="auth-layout__right">
          <div className="signup-form-wrapper">
            <p className="signup-form__eyebrow">• ACCOUNT REQUEST</p>
            <h2 className="signup-form__title">Join your health team</h2>
            <p className="signup-form__subtitle">
              Create a staff account. An administrator will review your
              appointment and requested role.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    className="form-input"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    className="form-input"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    placeholder="example@gmail.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="mobile">
                    Mobile number
                  </label>
                  <input
                    id="mobile"
                    className="form-input"
                    placeholder="0917 555 0138"
                    value={form.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                  />
                </div>
              </div>

              {/* Passwords */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    Password
                  </label>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••••"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="••••••••••"
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Role */}
              <div className="role-group">
                <label className="form-label">Requested role</label>
                <div className="role-options">
                  {ROLES.map((r) => (
                    <button
                      type="button"
                      key={r.value}
                      className={
                        "role-option" +
                        (form.role === r.value ? " role-option--active" : "")
                      }
                      onClick={() => update("role", r.value)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="role-hint">
                  BHW · inventory, clinical records and medicine dispensing.
                  Access is granted only after approval.
                </p>
              </div>

              {/* Pending notice */}
              <div className="signup-notice">
                <strong>Role verification · Pending approval</strong>
                <br />
                Account requests are reviewed by the barangay Admin. No patient
                records or workspace access are available while approval is
                pending.
              </div>

              {/* Agreement */}
              <label className="signup-agreement">
                <input
                  type="checkbox"
                  checked={form.agreed}
                  onChange={(e) => update("agreed", e.target.checked)}
                />
                I agree to the privacy policy and confidentiality commitment.
              </label>

              {error ? <InlineNotice kind="error">{error}</InlineNotice> : null}

              {/* Actions */}
              <div className="signup-actions">
                <button
                  type="submit"
                  className="form-submit"
                  disabled={submitting}
                >
                  <ArrowRight size={16} strokeWidth={2.5} />
                  {submitting ? "Submitting..." : "Submit account request"}
                </button>
                <button
                  type="button"
                  className="form-submit form-submit--outline"
                  onClick={() => navigate("/login")}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}