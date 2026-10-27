import { Navigate, useLocation } from "react-router-dom";
import { getSession, roleKey, homePathFor } from "./authStore";

// Route guard for a specific workspace role ("admin" or "bhw").
// - Not signed in  -> go to /login
// - Wrong workspace -> go to the workspace that matches the user's role
export default function RequireRole({ role, children }) {
  const location = useLocation();
  const session = getSession();
  const current = roleKey(session);

  if (current !== role) {
    return (
      <Navigate
        to={current ? homePathFor(session) : "/login"}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}