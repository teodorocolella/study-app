import { KeyRound, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
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
          <h1 className="font-display text-2xl font-semibold text-slate-800 dark:text-slate-100">Forgot your password?</h1>
          <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-800 p-8 shadow-xl shadow-slate-200/50">
          {sent ? (
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Check your inbox 📬</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way. It
                expires in 1 hour — check spam if you don't see it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-transform hover:scale-[1.01] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
              >
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-violet-600 hover:text-violet-700">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
