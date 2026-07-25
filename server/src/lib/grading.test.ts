import { describe, expect, it } from "vitest";
import { fuzzyAnswerMatch } from "./grading.js";

describe("fuzzyAnswerMatch", () => {
  it("matches identical answers", () => {
    expect(fuzzyAnswerMatch("mitochondria", "mitochondria")).toBe(true);
  });

  it("ignores case, punctuation, and surrounding whitespace", () => {
    expect(fuzzyAnswerMatch("Mitochondria", "  mitochondria!  ")).toBe(true);
    expect(fuzzyAnswerMatch("H2O", "h2o")).toBe(true);
  });

  it("ignores a leading article", () => {
    expect(fuzzyAnswerMatch("the nucleus", "nucleus")).toBe(true);
    expect(fuzzyAnswerMatch("nucleus", "a nucleus")).toBe(true);
  });

  it("tolerates a single typo on longer answers", () => {
    expect(fuzzyAnswerMatch("chlorophyll", "chlorophyl")).toBe(true);
    expect(fuzzyAnswerMatch("photosynthesis", "photosynthesus")).toBe(true);
  });

  it("rejects clearly different answers", () => {
    expect(fuzzyAnswerMatch("mitochondria", "ribosome")).toBe(false);
    expect(fuzzyAnswerMatch("nucleus", "membrane")).toBe(false);
  });

  it("does not treat empty input as a match", () => {
    expect(fuzzyAnswerMatch("cell", "")).toBe(false);
    expect(fuzzyAnswerMatch("", "cell")).toBe(false);
  });

  it("is strict on very short answers (no typo leniency)", () => {
    expect(fuzzyAnswerMatch("pi", "po")).toBe(false);
  });
});
