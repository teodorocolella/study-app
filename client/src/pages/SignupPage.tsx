import { GraduationCap, Lock, Mail, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../hooks/useAuth";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f5fb] bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.14),transparent_55%)] px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-300">
            <GraduationCap className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h1 className="font-display text-2xl font-semibold text-slate-800">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Start studying smarter today.</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">At least 8 characters.</p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 transition-transform hover:scale-[1.01] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
            >
              {submitting ? "Creating account…" : "Sign up"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-violet-600 hover:text-violet-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
