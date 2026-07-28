import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { escapeHtml, stripHtml } from "../lib/html.js";
import { prisma } from "../prisma.js";
import { client, gradeInstruction, MODEL, NO_MARKDOWN } from "./claude.service.js";
import {
  getOwnedClassFolder,
  getOwnedDeck,
  getOwnedExerciseSet,
  getOwnedNote,
} from "./ownership.service.js";

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
  read_note: "Reading your note…",
  update_note: "Updating your note…",
  update_flashcards: "Updating your flashcards…",
  read_exercise_set: "Reading your quiz…",
  update_exercises: "Updating your quiz…",
  add_exercises: "Adding questions…",
  create_class: "Creating your class…",
  delete_note: "Deleting the note…",
  delete_deck: "Deleting the deck…",
  delete_exercise_set: "Deleting the quiz…",
  delete_class: "Deleting the class…",
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
        push(`    * [cardId: ${card.id}] ${clip(card.front, CARD_SIDE_CHAR_LIMIT)} -> ${clip(card.back, CARD_SIDE_CHAR_LIMIT)}`);
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
  {
    name: "read_note",
    description:
      "Read the FULL current content of one of the student's notes. Call this before update_note whenever the workspace snapshot shows the note clipped (ends with …) — otherwise you'd rewrite the note from an incomplete view and lose the rest.",
    input_schema: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "ID of the note to read." },
      },
      required: ["noteId"],
    },
  },
  {
    name: "update_note",
    description:
      "Edit an existing note — fix mistakes, rewrite, reorganize, add or remove material, or rename it. content REPLACES the whole note body, so always include everything that should remain, not just the changed part. If the snapshot shows the note clipped (…), call read_note first.",
    input_schema: {
      type: "object",
      properties: {
        noteId: { type: "string", description: "ID of the note to edit." },
        title: { type: "string", description: "New title (omit to keep the current one)." },
        content: {
          type: "string",
          description: "Full replacement body as plain text, blank lines between paragraphs (omit to keep the current content).",
        },
      },
      required: ["noteId"],
    },
  },
  {
    name: "update_flashcards",
    description:
      "Edit or delete existing flashcards in a deck, and/or rename the deck. Use the cardId values shown in the workspace snapshot. For each edit, only the fields you pass change.",
    input_schema: {
      type: "object",
      properties: {
        deckId: { type: "string", description: "ID of the deck the cards belong to." },
        renameTo: { type: "string", description: "New name for the deck (omit to keep it)." },
        edits: {
          type: "array",
          description: "Cards to change.",
          items: {
            type: "object",
            properties: {
              cardId: { type: "string" },
              front: { type: "string", description: "New front text (omit to keep)." },
              back: { type: "string", description: "New back text (omit to keep)." },
            },
            required: ["cardId"],
          },
        },
        deleteCardIds: {
          type: "array",
          items: { type: "string" },
          description: "Cards to delete entirely.",
        },
      },
      required: ["deckId"],
    },
  },
  {
    name: "read_exercise_set",
    description:
      "Read the full questions of one of the student's practice quizzes (the workspace snapshot only shows quiz names, not their questions). ALWAYS call this before update_exercises so you can see the exerciseId values and current content.",
    input_schema: {
      type: "object",
      properties: {
        setId: { type: "string", description: "ID of the practice set to read." },
      },
      required: ["setId"],
    },
  },
  {
    name: "update_exercises",
    description:
      "Edit or delete questions in an existing practice quiz, and/or rename it. Call read_exercise_set first to get exerciseId values and current content. For each edit, only the fields you pass change; for mcq questions the final answer must exactly match one of the final options.",
    input_schema: {
      type: "object",
      properties: {
        setId: { type: "string", description: "ID of the practice set." },
        renameTo: { type: "string", description: "New name for the quiz (omit to keep it)." },
        edits: {
          type: "array",
          description: "Questions to change.",
          items: {
            type: "object",
            properties: {
              exerciseId: { type: "string" },
              prompt: { type: "string" },
              options: { type: "array", items: { type: "string" }, description: "mcq only: full replacement options." },
              answer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["exerciseId"],
          },
        },
        deleteExerciseIds: {
          type: "array",
          items: { type: "string" },
          description: "Questions to delete entirely.",
        },
      },
      required: ["setId"],
    },
  },
  {
    name: "add_exercises",
    description:
      "Add new questions to an EXISTING practice quiz (use the setId from the snapshot). Same question rules as create_exercise_set (mcq needs 4 options with the answer copied exactly; true_false answer is 'true'/'false'; fill_blank uses '_____'; short_answer has a model answer). Use this instead of create_exercise_set when the student wants more questions on a quiz they already have.",
    input_schema: {
      type: "object",
      properties: {
        setId: { type: "string", description: "ID of the existing quiz to add questions to." },
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["mcq", "true_false", "fill_blank", "short_answer"] },
              prompt: { type: "string" },
              options: { type: "array", items: { type: "string" }, description: "mcq only: exactly 4 choices." },
              answer: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["type", "prompt", "answer"],
          },
        },
      },
      required: ["setId", "exercises"],
    },
  },
  {
    name: "create_class",
    description:
      "Create a new class folder. Use this when the student wants to start a new subject/class, then put notes, decks, or quizzes inside it with the other tools.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Class name, e.g. 'Biology' or 'Algebra II'." },
        colorTag: {
          type: "string",
          description: "Optional color: one of violet, sky, emerald, amber, rose, slate, or a #hex.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_note",
    description:
      "Permanently delete a whole note. Only do this when the student clearly asks to delete that specific note. There is no undo.",
    input_schema: {
      type: "object",
      properties: { noteId: { type: "string" } },
      required: ["noteId"],
    },
  },
  {
    name: "delete_deck",
    description:
      "Permanently delete a whole flashcard deck and all of its cards. Only do this when the student clearly asks to delete that specific deck. There is no undo. (To remove individual cards, use update_flashcards instead.)",
    input_schema: {
      type: "object",
      properties: { deckId: { type: "string" } },
      required: ["deckId"],
    },
  },
  {
    name: "delete_exercise_set",
    description:
      "Permanently delete a whole practice quiz and all of its questions. Only do this when the student clearly asks to delete that specific quiz. There is no undo. (To remove individual questions, use update_exercises instead.)",
    input_schema: {
      type: "object",
      properties: { setId: { type: "string" } },
      required: ["setId"],
    },
  },
  {
    name: "delete_class",
    description:
      "Permanently delete a whole class AND everything inside it — every note, deck, and quiz in that class. This is very destructive with no undo, so only do it when the student unambiguously asks to delete that entire class by name.",
    input_schema: {
      type: "object",
      properties: { classId: { type: "string" } },
      required: ["classId"],
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

const readNoteInput = z.object({ noteId: z.string() });

const updateNoteInput = z
  .object({
    noteId: z.string(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(40000).optional(),
  })
  .refine((d) => d.title !== undefined || d.content !== undefined, {
    message: "Pass a new title, new content, or both",
  });

const updateFlashcardsInput = z
  .object({
    deckId: z.string(),
    renameTo: z.string().min(1).max(120).optional(),
    edits: z
      .array(
        z
          .object({
            cardId: z.string(),
            front: z.string().min(1).max(2000).optional(),
            back: z.string().min(1).max(2000).optional(),
          })
          .refine((e) => e.front !== undefined || e.back !== undefined, {
            message: "Each edit needs a new front, back, or both",
          }),
      )
      .max(40)
      .optional(),
    deleteCardIds: z.array(z.string()).max(40).optional(),
  })
  .refine((d) => d.renameTo !== undefined || d.edits?.length || d.deleteCardIds?.length, {
    message: "Pass renameTo, edits, or deleteCardIds",
  });

const readExerciseSetInput = z.object({ setId: z.string() });

const addExercisesInput = z.object({
  setId: z.string(),
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

const createClassInput = z.object({
  name: z.string().min(1).max(80),
  colorTag: z.string().max(40).optional(),
});

const deleteNoteInput = z.object({ noteId: z.string() });
const deleteDeckInput = z.object({ deckId: z.string() });
const deleteSetInput = z.object({ setId: z.string() });
const deleteClassInput = z.object({ classId: z.string() });

const updateExercisesInput = z
  .object({
    setId: z.string(),
    renameTo: z.string().min(1).max(120).optional(),
    edits: z
      .array(
        z.object({
          exerciseId: z.string(),
          prompt: z.string().min(1).max(2000).optional(),
          options: z.array(z.string().min(1).max(500)).min(2).max(6).optional(),
          answer: z.string().min(1).max(4000).optional(),
          explanation: z.string().max(4000).optional(),
        }),
      )
      .max(25)
      .optional(),
    deleteExerciseIds: z.array(z.string()).max(25).optional(),
  })
  .refine((d) => d.renameTo !== undefined || d.edits?.length || d.deleteExerciseIds?.length, {
    message: "Pass renameTo, edits, or deleteExerciseIds",
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

  if (toolName === "read_note") {
    const parsed = readNoteInput.safeParse(toolInput);
    if (!parsed.success) return { result: "Invalid input: pass a noteId.", isError: true };
    const note = await getOwnedNote(userId, parsed.data.noteId).catch(() => null);
    if (!note) return { result: `No note with id ${parsed.data.noteId} exists for this student.`, isError: true };
    return { result: `Title: ${note.title}\n\n${stripHtml(note.contentHtml) || "(empty note)"}` };
  }

  if (toolName === "update_note") {
    const parsed = updateNoteInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { noteId, title, content } = parsed.data;
    const note = await getOwnedNote(userId, noteId).catch(() => null);
    if (!note) return { result: `No note with id ${noteId} exists for this student.`, isError: true };

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        // Replacing the content invalidates any AI summary of the old version.
        ...(content !== undefined ? { contentHtml: plainTextToHtml(content), aiSummary: null } : {}),
      },
    });

    send({
      type: "action",
      label: `Updated note "${updated.title}"`,
      href: `/classes/${note.classFolderId}/notes/${note.id}`,
    });
    return { result: `Updated the note "${updated.title}". Confirm briefly what you changed.` };
  }

  if (toolName === "update_flashcards") {
    const parsed = updateFlashcardsInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { deckId, renameTo, edits = [], deleteCardIds = [] } = parsed.data;
    const deck = await getOwnedDeck(userId, deckId).catch(() => null);
    if (!deck) return { result: `No deck with id ${deckId} exists for this student.`, isError: true };

    // Every referenced card must belong to this deck.
    const referencedIds = [...new Set([...edits.map((e) => e.cardId), ...deleteCardIds])];
    const owned = await prisma.flashcard.findMany({
      where: { id: { in: referencedIds }, deckId: deck.id },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((c) => c.id));
    const missing = referencedIds.filter((id) => !ownedIds.has(id));
    if (missing.length > 0) {
      return { result: `These cardIds are not in that deck: ${missing.join(", ")}. Use the cardId values from the snapshot.`, isError: true };
    }

    await prisma.$transaction([
      ...(renameTo !== undefined
        ? [prisma.deck.update({ where: { id: deck.id }, data: { name: renameTo } })]
        : []),
      ...edits.map((e) =>
        prisma.flashcard.update({
          where: { id: e.cardId },
          data: {
            ...(e.front !== undefined ? { front: e.front } : {}),
            ...(e.back !== undefined ? { back: e.back } : {}),
          },
        }),
      ),
      ...(deleteCardIds.length > 0
        ? [prisma.flashcard.deleteMany({ where: { id: { in: deleteCardIds } } })]
        : []),
    ]);

    const parts = [
      edits.length && `updated ${edits.length} card${edits.length === 1 ? "" : "s"}`,
      deleteCardIds.length && `deleted ${deleteCardIds.length}`,
      renameTo !== undefined && "renamed the deck",
    ].filter(Boolean);
    send({
      type: "action",
      label: `${parts.join(", ")} in "${renameTo ?? deck.name}"`.replace(/^./, (c) => c.toUpperCase()),
      href: `/decks/${deck.id}`,
    });
    return { result: `Done: ${parts.join(", ")} in the deck "${renameTo ?? deck.name}". Confirm briefly.` };
  }

  if (toolName === "read_exercise_set") {
    const parsed = readExerciseSetInput.safeParse(toolInput);
    if (!parsed.success) return { result: "Invalid input: pass a setId.", isError: true };
    const set = await getOwnedExerciseSet(userId, parsed.data.setId).catch(() => null);
    if (!set) return { result: `No practice set with id ${parsed.data.setId} exists for this student.`, isError: true };

    const exercises = await prisma.exercise.findMany({
      where: { setId: set.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    const lines = exercises.map((e, i) => {
      const options = e.optionsJson ? ` | options: ${JSON.parse(e.optionsJson).join(" / ")}` : "";
      const explanation = e.explanation ? ` | explanation: ${e.explanation}` : "";
      return `${i + 1}. [exerciseId: ${e.id}] (${e.type}) ${e.prompt}${options} | answer: ${e.answer}${explanation}`;
    });
    return { result: `Quiz "${set.name}" (${exercises.length} questions):\n${lines.join("\n")}` };
  }

  if (toolName === "update_exercises") {
    const parsed = updateExercisesInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { setId, renameTo, edits = [], deleteExerciseIds = [] } = parsed.data;
    const set = await getOwnedExerciseSet(userId, setId).catch(() => null);
    if (!set) return { result: `No practice set with id ${setId} exists for this student.`, isError: true };

    const referencedIds = [...new Set([...edits.map((e) => e.exerciseId), ...deleteExerciseIds])];
    const owned = await prisma.exercise.findMany({
      where: { id: { in: referencedIds }, setId: set.id },
    });
    const byId = new Map(owned.map((e) => [e.id, e]));
    const missing = referencedIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      return { result: `These exerciseIds are not in that quiz: ${missing.join(", ")}. Call read_exercise_set to get the right ids.`, isError: true };
    }

    // Merge each edit onto the current question and re-validate mcq consistency.
    for (const edit of edits) {
      const current = byId.get(edit.exerciseId)!;
      if (current.type === "mcq") {
        const finalOptions = edit.options ?? (current.optionsJson ? (JSON.parse(current.optionsJson) as string[]) : []);
        const finalAnswer = edit.answer ?? current.answer;
        if (!finalOptions.includes(finalAnswer)) {
          return {
            result: `For exercise ${edit.exerciseId} (mcq), the final answer "${finalAnswer}" must exactly match one of the final options. Fix and retry.`,
            isError: true,
          };
        }
      }
    }

    await prisma.$transaction([
      ...(renameTo !== undefined
        ? [prisma.exerciseSet.update({ where: { id: set.id }, data: { name: renameTo } })]
        : []),
      ...edits.map((e) => {
        const current = byId.get(e.exerciseId)!;
        return prisma.exercise.update({
          where: { id: e.exerciseId },
          data: {
            ...(e.prompt !== undefined ? { prompt: e.prompt } : {}),
            ...(e.options !== undefined ? { optionsJson: JSON.stringify(e.options) } : {}),
            ...(e.answer !== undefined
              ? { answer: current.type === "true_false" ? e.answer.toLowerCase() : e.answer }
              : {}),
            ...(e.explanation !== undefined ? { explanation: e.explanation } : {}),
          },
        });
      }),
      ...(deleteExerciseIds.length > 0
        ? [prisma.exercise.deleteMany({ where: { id: { in: deleteExerciseIds } } })]
        : []),
    ]);

    const parts = [
      edits.length && `updated ${edits.length} question${edits.length === 1 ? "" : "s"}`,
      deleteExerciseIds.length && `deleted ${deleteExerciseIds.length}`,
      renameTo !== undefined && "renamed the quiz",
    ].filter(Boolean);
    send({
      type: "action",
      label: `${parts.join(", ")} in "${renameTo ?? set.name}"`.replace(/^./, (c) => c.toUpperCase()),
      href: `/practice/${set.id}`,
    });
    return { result: `Done: ${parts.join(", ")} in the quiz "${renameTo ?? set.name}". Confirm briefly.` };
  }

  if (toolName === "add_exercises") {
    const parsed = addExercisesInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const { setId, exercises } = parsed.data;
    const set = await getOwnedExerciseSet(userId, setId).catch(() => null);
    if (!set) return { result: `No practice set with id ${setId} exists for this student.`, isError: true };

    const invalidMcq = exercises.find((e) => e.type === "mcq" && (!e.options || !e.options.includes(e.answer)));
    if (invalidMcq) {
      return { result: "Every mcq question needs an options array that contains the answer exactly. Fix and retry.", isError: true };
    }

    const last = await prisma.exercise.findFirst({
      where: { setId: set.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let position = (last?.position ?? -1) + 1;

    await prisma.exercise.createMany({
      data: exercises.map((e) => ({
        setId: set.id,
        type: e.type,
        prompt: e.prompt,
        optionsJson: e.type === "mcq" && e.options ? JSON.stringify(e.options) : null,
        answer: e.type === "true_false" ? e.answer.toLowerCase() : e.answer,
        explanation: e.explanation ?? null,
        position: position++,
      })),
    });

    send({
      type: "action",
      label: `Added ${exercises.length} question${exercises.length === 1 ? "" : "s"} to "${set.name}"`,
      href: `/practice/${set.id}`,
    });
    return { result: `Added ${exercises.length} questions to the quiz "${set.name}". Confirm briefly.` };
  }

  if (toolName === "create_class") {
    const parsed = createClassInput.safeParse(toolInput);
    if (!parsed.success) {
      return { result: `Invalid input: ${parsed.error.issues[0]?.message ?? "bad arguments"}`, isError: true };
    }
    const cf = await prisma.classFolder.create({
      data: { name: parsed.data.name, colorTag: parsed.data.colorTag ?? null, userId },
    });
    send({ type: "action", label: `Created class "${cf.name}"`, href: `/classes/${cf.id}` });
    return { result: `Created the class "${cf.name}" (classId: ${cf.id}). You can now add notes, decks, or quizzes to it. Confirm briefly.` };
  }

  if (toolName === "delete_note") {
    const parsed = deleteNoteInput.safeParse(toolInput);
    if (!parsed.success) return { result: "Invalid input: pass a noteId.", isError: true };
    const note = await getOwnedNote(userId, parsed.data.noteId).catch(() => null);
    if (!note) return { result: `No note with id ${parsed.data.noteId} exists for this student.`, isError: true };
    await prisma.note.delete({ where: { id: note.id } });
    send({ type: "action", label: `Deleted note "${note.title}"` });
    return { result: `Deleted the note "${note.title}". Confirm briefly.` };
  }

  if (toolName === "delete_deck") {
    const parsed = deleteDeckInput.safeParse(toolInput);
    if (!parsed.success) return { result: "Invalid input: pass a deckId.", isError: true };
    const deck = await getOwnedDeck(userId, parsed.data.deckId).catch(() => null);
    if (!deck) return { result: `No deck with id ${parsed.data.deckId} exists for this student.`, isError: true };
    const count = await prisma.flashcard.count({ where: { deckId: deck.id } });
    await prisma.deck.delete({ where: { id: deck.id } });
    send({ type: "action", label: `Deleted deck "${deck.name}" (${count} cards)` });
    return { result: `Deleted the deck "${deck.name}" and its ${count} cards. Confirm briefly.` };
  }

  if (toolName === "delete_exercise_set") {
    const parsed = deleteSetInput.safeParse(toolInput);
    if (!parsed.success) return { result: "Invalid input: pass a setId.", isError: true };
    const set = await getOwnedExerciseSet(userId, parsed.data.setId).catch(() => null);
    if (!set) return { result: `No practice set with id ${parsed.data.setId} exists for this student.`, isError: true };
    const count = await prisma.exercise.count({ where: { setId: set.id } });
    await prisma.exerciseSet.delete({ where: { id: set.id } });
    send({ type: "action", label: `Deleted quiz "${set.name}" (${count} questions)` });
    return { result: `Deleted the quiz "${set.name}" and its ${count} questions. Confirm briefly.` };
  }

  if (toolName === "delete_class") {
    const parsed = deleteClassInput.safeParse(toolInput);
    if (!parsed.success) return { result: "Invalid input: pass a classId.", isError: true };
    const cf = await getOwnedClassFolder(userId, parsed.data.classId).catch(() => null);
    if (!cf) return { result: `No class with id ${parsed.data.classId} exists for this student.`, isError: true };
    const counts = await prisma.$transaction([
      prisma.note.count({ where: { classFolderId: cf.id } }),
      prisma.deck.count({ where: { classFolderId: cf.id } }),
      prisma.exerciseSet.count({ where: { classFolderId: cf.id } }),
    ]);
    await prisma.classFolder.delete({ where: { id: cf.id } });
    send({ type: "action", label: `Deleted class "${cf.name}" and everything in it` });
    return {
      result: `Deleted the class "${cf.name}" along with ${counts[0]} notes, ${counts[1]} decks, and ${counts[2]} quizzes. Confirm briefly.`,
    };
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
    "- You can EDIT existing content when asked to fix, change, reword, or expand something: update_note for notes (call read_note first if the snapshot shows the note clipped with …), update_flashcards for cards in a deck (cardId values are in the snapshot), and update_exercises for quiz questions (ALWAYS call read_exercise_set first — the snapshot doesn't include quiz questions). Prefer editing the existing item over creating a duplicate.",
    "- You can ADD to existing items: create_flashcards with a deckId adds cards to an existing deck, and add_exercises adds questions to an existing quiz. Use these rather than making a new deck/quiz when the student wants more of what they already have.",
    "- You can also create a new class (create_class) and DELETE things when the student clearly asks: delete_note, delete_deck (whole deck), delete_exercise_set (whole quiz), and delete_class (a whole class and all its contents). Deletes are permanent with no undo, so only delete the specific item the student asked for, and never delete something as a side effect of another request.",
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
  signal?: AbortSignal,
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
    // If the student navigated away or refreshed, stop before doing more work
    // (and, crucially, before executing any more content-creating tools).
    if (signal?.aborted) return;
    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: "disabled" },
        system,
        tools,
        messages,
      },
      signal ? { signal } : undefined,
    );

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
      if (signal?.aborted) return;
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
