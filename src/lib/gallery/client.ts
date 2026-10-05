import { renderAnimation, renderExport } from "@/lib/image-io";
import type { DitherSettings, ExportSettings } from "@/lib/dither/types";
import type { GalleryPage, GalleryPost } from "./shared";

/** Browser side of the gallery API. Errors come back as thrown Errors with the server's message. */

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Can't reach the gallery. Check your connection.");
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const fetchGallery = (before: string | null) =>
  call<GalleryPage>(`/api/gallery${before ? `?before=${encodeURIComponent(before)}` : ""}`);

export async function publishPost(post: { title: string; author: string; image: Blob; settings: DitherSettings }) {
  const form = new FormData();
  form.set("title", post.title);
  form.set("author", post.author);
  form.set("agree", "true");
  form.set("settings", JSON.stringify(post.settings));
  form.set("image", post.image, post.image.type === "image/gif" ? "post.gif" : "post.png");
  await call<{ ok: true }>("/api/gallery", { method: "POST", body: form });
}

const admin = (token: string): HeadersInit => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

export const fetchPending = (token: string) => call<{ posts: GalleryPost[] }>("/api/gallery/admin", { headers: admin(token) });

export const moderate = (token: string, id: string, action: "approve" | "delete") =>
  call<{ ok: true }>("/api/gallery/admin", { method: "POST", headers: admin(token), body: JSON.stringify({ id, action }) });

/** The image a post uploads: the loop as a 1× GIF when there is one, otherwise the still as a 1× PNG. */
export async function renderPostImage(
  still: ImageData,
  loop: { frames: ImageData[]; fps: number } | null,
  background: string,
): Promise<Blob> {
  const settings = (format: ExportSettings["format"]): ExportSettings => ({ format, scale: 1, quality: 1 });
  return loop ? renderAnimation(loop.frames, loop.fps, settings("gif"), background) : renderExport(still, settings("png"), background);
}
