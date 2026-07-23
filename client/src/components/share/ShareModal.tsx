import { Check, Loader2, Send, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";

interface ShareModalProps {
  attachment: { type: "note" | "deck"; id: string };
  /** What's being shared, shown in the header — e.g. a deck or note title. */
  label: string;
  onClose: () => void;
}

export function ShareModal({ attachment, label, onClose }: ShareModalProps) {
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/messages", {
        recipientEmail: email.trim(),
        body: body.trim() || undefined,
        attachment,
      });
      setSent(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-display font-semibold text-slate-800">
              Share {attachment.type === "deck" ? "deck" : "note"}
            </p>
            <p className="text-sm text-slate-500">
              Send "{label}" to a classmate. They'll get their own copy to keep.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {sent ? (
          <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" />
            Sent!
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              autoFocus
              placeholder="Classmate's Study Hub email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <textarea
              placeholder="Add a message (optional)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
