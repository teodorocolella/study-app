import type { Response } from "express";

const HEARTBEAT_MS = 20_000;

/**
 * Opens a server-sent-events response and returns a `send` function plus a
 * `close` cleanup. Sends a periodic comment heartbeat so proxies (Render,
 * browsers) don't time out an idle connection.
 */
export function openSse(res: Response): { send: (data: unknown) => void; close: () => void } {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(":ok\n\n");

  const heartbeat = setInterval(() => {
    res.write(":hb\n\n");
  }, HEARTBEAT_MS);

  return {
    send: (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close: () => {
      clearInterval(heartbeat);
      res.end();
    },
  };
}
