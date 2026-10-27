import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "../auth/authStore";
import { useEndpoint, sendApi } from "../../lib/useApi";
import { Loading, ErrorState, InlineNotice } from "../../lib/ui";
import { fmtStamp } from "./format";
import "../admin/DashboardPage.css";
import "../bhw/ProfileSettings.css";

/* Identity comes from the live /users/me record and the security toggles
   from /users/me/notification-preferences; both are persisted server-side. */

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

export default function ChairmanSecurityPage() {
  const navigate = useNavigate();

  // Live account record.
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useEndpoint("/users/me", (res) => res.user);

  // Security toggles are stored as extra keys in the user's preferences.
  const {
    data: prefs,
    isLoading: prefsLoading,
    error: prefsError,
    refetch: refetchPrefs,
  } = useEndpoint(
    "/users/me/notification-preferences",
    (res) => res.preferences,
  );

  const name = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.name ||
      "Chairman"
    : "Chairman";
  const staffId = user?.id ?? "—";
  const lastSignIn = user?.lastSignIn ? fmtStamp(user.lastSignIn) : "—";

  // ----- Change password form -----
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwdNotice, setPwdNotice] = useState(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // ----- Preference toggles -----
  const [savingPref, setSavingPref] = useState(false);
  const [prefNotice, setPrefNotice] = useState(null);

  const togglePref = async (key) => {
    setSavingPref(true);
    setPrefNotice(null);
    const res = await sendApi(
      "/users/me/notification-preferences",
      { [key]: !(prefs?.[key] === true) },
      "PUT",
    );
    setSavingPref(false);
    if (!res.ok) {
      setPrefNotice({ kind: "error", text: res.error });
      return;
    }
    await refetchPrefs();
  };

  // ----- Submit password change -----
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwdNotice(null);
    if (newPw.length < 8) {
      setPwdNotice({
        kind: "error",
        text: "New password must be at least 8 characters.",
      });
      return;
    }
    if (newPw !== confirmPw) {
      setPwdNotice({ kind: "error", text: "Passwords do not match." });
      return;
    }
    setSavingPwd(true);
    const res = await sendApi(
      "/users/me/password",
      { currentPassword: currentPw, newPassword: newPw },
      "PUT",
    );
    setSavingPwd(false);
    if (!res.ok) {
      setPwdNotice({ kind: "error", text: res.error });
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwdNotice({ kind: "success", text: "Password updated successfully." });
  };

  const handleSignOut = () => {
    signOut();
    navigate("/login");
  };

  const loading = userLoading || prefsLoading;
  const error = userError || prefsError;
  const retryAll = () => {
    refetchUser();
    refetchPrefs();
  };

  return (
    <>
      {/* ---------- HEADER ---------- */}
      <div className="ps-header">
        <div>
          <h1 className="ps-header__title">Security &amp; settings</h1>
          <p className="ps-header__subtitle">
            Manage your password, two-factor authentication and active device
            sessions.
          </p>
        </div>
        <Link to="/chairman/profile" className="ps-edit-btn">
          Back to profile
        </Link>
      </div>

      {/* ---------- TABS ---------- */}
      <div className="ps-tabs">
        <Link to="/chairman/profile" className="ps-tab">
          My profile
        </Link>
        <Link to="/chairman/profile/security" className="ps-tab ps-tab--active">
          Security
        </Link>
        <Link to="/chairman/profile/notifications" className="ps-tab">
          Notifications
        </Link>
        <Link to="/chairman/profile?tab=access" className="ps-tab">
          Workspace access
        </Link>
      </div>

      {prefNotice && (
        <InlineNotice kind={prefNotice.kind}>{prefNotice.text}</InlineNotice>
      )}

      {loading ? (
        <Loading label="Loading security settings…" />
      ) : error ? (
        <ErrorState message={error} onRetry={retryAll} />
      ) : (
        <div className="ps-layout">
          {/* ---------- LEFT: IDENTITY CARD ---------- */}
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
              Keep your sign-in details private and review your sessions
              regularly.
            </p>
          </aside>

          {/* ---------- RIGHT: SECURITY CONTENT ---------- */}
          <div>
            {/* Change password */}
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

                {pwdNotice && (
                  <InlineNotice kind={pwdNotice.kind}>
                    {pwdNotice.text}
                  </InlineNotice>
                )}

                <div className="ps-actions">
                  <button
                    type="submit"
                    className="ps-btn ps-btn--primary"
                    disabled={savingPwd}
                  >
                    {savingPwd ? "Updating…" : "Update password"}
                  </button>
                  <button
                    type="button"
                    className="ps-btn ps-btn--outline"
                    onClick={() => {
                      setCurrentPw("");
                      setNewPw("");
                      setConfirmPw("");
                      setPwdNotice(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>

            {/* Two-factor authentication */}
            <div className="ps-panel">
              <h2 className="ps-panel__title">Two-factor authentication</h2>

              <div className="ps-sec-row">
                <div className="ps-sec__left">
                  <p className="ps-sec__title">Two-factor authentication</p>
                  <p className="ps-sec__meta">
                    {prefs?.twoFactor === true ? "Enabled" : "Disabled"} · Adds a
                    second verification step to your sign-in.
                  </p>
                </div>
                <Switch
                  checked={prefs?.twoFactor === true}
                  onChange={() => togglePref("twoFactor")}
                  label="Two-factor authentication"
                  disabled={savingPref}
                />
              </div>
            </div>

            {/* Active sessions */}
            <div className="ps-panel">
              <h2 className="ps-panel__title">Active sessions</h2>

              <div className="ps-sec-row">
                <div className="ps-sec__left">
                  <p className="ps-sec__title">
                    This device
                    <span className="ps-sess-current">Active now</span>
                  </p>
                  <p className="ps-sec__meta">Signed in {lastSignIn}</p>
                </div>
                <button
                  type="button"
                  className="ps-sec__action ps-sec__action--btn"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Security alerts */}
            <div className="ps-panel">
              <h2 className="ps-panel__title">Security alerts</h2>

              <div className="ps-sec-row">
                <div className="ps-sec__left">
                  <p className="ps-sec__title">New device sign-in</p>
                  <p className="ps-sec__meta">
                    Email you when a new device signs in to your account.
                  </p>
                </div>
                <Switch
                  checked={prefs?.alertNewDevice === true}
                  onChange={() => togglePref("alertNewDevice")}
                  label="New device sign-in alert"
                  disabled={savingPref}
                />
              </div>

              <div className="ps-sec-row">
                <div className="ps-sec__left">
                  <p className="ps-sec__title">Password change</p>
                  <p className="ps-sec__meta">
                    Email you when your password is changed.
                  </p>
                </div>
                <Switch
                  checked={prefs?.alertPasswordChange === true}
                  onChange={() => togglePref("alertPasswordChange")}
                  label="Password change alert"
                  disabled={savingPref}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- SECURITY GUIDANCE ---------- */}
      <div className="ps-footer-note">
        <strong>Security guidance</strong>
        Use a unique password and enable two-factor authentication. Sessions
        are limited to devices you approve.
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="ps-page-footer">
        <span>
          QR-MedSecure · Barangay 354 Tayuman, Manila · Confidential records
        </span>
        <span>Chairman workspace</span>
      </div>
    </>
  );
}
