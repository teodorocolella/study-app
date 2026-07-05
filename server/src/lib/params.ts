import type { Request } from "express";
import { ApiError } from "../middleware/errorHandler.js";

export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new ApiError(400, `Missing route parameter: ${name}`);
  }
  return value;
}
