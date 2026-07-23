import { Router } from "express";
import {
  createExercise,
  createExerciseSet,
  deleteExercise,
  deleteExerciseSet,
  getExerciseSet,
  listExerciseSets,
  submitAttempt,
  updateExercise,
  updateExerciseSet,
} from "../controllers/exercises.controller.js";

// Mounted at /api/classes/:classId/exercise-sets
export const exerciseSetsNestedRouter = Router({ mergeParams: true });
exerciseSetsNestedRouter.get("/", listExerciseSets);
exerciseSetsNestedRouter.post("/", createExerciseSet);

// Mounted at /api/exercise-sets
export const exerciseSetsRouter = Router();
exerciseSetsRouter.get("/:setId", getExerciseSet);
exerciseSetsRouter.patch("/:setId", updateExerciseSet);
exerciseSetsRouter.delete("/:setId", deleteExerciseSet);
exerciseSetsRouter.post("/:setId/exercises", createExercise);
exerciseSetsRouter.post("/:setId/attempts", submitAttempt);

// Mounted at /api/exercises
export const exercisesRouter = Router();
exercisesRouter.patch("/:exerciseId", updateExercise);
exercisesRouter.delete("/:exerciseId", deleteExercise);
