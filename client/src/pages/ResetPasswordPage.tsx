import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { PasswordInput } from "../components/auth/PasswordInput";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing its token — open the link from your email again.",
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f8f8] dark:bg-[#0a1418] bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.14),transparent_55%)] px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-300">
            <KeyRound className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h1 className="font-display text-2xl font-semibold text-slate-800 dark:text-slate-100">Choose a new password</h1>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-8 shadow-xl shadow-slate-200/50">
          {done ? (
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Password updated ✅</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                You've been signed out everywhere. Log in with your new password.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                Go to log in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">New password</label>
                <PasswordInput value={password} onChange={setPassword} minLength={8} autoComplete="new-password" />
                <p className="mt-1.5 text-xs text-slate-400">At least 8 characters.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Confirm new password
                </label>
                <PasswordInput value={confirm} onChange={setConfirm} minLength={8} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !token}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-transform hover:scale-[1.01] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link to="/login" className="font-semibold text-violet-600 hover:text-violet-700">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
