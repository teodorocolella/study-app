import {
  ArrowUpRight,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";

interface AssistantAction {
  label: string;
  href?: string;
}

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
}

type AssistantEvent =
  | { type: "text"; text: string }
  | { type: "action"; label: string; href?: string }
  | { type: "done" }
  | { type: "error"; message: string };

const MESSAGES_KEY = "assistant.messages";
const OPEN_KEY = "assistant.open";

const QUICK_PROMPTS = [
  "What should I study today?",
  "Quiz me on one of my classes",
  "Make flashcards from my notes",
];

function loadMessages(): AssistantMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as AssistantMessage[]) : [];
  } catch {
    return [];
  }
}

/** Extracts ids from the current route so the assistant knows where the student is. */
function getPageContext(pathname: string) {
  let match = pathname.match(/^\/classes\/([^/]+)\/notes\/([^/]+)/);
  if (match) return { path: pathname, classId: match[1], noteId: match[2] };
  match = pathname.match(/^\/classes\/([^/]+)/);
  if (match) return { path: pathname, classId: match[1] };
  match = pathname.match(/^\/decks\/([^/]+)/);
  if (match) return { path: pathname, deckId: match[1] };
  return { path: pathname };
}

export function AssistantWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(() => sessionStorage.getItem(OPEN_KEY) === "1");
  const [messages, setMessages] = useState<AssistantMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("open-assistant", onOpenRequest);
    return () => window.removeEventListener("open-assistant", onOpenRequest);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-40)));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages
      .filter((m) => m.content.trim().length > 0)
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setSending(true);
    setError(null);

    const appendToReply = (updater: (last: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = updater(last);
        return next;
      });
    };

    try {
      await api.stream(
        "/ai/assistant",
        { message, history, page: getPageContext(location.pathname) },
        (raw) => {
          const event = raw as AssistantEvent;
          if (event.type === "text") {
            appendToReply((last) => ({ ...last, content: last.content + event.text }));
          } else if (event.type === "action") {
            appendToReply((last) => ({
              ...last,
              actions: [...(last.actions ?? []), { label: event.label, href: event.href }],
            }));
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reach the assistant");
    } finally {
      setSending(false);
      // Drop an empty reply bubble if the request failed before any text arrived.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content && !last.actions?.length) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function handleClear() {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem(MESSAGES_KEY);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-300 transition-transform hover:scale-105"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[min(620px,calc(100dvh-5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl shadow-slate-300/60">
      <div className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4" />
            AI assistant
          </p>
          <p className="text-[11px] font-medium text-violet-200">Powered by Claude</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              aria-label="Clear conversation"
              title="Clear conversation"
              className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hi! I'm your study assistant, powered by Claude. I can see all your classes,
              notes, and flashcards — ask me anything, have me quiz you, or let me make
              flashcards for you.
            </p>
            <div className="flex flex-col items-start gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-sm text-violet-700 transition-colors hover:bg-violet-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            {(m.content || m.role === "user") && (
              <span
                className={`inline-block max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-sm ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                }`}
              >
                {m.content}
              </span>
            )}
            {m.actions?.map((action, j) =>
              action.href ? (
                <Link
                  key={j}
                  to={action.href}
                  className="mt-1.5 flex w-fit items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  {action.label}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span
                  key={j}
                  className="mt-1.5 flex w-fit items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
                >
                  {action.label}
                </span>
              ),
            )}
          </div>
        ))}

        {sending && messages[messages.length - 1]?.content === "" && (
          <div className="text-left">
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 dark:bg-slate-700 px-3.5 py-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </span>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 dark:border-slate-700 p-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about anything you're studying…"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="flex items-center rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
