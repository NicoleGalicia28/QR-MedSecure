import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, QrCode, Pill, ArrowRight, Users } from "lucide-react";
import PasswordInput from "./PasswordInput";
import { login, homePathFor } from "./authStore";
import "./login-layout.css";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Send each role to its own workspace.
      navigate(homePathFor(result.user), { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-layout__container">
        {/* ============ LEFT PANEL ============ */}
        <div className="auth-layout__left">
          {/* Brand */}
          <div className="login-brand">
            <div className="login-brand__icon">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div className="login-brand__text">
              <span className="login-brand__title">QR-MedSecure</span>
              <span className="login-brand__subtitle">BARANGAY HEALTH ACCESS</span>
            </div>
          </div>

          {/* Hero */}
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

            {/* Icon steps */}
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

          {/* Footer */}
          <div className="login-footer">
            <p>A barangay health initiative</p>
            <p>Confidentiality is part of every step.</p>
          </div>
        </div>

        {/* ============ RIGHT PANEL ============ */}
        <div className="auth-layout__right">
          <div className="login-form-wrapper">
            <p className="login-form__eyebrow">• STAFF ACCESS</p>
            <h2 className="login-form__title">Welcome back</h2>
            <p className="login-form__subtitle">
              Sign in to your barangay health workspace.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-options">
                <a
                  href="mailto:example@gmail.com?subject=Password%20reset%20request"
                  className="form-forgot"
                >
                  Forgot password?
                </a>
              </div>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="form-submit" disabled={loading}>
                <ArrowRight size={16} strokeWidth={2.5} />
                {loading ? "Signing in..." : "Sign in to workspace"}
              </button>
            </form>

            {/* Info box */}
            <div className="login-info-box">
              <strong>Your role determines your access</strong>
              <br />
              BHW, Chairman and Secretary (Admin) accounts open their
              assigned workspace after approval.
            </div>

            {/* Bottom links */}
            <div className="login-links">
              <p>
                New barangay staff member?{" "}
                <Link to="/signup">Request an account →</Link>
              </p>
              <p>
                Need help signing in? Contact your barangay administrator at{" "}
                <a href="mailto:example@gmail.com">example@gmail.com</a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}