import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // New accounts get the welcome tour before anything else.
  if (!user.hasOnboarded && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}
