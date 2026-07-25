import katex from "katex";
import { useMemo } from "react";

// Renders text that may contain LaTeX in $…$ (inline) or $$…$$ (display) delimiters.
// Everything outside the delimiters is plain text (line breaks preserved).

interface Segment {
  type: "text" | "inline" | "display";
  value: string;
}

function tokenize(input: string): Segment[] {
  const segments: Segment[] = [];
  // $$…$$ first, then $…$ — non-greedy, no newlines inside inline math.
  const regex = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", value: input.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "display", value: match[1] });
    } else {
      segments.push({ type: "inline", value: match[2] });
    }
    last = regex.lastIndex;
  }
  if (last < input.length) {
    segments.push({ type: "text", value: input.slice(last) });
  }
  return segments;
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false });
  } catch {
    return tex;
  }
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => tokenize(text), [text]);

  const hasMath = segments.some((s) => s.type !== "text");
  if (!hasMath) {
    return <span className={`whitespace-pre-wrap ${className ?? ""}`}>{text}</span>;
  }

  return (
    <span className={`whitespace-pre-wrap ${className ?? ""}`}>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.value}</span>;
        return (
          <span
            key={i}
            // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, seg.type === "display") }}
          />
        );
      })}
    </span>
  );
}
