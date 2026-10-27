import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Data hooks. The backend is the only data source — screens must render
// `isLoading` / `error` themselves.
//
//   const { data, isLoading, error, refetch } = useEndpoint(
//     "/notifications",
//     (res) => res.notifications,          // optional shape mapper
//     { enabled: Boolean(id) },            // optional query options
//   );
//
// `select` is called with the raw response body and returns what the page
// renders. `error` is a human-readable string (or null).
// ---------------------------------------------------------------------------
export function useEndpoint(path, select, opts = {}) {
  const { enabled = true, staleTime = 15_000, retry = 1 } = opts;

  const query = useQuery({
    queryKey: ["api", path],
    enabled: Boolean(enabled && path),
    retry,
    staleTime,
    queryFn: () => api(path),
  });

  const raw = query.data;
  let data;
  if (raw != null) {
    if (typeof select === "function") {
      try {
        data = select(raw);
      } catch {
        data = undefined;
      }
    } else {
      data = raw;
    }
  }

  return {
    data,
    raw,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? query.error.message || "Request failed" : null,
    refetch: query.refetch,
  };
}

// Write helper for mutations. Never throws — resolve the result and show
// feedback in the page:
//
//   const res = await sendApi("/inventory/restock", body);
//   if (!res.ok) setError(res.error); else { await refresh("/inventory"); }
export async function sendApi(path, body, method = "POST") {
  try {
    const data = await api(path, { method, body });
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err.message || "Request failed",
      status: err.status,
      offline: err.offline === true,
    };
  }
}

// Invalidates cached queries so a screen re-reads fresh data after a write.
// `useApiRefresh()("/inventory")` refreshes that path; no argument refreshes
// every endpoint-backed screen.
export function useApiRefresh() {
  const queryClient = useQueryClient();
  return (path) =>
    path
      ? queryClient.invalidateQueries({ queryKey: ["api", path] })
      : queryClient.invalidateQueries({ queryKey: ["api"] });
}
