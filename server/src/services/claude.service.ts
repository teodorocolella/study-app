import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "../env.js";

export const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const MODEL = "claude-sonnet-5";

export const NO_MARKDOWN =
  "Write in plain prose only — do not use markdown formatting of any kind (no **bold**, no # headers, no bullet-point dashes or asterisks, no backticks). If you want to separate distinct points, put each on its own line as a plain sentence instead of a markdown list.";

/** A short instruction telling Claude to pitch content to the student's grade level. */
export function gradeInstruction(gradeLevel?: number | null): string {
  if (gradeLevel == null) return "";
  if (gradeLevel >= 13) {
    return "The student is in college or beyond — you can use mature vocabulary and go into depth.";
  }
  return `The student is in grade ${gradeLevel}. Pitch the vocabulary, difficulty, and examples to a grade-${gradeLevel} level.`;
}

const flashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});

export async function generateFlashcardsFromNotes(noteText: string, count = 10, gradeLevel?: number | null) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "disabled" },
    system: `You turn study notes into flashcards. Generate exactly ${count} flashcards from the student's notes below. Each flashcard should test one discrete fact or concept — keep the front short (a question or term) and the back concise (the answer or definition). ${gradeInstruction(gradeLevel)} ${NO_MARKDOWN}`,
    messages: [{ role: "user", content: noteText }],
    output_config: { format: zodOutputFormat(flashcardsSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable flashcard data");
  }
  return response.parsed_output.cards;
}

export const EXERCISE_TYPES = ["mcq", "true_false", "fill_blank", "short_answer"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

const generatedExerciseSchema = z.object({
  exercises: z.array(
    z.object({
      type: z.enum(EXERCISE_TYPES),
      prompt: z.string(),
      options: z.array(z.string()).nullable(),
      answer: z.string(),
      explanation: z.string(),
    }),
  ),
});

const EXERCISE_RULES = [
  "Rules per type:",
  '- "mcq": prompt is a question; options has exactly 4 answer choices; answer is the correct choice, copied exactly from options; vary which position the correct choice is in.',
  '- "true_false": prompt is a statement to judge; options is null; answer is exactly "true" or "false"; write roughly half true and half false.',
  '- "fill_blank": prompt is a sentence with the key term replaced by "_____"; options is null; answer is the missing term (1-3 words).',
  '- "short_answer": prompt asks the student to explain or describe something in their own words (1-3 sentences); options is null; answer is a model answer listing the points a good response should include.',
  "Every exercise gets a one-or-two-sentence explanation of the correct answer.",
].join("\n");

export async function generateExercisesFromNotes(
  noteText: string,
  types: ExerciseType[],
  count: number,
  gradeLevel?: number | null,
) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "disabled" },
    system: `You turn study notes into practice-quiz exercises. Generate exactly ${count} exercises from the student's notes below, using only these types: ${types.join(", ")}. Mix the allowed types roughly evenly and order them so the quiz feels varied. Test understanding, not trivia — prefer the ideas the notes emphasize. ${gradeInstruction(gradeLevel)}\n${EXERCISE_RULES}\n${NO_MARKDOWN}`,
    messages: [{ role: "user", content: noteText }],
    output_config: { format: zodOutputFormat(generatedExerciseSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable exercise data");
  }
  return response.parsed_output.exercises;
}

const shortAnswerGradesSchema = z.object({
  grades: z.array(
    z.object({
      index: z.number().int(),
      correct: z.boolean(),
      feedback: z.string(),
    }),
  ),
});

export interface ShortAnswerSubmission {
  index: number;
  question: string;
  modelAnswer: string;
  studentAnswer: string;
}

export async function gradeShortAnswers(submissions: ShortAnswerSubmission[]) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "disabled" },
    system: `You grade short-answer quiz responses from a middle/high school student. For each item, compare the student's answer to the model answer. Mark it correct if it captures the essential idea, even in different words — grade the understanding, not the phrasing. Mark it incorrect if a key point is wrong or missing. Give one or two sentences of encouraging feedback: say what they got right and what was missing or mistaken. Return a grade for every index you were given. ${NO_MARKDOWN}`,
    messages: [{ role: "user", content: JSON.stringify(submissions) }],
    output_config: { format: zodOutputFormat(shortAnswerGradesSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return parseable grading data");
  }
  return response.parsed_output.grades;
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
