import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSession, signOut } from "../../auth/authStore";
import { useEndpoint, sendApi, useApiRefresh } from "../../../lib/useApi";
import { InlineNotice, Loading, ErrorState } from "../../../lib/ui";
import "../DashboardPage.css";
import "./ProfileSettings.css";

function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="ps-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        disabled={disabled}
      />
      <span className="ps-switch__slider" />
    </label>
  );
}

export default function SecurityPage() {
  const session = getSession();
  const navigate = useNavigate();
  const refresh = useApiRefresh();

  const { data: me, isLoading, error, refetch } = useEndpoint(
    "/users/me",
    (raw) => raw?.user ?? null,
  );

  const name = [me?.firstName, me?.lastName].filter(Boolean).join(" ") ||
    (session ? `${session.firstName} ${session.lastName}` : "Staff");
  const staffId = me?.id || session?.id || "—";
  const lastSignIn = me?.lastSignIn
    ? new Date(me.lastSignIn).toLocaleString("en-PH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  // ----- Change password form -----
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Security-alert toggles persist to the account's notification preferences.
  const { data: prefs, isLoading: prefsLoading } = useEndpoint(
    "/users/me/notification-preferences",
    (res) => res.preferences,
  );
  const [prefsOverride, setPrefsOverride] = useState(null);
  const [prefMsg, setPrefMsg] = useState(null);
  const alerts = prefsOverride || prefs || null;

  const toggleAlert = async (key) => {
    if (!alerts) return;
    const next = { ...alerts, [key]: !alerts[key] };
    setPrefsOverride(next);
    setPrefMsg(null);
    const res = await sendApi(
      "/users/me/notification-preferences",
      { [key]: next[key] },
      "PUT",
    );
    if (!res.ok) {
      setPrefsOverride(null);
      setPrefMsg({ kind: "error", text: res.error });
      return;
    }
    setPrefsOverride(res.data.preferences);
    setPrefMsg({ kind: "success", text: "Preference saved." });
  };

  const handleSignOut = () => {
    signOut();
    navigate("/login");
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    (async () => {
      setPwdMsg(null);
      if (!currentPw) {
        setPwdMsg({ type: "err", text: "Current password is required." });
        return;
      }
      if (newPw.length < 8) {
        setPwdMsg({
          type: "err",
          text: "New password must be at least 8 characters.",
        });
        return;
      }
      if (newPw !== confirmPw) {
        setPwdMsg({ type: "err", text: "Passwords do not match." });
        return;
      }
      if (newPw === currentPw) {
        setPwdMsg({
          type: "err",
          text: "New password must be different from the current password.",
        });
        return;
      }
      setPwdSaving(true);
      const res = await sendApi("/users/me/password", {
        currentPassword: currentPw,
        newPassword: newPw,
      }, "PUT");
      setPwdSaving(false);
      if (!res.ok) {
        setPwdMsg({ type: "err", text: res.error });
        return;
      }
      setPwdMsg({ type: "ok", text: "Password updated successfully." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      refresh("/users/me");
    })();
  };

  if (isLoading && !me) return <Loading label="Loading security settings…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <div className="ps-header">
        <div>
          <h1 className="ps-header__title">Security &amp; settings</h1>
          <p className="ps-header__subtitle">
            Manage your password and account security.
          </p>
        </div>
        <Link to="/admin/profile" className="ps-edit-btn">
          Back to profile
        </Link>
      </div>

      <div className="ps-tabs">
        <Link to="/admin/profile" className="ps-tab">
          My profile
        </Link>
        <Link to="/admin/profile/security" className="ps-tab ps-tab--active">
          Security
        </Link>
        <Link to="/admin/profile/notifications" className="ps-tab">
          Notifications
        </Link>
      </div>

      <div className="ps-layout">
        <aside className="ps-panel">
          <p className="ps-identity__name">Signed in as</p>
          <p className="ps-identity__role">{name}</p>
          <span className="ps-identity__status">• Active session</span>

          <div className="ps-id-field">
            <p className="ps-id-field__label">Staff ID</p>
            <p className="ps-id-field__value">{staffId}</p>
          </div>

          <div className="ps-id-field">
            <p className="ps-id-field__label">Last sign-in</p>
            <p className="ps-id-field__value ps-id-field__value--muted">
              {lastSignIn}
            </p>
          </div>

          <p className="ps-identity__note">
            Keep your sign-in details private.
          </p>

          <button
            type="button"
            className="ps-btn ps-btn--outline"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </aside>

        <div>
          <div className="ps-panel">
            <h2 className="ps-panel__title">Change password</h2>

            <form className="ps-form" onSubmit={handlePasswordSubmit}>
              <div className="ps-field">
                <label className="ps-label" htmlFor="sec-current-pw">
                  Current password
                </label>
                <input
                  id="sec-current-pw"
                  className="ps-input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="sec-new-pw">
                  New password
                </label>
                <input
                  id="sec-new-pw"
                  className="ps-input"
                  type="password"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
                <p className="ps-hint">
                  Use at least 8 characters with a mix of letters, numbers and
                  symbols.
                </p>
              </div>

              <div className="ps-field">
                <label className="ps-label" htmlFor="sec-confirm-pw">
                  Confirm new password
                </label>
                <input
                  id="sec-confirm-pw"
                  className="ps-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
              </div>

              {pwdMsg && (
                <InlineNotice kind={pwdMsg.type === "ok" ? "success" : "error"}>
                  {pwdMsg.text}
                </InlineNotice>
              )}

              <div className="ps-actions">
                <button
                  type="submit"
                  className="ps-btn ps-btn--primary"
                  disabled={pwdSaving}
                >
                  {pwdSaving ? "Updating…" : "Update password"}
                </button>
                <button
                  type="button"
                  className="ps-btn ps-btn--outline"
                  onClick={() => {
                    setCurrentPw("");
                    setNewPw("");
                    setConfirmPw("");
                    setPwdMsg(null);
                  }}
                  disabled={pwdSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          <div className="ps-panel">
            <h2 className="ps-panel__title">Security alerts</h2>

            {prefsLoading && !alerts && (
              <p className="ps-sec__meta">Loading preferences…</p>
            )}
            {prefMsg && (
              <InlineNotice kind={prefMsg.kind}>{prefMsg.text}</InlineNotice>
            )}

            <div className="ps-sec-row">
              <div className="ps-sec__left">
                <p className="ps-sec__title">New device sign-in</p>
                <p className="ps-sec__meta">
                  Notify you when a new device signs in.
                </p>
              </div>
              <Switch
                checked={alerts?.alertNewDevice !== false}
                onChange={() => toggleAlert("alertNewDevice")}
                label="New device sign-in alert"
                disabled={!alerts}
              />
            </div>

            <div className="ps-sec-row">
              <div className="ps-sec__left">
                <p className="ps-sec__title">Password change</p>
                <p className="ps-sec__meta">
                  Notify you when your password is changed.
                </p>
              </div>
              <Switch
                checked={alerts?.alertPasswordChange !== false}
                onChange={() => toggleAlert("alertPasswordChange")}
                label="Password change alert"
                disabled={!alerts}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ps-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
      </div>
    </>
  );
}
