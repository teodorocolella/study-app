import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

/** Password field with a lock icon and a show/hide toggle. */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  minLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type={visible ? "text" : "password"}
        required
        value={value}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 pl-9 pr-10 text-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
