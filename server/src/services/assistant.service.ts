import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { escapeHtml, stripHtml } from "../lib/html.js";
import { prisma } from "../prisma.js";
import { client, gradeInstruction, MODEL, NO_MARKDOWN } from "./claude.service.js";
import { getOwnedClassFolder, getOwnedDeck } from "./ownership.service.js";

// Server-sent events pushed to the widget while the assistant works.
export type AssistantEvent =
  | { type: "text"; text: string }
  | { type: "working"; label: string }
  | { type: "action"; label: string; href?: string }
  | { type: "done" }
  | { type: "error"; message: string };

// Shown in the widget the moment Claude starts a tool call — generating the
// tool input (all the card/quiz contents) is the longest silent stretch.
const WORKING_LABELS: Record<string, string> = {
  create_flashcards: "Making your flashcards…",
  create_exercise_set: "Building your quiz…",
  create_note: "Writing your note…",
};

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PageContext {
  path: string;
  classId?: string;
  noteId?: string;
  deckId?: string;
}

// Caps keep the workspace snapshot inside a predictable token budget.
const NOTE_CHAR_LIMIT = 2500;
const CARDS_PER_DECK_LIMIT = 40;
const CARD_SIDE_CHAR_LIMIT = 120;
const TOTAL_CONTEXT_CHAR_LIMIT = 40000;
const MAX_TOOL_ROUNDS = 4;

function clip(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * Snapshot of everything the student has — every class, note, deck, card,
 * and what's due — so the assistant always answers from current data.
 */
export async function buildWorkspaceContext(userId: string): Promise<string> {
  const now = new Date();
  const classes = await prisma.classFolder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      notes: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, contentHtml: true, updatedAt: true },
      },
      decks: {
        orderBy: { createdAt: "asc" },
        include: {
          cards: {
            orderBy: { createdAt: "asc" },
            select: { id: true, front: true, back: true, progress: { where: { userId } } },
          },
        },
      },
      exerciseSets: {
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { exercises: true } },
          attempts: {
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { score: true, total: true },
          },
        },
      },
    },
  });

  if (classes.length === 0) {
    return "The student has no classes yet. Suggest creating a class from the dashboard to get started.";
  }

  const lines: string[] = [];
  let budget = TOTAL_CONTEXT_CHAR_LIMIT;
  const push = (line: string) => {
    if (budget <= 0) return;
    lines.push(line);
    budget -= line.length + 1;
  };

  for (const cf of classes) {
    push(`CLASS: ${cf.name} (classId: ${cf.id})`);

    if (cf.notes.length === 0) {
      push("  Notes: none yet");
    }
    for (const note of cf.notes) {
      push(`  NOTE: "${note.title}" (noteId: ${note.id}, updated ${note.updatedAt.toISOString().slice(0, 10)})`);
      const text = stripHtml(note.contentHtml);
      if (text) {
        push(`    ${clip(text, NOTE_CHAR_LIMIT).replace(/\n/g, "\n    ")}`);
      } else {
        push("    (empty note)");
      }
    }

    if (cf.decks.length === 0) {
      push("  Decks: none yet");
    }
    for (const deck of cf.decks) {
      const dueCount = deck.cards.filter((card) => {
        const progress = card.progress[0];
        return !progress || progress.dueDate <= now;
      }).length;
      push(`  DECK: "${deck.name}" (deckId: ${deck.id}, ${deck.cards.length} cards, ${dueCount} due for review)`);
      for (const card of deck.cards.slice(0, CARDS_PER_DECK_LIMIT)) {
        push(`    * ${clip(card.front, CARD_SIDE_CHAR_LIMIT)} -> ${clip(card.back, CARD_SIDE_CHAR_LIMIT)}`);
      }
      if (deck.cards.length > CARDS_PER_DECK_LIMIT) {
        push(`    (…and ${deck.cards.length - CARDS_PER_DECK_LIMIT} more cards)`);
      }
    }

    for (const set of cf.exerciseSets) {
      const last = set.attempts[0];
      const lastText = last ? `, last score ${last.score}/${last.total}` : ", not attempted yet";
      push(`  PRACTICE SET: "${set.name}" (setId: ${set.id}, ${set._count.exercises} exercises${lastText})`);
    }
  }

  return lines.join("\n");
}

