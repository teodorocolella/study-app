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

  it("accepts the right number even when the unit is dropped", () => {
    expect(fuzzyAnswerMatch("9.8 meters per second", "9.8")).toBe(true);
    expect(fuzzyAnswerMatch("9.8 m/s", "9.8")).toBe(true);
    expect(fuzzyAnswerMatch("60 mph", "60")).toBe(true);
    expect(fuzzyAnswerMatch("100", "100 meters")).toBe(true);
    expect(fuzzyAnswerMatch("3.14", "3.14")).toBe(true);
  });

  it("treats unit spellings and symbols the same", () => {
    expect(fuzzyAnswerMatch("9.8 meters per second", "9.8 m/s")).toBe(true);
    expect(fuzzyAnswerMatch("5 meters", "5 m")).toBe(true);
    expect(fuzzyAnswerMatch("meters per second", "m/s")).toBe(true);
  });

  it("still rejects a wrong number", () => {
    expect(fuzzyAnswerMatch("9.8 meters per second", "10")).toBe(false);
    expect(fuzzyAnswerMatch("60 mph", "65")).toBe(false);
  });

  it("does not accept a matching number with a non-unit noun", () => {
    // "apples" is not a unit, so "5" alone should not pass for "5 apples".
    expect(fuzzyAnswerMatch("5 apples", "5")).toBe(false);
  });
});
