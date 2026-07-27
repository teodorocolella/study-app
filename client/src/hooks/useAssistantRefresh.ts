import { useEffect, useRef } from "react";

// The assistant widget fires this window event after it creates, edits, or
// deletes content, so the page you're on can re-fetch without a manual reload.
export const ASSISTANT_ACTION_EVENT = "assistant-action";

/**
 * Runs `callback` whenever the AI assistant performs an action that may have
 * changed the current page's data. The latest callback is always used, so
 * pages can pass an inline function without re-subscribing every render.
 */
export function useAssistantRefresh(callback: () => void) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener(ASSISTANT_ACTION_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_ACTION_EVENT, handler);
  }, []);
}