/** Describes what page the student is looking at right now, if resolvable. */
export async function buildPageContext(userId: string, page?: PageContext): Promise<string> {
  if (!page) return "";
  try {
    if (page.noteId) {
      const note = await prisma.note.findUnique({
        where: { id: page.noteId },
        include: { classFolder: true },
      });
      if (note && note.classFolder.userId === userId) {
        return `The student is currently editing the note "${note.title}" in the class "${note.classFolder.name}".`;
      }
    }
    if (page.deckId) {
      const deck = await prisma.deck.findUnique({
        where: { id: page.deckId },
        include: { classFolder: true },
      });
      if (deck && deck.classFolder.userId === userId) {
        const studying = page.path.endsWith("/study");
        return `The student is currently ${studying ? "in a study session with" : "viewing"} the deck "${deck.name}" in the class "${deck.classFolder.name}".`;
      }
    }
    if (page.classId) {
      const cf = await prisma.classFolder.findUnique({ where: { id: page.classId } });
      if (cf && cf.userId === userId) {
        return `The student is currently viewing the class "${cf.name}".`;
      }
    }
  } catch {
    // Page context is best-effort — never fail the request over it.
  }
  if (page.path === "/study") return "The student is currently in a study session reviewing all due cards.";
  if (page.path === "/dashboard") return "The student is currently on their dashboard.";
  return "";
}

const assistantTools: Anthropic.Tool[] = [
  {
    name: "create_flashcards",
    description:
      "Create flashcards for the student. Call this when the student asks you to make, generate, or add flashcards. Add them to an existing deck by passing deckId (use the deckId values from the workspace snapshot), or create a new deck by passing classId plus newDeckName. Keep fronts short (a question or term) and backs concise (the answer or definition).",
    input_schema: {
      type: "object",
      properties: {
        deckId: {
          type: "string",
          description: "ID of an existing deck to add the cards to.",
        },
        classId: {
          type: "string",
          description: "ID of the class to create a new deck in. Required with newDeckName.",
        },
        newDeckName: {
          type: "string",
          description: "Name for a new deck, when no existing deck fits.",
        },
        cards: {
          type: "array",
          description: "The flashcards to create.",
          items: {
            type: "object",
            properties: {
              front: { type: "string" },
              back: { type: "string" },
            },
            required: ["front", "back"],
          },
        },
      },
      required: ["cards"],
    },
  },
  {
    name: "create_exercise_set",
    description:
      'Create a practice quiz (exercise set) for the student. Call this when they ask for practice questions, a quiz, or exercises. You write the exercises yourself from their notes. Types: "mcq" (question + exactly 4 options, answer copied exactly from options, vary the correct position), "true_false" (a statement; answer "true" or "false"; mix both), "fill_blank" (sentence with the key term replaced by "_____"; answer is the missing 1-3 words), "short_answer" (asks the student to explain in their own words; answer is a model answer listing what a good response includes). Give every exercise a brief explanation of the correct answer. Mix types unless the student asks for specific ones.',
    input_schema: {
      type: "object",
      properties: {
        classId: { type: "string", description: "ID of the class this practice set belongs to." },
        name: { type: "string", description: "Short name for the practice set." },
        exercises: {
          type: "array",
          description: "The exercises to create.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["mcq", "true_false", "fill_blank", "short_answer"] },
              prompt: { type: "string" },
              options: {
                type: "array",
                items: { type: "string" },
                description: "mcq only: exactly 4 answer choices.",
              },
              answer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["type", "prompt", "answer"],
          },
        },
      },
      required: ["classId", "name", "exercises"],
    },
  },
  {
    name: "create_note",
    description:
      "Create a new note in one of the student's classes. Call this when the student asks you to write up, save, or turn something into a note (for example a study guide or a summary). Write the content as plain text with blank lines between paragraphs.",
    input_schema: {
      type: "object",
      properties: {
        classId: { type: "string", description: "ID of the class the note belongs to." },
        title: { type: "string", description: "Short title for the note." },
        content: { type: "string", description: "Plain-text body. Separate paragraphs with blank lines." },
      },
      required: ["classId", "title", "content"],
    },
  },
];

const createFlashcardsInput = z.object({
  deckId: z.string().optional(),
  classId: z.string().optional(),
  newDeckName: z.string().min(1).max(120).optional(),
  cards: z
    .array(z.object({ front: z.string().min(1).max(2000), back: z.string().min(1).max(2000) }))
    .min(1)
    .max(30),
});

