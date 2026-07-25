import type { Request, Response } from "express";
import { z } from "zod";
import { storageEnabled, uploadDataUrl } from "../services/storage.service.js";

export function getUploadStatus(_req: Request, res: Response) {
  res.json({ enabled: storageEnabled });
}

const uploadSchema = z.object({
  dataUrl: z
    .string()
    .max(2_000_000, "Image is too large")
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Invalid image format"),
});

export async function postUpload(req: Request, res: Response) {
  if (!storageEnabled) {
    res.status(501).json({ error: "Object storage is not configured" });
    return;
  }
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const url = await uploadDataUrl(parsed.data.dataUrl);
  res.status(201).json({ url });
}
