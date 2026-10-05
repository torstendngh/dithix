import { completeSettings } from "@/lib/dither/defaults";
import type { DitherSettings } from "@/lib/dither/types";

/** Gallery rules and validation, shared by the publish form and the API. */

export const TITLE_MAX = 60;
export const AUTHOR_MAX = 32;
/** Under Vercel's 4.5 MB request body limit for functions. */
export const MAX_UPLOAD_BYTES = 4_000_000;
/** Longest side of an uploaded image, in pixels (they are uploaded at 1×). */
export const MAX_SIDE = 2048;
const MAX_SETTINGS_CHARS = 100_000;

export const GALLERY_RULES = [
  "You made the image or have the right to share it, and the picture you dithered is yours or you may use it.",
  "No nudity, sexual content, gore, hate or harassment.",
  "No photos of other people without their consent, and no private information.",
  "No ads or spam.",
];

export type GalleryFormat = "png" | "gif";

/** A post as the gallery shows it. */
export interface GalleryPost {
  id: string;
  title: string;
  author: string;
  imageUrl: string;
  format: GalleryFormat;
  width: number;
  height: number;
  settings: DitherSettings;
  /** ISO time it went live (approved), or was submitted for pending posts. */
  date: string;
}

export interface GalleryPage {
  posts: GalleryPost[];
  /** Pass back as `before` for the next page; null at the end. */
  next: string | null;
}

/** Trims, drops control characters and squeezes whitespace. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export type Submission = { title: string; author: string; settings: DitherSettings };

/** Checks the form fields of a submission; the image is checked separately (`sniffImage`). */
export function validateSubmission(fields: {
  title: unknown;
  author: unknown;
  agree: unknown;
  settings: unknown;
}): { ok: true; value: Submission } | { ok: false; error: string } {
  const title = cleanText(fields.title, TITLE_MAX);
  const author = cleanText(fields.author, AUTHOR_MAX);
  if (!title) return { ok: false, error: "Add a title." };
  if (!author) return { ok: false, error: "Add your name." };
  if (fields.agree !== "true" && fields.agree !== true) {
    return { ok: false, error: "Confirm you have the rights to the image and follow the rules." };
  }
  if (typeof fields.settings !== "string" || fields.settings.length > MAX_SETTINGS_CHARS) {
    return { ok: false, error: "The settings are missing or too large." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fields.settings);
  } catch {
    return { ok: false, error: "The settings could not be read." };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "The settings could not be read." };
  return { ok: true, value: { title, author, settings: completeSettings(raw) } };
}

/** Reads the type and size of a PNG or GIF from its header; null for anything else. */
export function sniffImage(bytes: Uint8Array): { format: GalleryFormat; width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isPng =
    bytes.length >= 24 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b) &&
    String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
  if (isPng) return { format: "png", width: view.getUint32(16), height: view.getUint32(20) };
  const sig = bytes.length >= 10 ? String.fromCharCode(...bytes.slice(0, 6)) : "";
  if (sig === "GIF87a" || sig === "GIF89a") {
    return { format: "gif", width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  return null;
}

/** Checks an uploaded image's bytes; returns its type and size or an error. */
export function checkImage(bytes: Uint8Array):
  | { ok: true; format: GalleryFormat; width: number; height: number }
  | { ok: false; error: string } {
  if (bytes.length === 0) return { ok: false, error: "The image is missing." };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: "The image is too large (4 MB max)." };
  const info = sniffImage(bytes);
  if (!info) return { ok: false, error: "Only PNG and GIF images can be published." };
  if (info.width < 1 || info.height < 1 || Math.max(info.width, info.height) > MAX_SIDE) {
    return { ok: false, error: `Images can be at most ${MAX_SIDE}px on a side.` };
  }
  return { ok: true, ...info };
}
