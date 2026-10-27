// Shared loading / error / empty states for every screen that reads the API.
// Keeping them in one place means all four role workspaces behave the same
// when the backend is slow, down, or has nothing to show yet.
import { isValidElement } from "react";
import { Loader2, AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import "./ui.css";

// Spinner shown while a screen is waiting for its first payload.
export function Loading({ label = "Loading…", className = "" }) {
  return (
    <div className={"qms-state " + className} role="status" aria-live="polite">
      <Loader2 className="qms-state__spin" size={22} />
      <p className="qms-state__label">{label}</p>
    </div>
  );
}

// Shown when a request fails (server unreachable, 4xx/5xx). `onRetry`
// re-runs the failing query so the user can recover without reloading.
export function ErrorState({
  title = "Could not load this page",
  message,
  onRetry,
  className = "",
}) {
  return (
    <div className={"qms-state qms-state--error " + className} role="alert">
      <AlertTriangle className="qms-state__icon" size={22} />
      <p className="qms-state__label">{title}</p>
      {message ? <p className="qms-state__message">{message}</p> : null}
      {onRetry ? (
        <button type="button" className="qms-state__retry" onClick={() => onRetry()}>
          <RefreshCw size={14} /> Try again
        </button>
      ) : null}
    </div>
  );
}

// Shown when a request succeeds but there is nothing to display yet.
// `icon` accepts either a component (icon={Users}) or a ready-made element
// (icon={<Users size={18} />}).
export function EmptyState({
  title = "Nothing to show yet",
  message,
  icon: Icon = Inbox,
  action,
  className = "",
}) {
  const iconNode = isValidElement(Icon) ? (
    Icon
  ) : (
    <Icon className="qms-state__icon" size={22} />
  );
  return (
    <div className={"qms-state qms-state--empty " + className}>
      {iconNode}
      <p className="qms-state__label">{title}</p>
      {message ? <p className="qms-state__message">{message}</p> : null}
      {action}
    </div>
  );
}

// Compact inline banner for form feedback (success / error / info).
export function InlineNotice({ kind = "info", children }) {
  if (!children) return null;
  return (
    <div className={`qms-notice qms-notice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
