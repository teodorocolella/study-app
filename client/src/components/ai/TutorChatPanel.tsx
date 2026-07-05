import { Loader2, MessageCircleQuestion, Send, Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function TutorChatPanel({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const { reply } = await api.post<{ reply: string }>("/ai/tutor-chat", {
        classId,
        message,
        history,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reach the tutor");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-sm transition-transform hover:scale-[1.01] hover:shadow-md"
      >
        <MessageCircleQuestion className="h-4 w-4" />
        Ask the tutor
      </button>
    );
  }

  return (
    <div className="animate-flip-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4" />
          AI tutor
        </p>
        <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400">Ask a question about this class's notes.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {sending && (
          <div className="text-left">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-3.5 py-2 text-sm text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </span>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="submit"
          disabled={sending}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
