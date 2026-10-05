"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button, buttonVariants } from "@/components/shared/button";
import { Checkbox } from "@/components/shared/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { Label } from "@/components/shared/label";
import { frameCount, isLooping } from "@/lib/dither/motion";
import { publishPost, renderPostImage } from "@/lib/gallery/client";
import { AUTHOR_MAX, GALLERY_RULES, TITLE_MAX } from "@/lib/gallery/shared";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** What will be uploaded: the still, or the first frame of the loop. */
function Preview({ image }: { image: ImageData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.putImageData(image, 0, 0);
  }, [image]);
  return (
    <div className="checkerboard grid h-48 place-items-center overflow-hidden border border-zinc-800">
      <canvas ref={ref} className="size-full object-contain [image-rendering:pixelated]" />
    </div>
  );
}

function PublishForm() {
  const result = useWorkspaceStore((s) => s.result);
  const frames = useWorkspaceStore((s) => s.frames);
  const frameTotal = useWorkspaceStore((s) => s.frameTotal);
  const playhead = useWorkspaceStore((s) => s.playhead);
  const motion = useSettingsStore((s) => s.settings.motion);
  const savedAuthor = useUiStore((s) => s.galleryAuthor);
  const setGalleryAuthor = useUiStore((s) => s.setGalleryAuthor);
  const setPublishOpen = useUiStore((s) => s.setPublishOpen);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState(savedAuthor);
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const titleId = useId();
  const authorId = useId();
  const agreeId = useId();

  const looping = isLooping(motion);
  const complete = looping && frameTotal > 0 && frames.length === frameTotal;
  const still = complete ? frames[playhead % frames.length] : result;
  const rendering = looping && !complete;
  const ready = !!still && !rendering && title.trim() !== "" && author.trim() !== "" && agree && state !== "sending";

  if (state === "done") {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="flex items-center gap-2 text-zinc-100">
          <PixelIcon name="check" scale={1} className="text-emerald-400" />
          Thanks! Your post is waiting for review.
        </p>
        <p className="leading-relaxed text-zinc-400">It shows up in the gallery as soon as it has been approved.</p>
        <div className="flex gap-2">
          <Link href="/gallery" className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => setPublishOpen(false)}>
            <PixelIcon name="gallery" scale={1} />
            View the gallery
          </Link>
          <Button size="sm" onClick={() => setPublishOpen(false)}>
            <PixelIcon name="editor" scale={1} />
            Back to editor
          </Button>
        </div>
      </div>
    );
  }

  if (!still) return <p className="text-zinc-500">Open an image first — the gallery shows the dithered result.</p>;

  const publish = async () => {
    if (!ready) return;
    setState("sending");
    setError("");
    try {
      const { settings } = useSettingsStore.getState();
      const image = await renderPostImage(
        still,
        complete ? { frames, fps: motion.fps } : null,
        settings.palette.colors[0] ?? "#000000",
      );
      await publishPost({ title, author, image, settings });
      setGalleryAuthor(author.trim());
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publishing failed.");
      setState("error");
    }
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void publish();
      }}
    >
      <div className="grid gap-2">
        <Preview image={still} />
        <p className="text-2xs leading-relaxed text-zinc-500">
          {rendering
            ? `The loop is still rendering (${frames.length}/${frameTotal}) — it will be published as a GIF once it's in.`
            : complete
              ? `Uploads the ${frameCount(motion)}-frame loop as a GIF at 1× (${still.width}×${still.height}), with these settings.`
              : `Uploads this image as a PNG at 1× (${still.width}×${still.height}), with these settings.`}{" "}
          Your original image is never uploaded.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={titleId}>Title</Label>
          <Input id={titleId} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Neon harbour" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={authorId}>Your name</Label>
          <Input id={authorId} value={author} maxLength={AUTHOR_MAX} onChange={(e) => setAuthor(e.target.value)} placeholder="shown with the post" />
        </div>
      </div>

      <div className="grid gap-2 border border-zinc-800 bg-zinc-900/40 p-3">
        <span className="text-2xs tracking-[0.2em] text-zinc-500 uppercase">Gallery rules</span>
        <ul className="grid list-disc gap-1 pl-4 leading-relaxed text-zinc-400">
          {GALLERY_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox id={agreeId} checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
        <Label htmlFor={agreeId} className="leading-relaxed text-zinc-300">
          I have the rights to this image and it follows the gallery rules.
        </Label>
      </div>

      {state === "error" && <p className="text-red-400">{error}</p>}

      <Button type="submit" disabled={!ready} className="justify-self-start">
        <PixelIcon name="upload" scale={1} />
        {state === "sending" ? "Publishing…" : "Publish"}
      </Button>
    </form>
  );
}

/** Publish the current result to the gallery; opened from the Export panel. */
export function PublishDialog() {
  const open = useUiStore((s) => s.publishOpen);
  const setOpen = useUiStore((s) => s.setPublishOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 pt-5 pb-4">
          <div className="grid gap-1">
            <DialogTitle>Publish to the gallery</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Share the current result with its settings, so others can use the look. Posts appear once they&apos;ve been
              reviewed.
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Close"
            className="grid size-7 shrink-0 place-items-center text-zinc-500 outline-none hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring"
          >
            <PixelIcon name="close" scale={1} />
          </DialogClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <PublishForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