const createNoteInput = z.object({
  classId: z.string(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

const createExerciseSetInput = z.object({
  classId: z.string(),
  name: z.string().min(1).max(120),
  exercises: z
    .array(
      z.object({
        type: z.enum(["mcq", "true_false", "fill_blank", "short_answer"]),
        prompt: z.string().min(1).max(2000),
        options: z.array(z.string().min(1).max(500)).min(2).max(6).optional(),
        answer: z.string().min(1).max(4000),
        explanation: z.string().max(4000).optional(),
      }),
    )
    .min(1)
    .max(25),
});

function plainTextToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

interface ToolOutcome {
  result: string;
  isError?: boolean;
}

async function executeAssistantTool(
  userId: string,
  toolName: string,
  toolInput: unknown,
  send: (event: AssistantEvent) => void,
): Promise<ToolOutcome> {
  if (toolName === "create_flashcards") {
    const parsed = createFlashcardsInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { deckId, classId, newDeckName, cards } = parsed.data;

    let deck;
    if (deckId) {
      deck = await getOwnedDeck(userId, deckId).catch(() => null);
      if (!deck) return { result: `No deck with id ${deckId} exists for this student.`, isError: true };
    } else if (classId && newDeckName) {
      const cf = await getOwnedClassFolder(userId, classId).catch(() => null);
      if (!cf) return { result: `No class with id ${classId} exists for this student.`, isError: true };
      deck = await prisma.deck.create({ data: { name: newDeckName, classFolderId: cf.id } });
    } else {
      return { result: "Pass either deckId, or classId together with newDeckName.", isError: true };
    }

    await prisma.flashcard.createMany({
      data: cards.map((c) => ({ front: c.front, back: c.back, deckId: deck.id })),
    });

    send({
      type: "action",
      label: `Added ${cards.length} card${cards.length === 1 ? "" : "s"} to "${deck.name}"`,
      href: `/decks/${deck.id}`,
    });
    return {
      result: `Created ${cards.length} flashcards in the deck "${deck.name}". The student can see them at any time — confirm briefly, don't list every card back.`,
    };
  }

  if (toolName === "create_exercise_set") {
    const parsed = createExerciseSetInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { classId, name, exercises } = parsed.data;
    const cf = await getOwnedClassFolder(userId, classId).catch(() => null);
    if (!cf) return { result: `No class with id ${classId} exists for this student.`, isError: true };

    const invalidMcq = exercises.find(
      (e) => e.type === "mcq" && (!e.options || !e.options.includes(e.answer)),
    );
    if (invalidMcq) {
      return {
        result: "Every mcq exercise needs an options array that contains the answer exactly. Fix and retry.",
        isError: true,
      };
    }

    const set = await prisma.exerciseSet.create({
      data: {
        name,
        classFolderId: cf.id,
        exercises: {
          create: exercises.map((e, i) => ({
            type: e.type,
            prompt: e.prompt,
            optionsJson: e.type === "mcq" && e.options ? JSON.stringify(e.options) : null,
            answer: e.type === "true_false" ? e.answer.toLowerCase() : e.answer,
            explanation: e.explanation ?? null,
            position: i,
          })),
        },
      },
    });

    send({
      type: "action",
      label: `Created practice set "${name}" (${exercises.length} questions)`,
      href: `/practice/${set.id}`,
    });
    return {
      result: `Created the practice set "${name}" with ${exercises.length} exercises in "${cf.name}". Confirm briefly and encourage them to try it.`,
    };
  }

  if (toolName === "create_note") {
    const parsed = createNoteInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { classId, title, content } = parsed.data;
    const cf = await getOwnedClassFolder(userId, classId).catch(() => null);
    if (!cf) return { result: `No class with id ${classId} exists for this student.`, isError: true };

    const note = await prisma.note.create({
      data: { title, contentHtml: plainTextToHtml(content), classFolderId: cf.id },
    });

    send({
      type: "action",
      label: `Created note "${title}" in ${cf.name}`,
      href: `/classes/${cf.id}/notes/${note.id}`,
    });
    return { result: `Created the note "${title}" in the class "${cf.name}". Confirm briefly.` };
  }

  return { result: `Unknown tool: ${toolName}`, isError: true };
}

function buildSystemPrompt(workspaceContext: string, pageContext: string, gradeLevel?: number | null) {
  return [
    "You are the always-available AI study assistant inside Study Hub, a study app used by middle school and high school students. You are a patient, encouraging tutor. You are powered by Claude, Anthropic's AI model — if a student asks what you are, tell them that.",
    gradeInstruction(gradeLevel) ? `\n${gradeInstruction(gradeLevel)}` : "",
    "",
    "Below is a live snapshot of the student's entire workspace — every class, note, and flashcard deck, including which cards are due for spaced-repetition review. Treat it as the source of truth about what they are studying.",
    "",
    "=== WORKSPACE SNAPSHOT ===",
    workspaceContext,
    "=== END SNAPSHOT ===",
    "",
    pageContext,
    "",
    "How to help:",
    "- Answer questions using their notes when relevant; if their notes are wrong or incomplete, gently point it out.",
    "- When asked what to study, look at the due counts and recommend the classes and decks with the most cards due.",
    "- When asked for a study plan (especially with a test date, e.g. 'I have a bio test Friday'), build a concrete day-by-day plan using their actual notes, decks, and quizzes for that class: what to review each day, when to take practice quizzes, and how to use spaced repetition in the run-up. Be specific and realistic about time.",
    "- When asked to quiz them, ask one question at a time from their notes or cards, wait for their answer, then give feedback before the next question.",
    "- Use the create_flashcards tool when they ask for flashcards, the create_exercise_set tool when they ask for a quiz or practice questions, and the create_note tool when they ask you to save a study guide or summary as a note.",
    "- When the student asks you to make something, call the tool IMMEDIATELY as your very first output — no text before it. Do not say 'Sure!', 'I'd be happy to', or announce what you're about to do; every word before the tool call just makes the student wait longer. Only after the tool result comes back, confirm what you made in one short sentence.",
    "- Never open a reply with filler agreement or flattery ('Great question!', 'Absolutely!'). Start with the substance.",
    "- Keep answers focused — a short paragraph or two, not an essay. Adapt to what the student seems to already know.",
    NO_MARKDOWN,
  ].join("\n");
}

/**
 * Runs the assistant loop: stream a reply, execute any tool calls, feed the
 * results back, and repeat until Claude finishes its turn.
 */
export async function runAssistant(
  userId: string,
  history: ChatTurn[],
  userMessage: string,
  page: PageContext | undefined,
  send: (event: AssistantEvent) => void,
): Promise<void> {
  const [workspaceContext, pageContext, gradeUser] = await Promise.all([
    buildWorkspaceContext(userId),
    buildPageContext(userId, page),
    prisma.user.findUnique({ where: { id: userId }, select: { gradeLevel: true } }),
  ]);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: userMessage },
  ];

  // Cached: the system prompt (which embeds the whole workspace snapshot) and
  // tool definitions are identical across every round of the tool-use loop
  // below, and often across the next user message too. Marking them as cache
  // breakpoints means only the first round pays full price — a big latency
  // win since the snapshot alone can be tens of thousands of characters.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: buildSystemPrompt(workspaceContext, pageContext, gradeUser?.gradeLevel),
      cache_control: { type: "ephemeral" },
    },
  ];
  const tools: Anthropic.Tool[] = assistantTools.map((tool, i, arr) =>
    i === arr.length - 1 ? { ...tool, cache_control: { type: "ephemeral" } } : tool,
  );

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: "disabled" },
      system,
      tools,
      messages,
    });

    stream.on("text", (text) => send({ type: "text", text }));
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        send({ type: "working", label: WORKING_LABELS[event.content_block.name] ?? "Working on it…" });
      }
    });
    const finalMessage = await stream.finalMessage();
    messages.push({ role: "assistant", content: finalMessage.content });

    if (finalMessage.stop_reason !== "tool_use") break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of finalMessage.content) {
      if (block.type !== "tool_use") continue;
      const outcome = await executeAssistantTool(userId, block.name, block.input, send);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: outcome.result,
        ...(outcome.isError ? { is_error: true } : {}),
      });
    }
    if (toolResults.length === 0) break;
    messages.push({ role: "user", content: toolResults });
  }

  send({ type: "done" });
}
