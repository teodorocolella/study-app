import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env.js";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

const NO_MARKDOWN =
  "Write in plain prose only — do not use markdown formatting of any kind (no **bold**, no # headers, no bullet-point dashes or asterisks, no backticks). If you want to separate distinct points, put each on its own line as a plain sentence instead of a markdown list.";

const flashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});

export async function generateFlashcardsFromNotes(noteText: string, count = 10) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "disabled" },
    system: `You turn study notes into flashcards. Generate exactly ${count} flashcards from the student's notes below. Each flashcard should test one discrete fact or concept — keep the front short (a question or term) and the back concise (the answer or definition). ${NO_MARKDOWN}`,
    messages: [{ role: "user", content: noteText }],
    output_config: { format: zodOutputFormat(flashcardsSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable flashcard data");
  }
  return response.parsed_output.cards;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function tutorChatReply(
  className: string,
  classContext: string,
  history: ChatTurn[],
  userMessage: string,
) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system: `You are a patient, encouraging tutor helping a student with their class "${className}". Use the following class notes as your source of truth when relevant:\n\n${classContext || "(no notes yet for this class)"}\n\nExplain concepts clearly and adapt to what the student seems to already know. Keep answers focused — a paragraph or two, not an essay. ${NO_MARKDOWN}`,
    messages: [...history, { role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}

export async function summarizeNote(noteText: string) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system: `Summarize the given study notes into a short, skimmable digest capturing the key facts and ideas a student should remember. Put each key point on its own line. ${NO_MARKDOWN}`,
    messages: [{ role: "user", content: noteText }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}

export async function explainDifferently(front: string, back: string, priorExplanation?: string) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    thinking: { type: "disabled" },
    system: `A student didn't understand this flashcard. Explain the underlying concept a different way — use a different analogy or framing than whatever was tried before. ${NO_MARKDOWN}`,
    messages: [
      {
        role: "user",
        content: [
          `Flashcard front: ${front}`,
          `Flashcard back: ${back}`,
          priorExplanation ? `Previous explanation that didn't help: ${priorExplanation}` : null,
          "Give a fresh explanation.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
