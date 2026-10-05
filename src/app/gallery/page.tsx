import type { Metadata } from "next";
import { connection } from "next/server";
import { GalleryView } from "@/components/gallery/gallery-view";
import { GalleryNotConfigured, listApproved } from "@/lib/gallery/server";
import type { GalleryPage } from "@/lib/gallery/shared";

export const metadata: Metadata = {
  title: "Gallery · dithix",
  description: "Dithered pixel art made with dithix. Use any look in the editor or save it as a preset.",
};

export default async function Page() {
  // Fresh posts on every visit, not a snapshot from build time.
  await connection();
  let initial: GalleryPage | null = null;
  let error: string | null = null;
  try {
    initial = await listApproved(null);
  } catch (err) {
    if (!(err instanceof GalleryNotConfigured)) console.error("[gallery]", err);
    error = err instanceof GalleryNotConfigured ? err.message : "Couldn't load the gallery. Try again in a moment.";
  }
  return <GalleryView initial={initial} error={error} />;
}
