"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button, buttonVariants } from "@/components/shared/button";
import { fetchGallery } from "@/lib/gallery/client";
import type { GalleryPage, GalleryPost } from "@/lib/gallery/shared";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// The editor's stores are loaded on demand: the page itself doesn't need them to render.
const settingsStore = () => import("@/stores/settings-store").then((m) => m.useSettingsStore.getState());
const presetStore = () => import("@/stores/preset-store").then((m) => m.usePresetStore.getState());

/**
 * One post at its own shape, scaled up crisp, with its title and maker underneath. The buttons to
 * use or keep its look (never the image) show on hover or focus; touch screens always show them.
 */
function PostCard({ post }: { post: GalleryPost }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  return (
    <li className="group mb-8 break-inside-avoid">
      <div className="relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- 1× pixel art; the optimiser would blur it. */}
        <img
          src={post.imageUrl}
          alt={post.title}
          width={post.width}
          height={post.height}
          loading="lazy"
          className="block h-auto w-full max-w-full [image-rendering:pixelated]"
          style={{ aspectRatio: `${post.width} / ${post.height}` }}
        />
        {post.format === "gif" && (
          <span className="absolute top-2 left-2 bg-zinc-100 px-1.5 py-0.5 text-2xs tracking-widest text-zinc-950 uppercase">
            Loop
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-linear-to-t from-black/80 to-transparent p-3 pt-10 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
          <Button
            size="sm"
            className="normal-case"
            title="Open the editor with this look (your image stays, the post's image isn't loaded)"
            onClick={async () => {
              (await settingsStore()).applySettings(post.settings);
              router.push("/");
            }}
          >
            <PixelIcon name="wand" scale={1} />
            Use look
          </Button>
          <Button
            size="sm"
            className="normal-case"
            title="Save this look to your presets"
            disabled={saved}
            onClick={async () => {
              (await presetStore()).savePreset(`${post.title} · ${post.author}`, post.settings);
              setSaved(true);
            }}
          >
            <PixelIcon name={saved ? "check" : "bookmark"} scale={1} />
            {saved ? "Saved" : "Save preset"}
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 gap-1 pt-3">
        <span className="truncate text-sm text-zinc-100" title={post.title}>
          {post.title}
        </span>
        <span className="truncate text-zinc-500" title={post.author}>
          {post.author} · {formatDate(post.date)}
        </span>
      </div>
    </li>
  );
}

/** The gallery page: the first posts come from the server, more load on demand. */
export function GalleryView({ initial, error: initialError }: { initial: GalleryPage | null; error: string | null }) {
  const [posts, setPosts] = useState<GalleryPost[]>(initial?.posts ?? []);
  const [next, setNext] = useState<string | null>(initial?.next ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const loadMore = async () => {
    if (!next) return;
    setLoading(true);
    setError(null);
    try {
      const page = await fetchGallery(next);
      setPosts((prev) => [...prev, ...page.posts]);
      setNext(page.next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-full overflow-y-auto">
      {/* Same banner treatment as the editor sidebar: dimmed backdrop, pixel logo. */}
      <header className="relative isolate overflow-hidden">
        <Image
          src="/bg-art.png"
          alt=""
          aria-hidden
          fill
          // The backdrop at its art resolution (512×288), scaled up to cover with hard pixel edges.
          unoptimized
          preload
          className="pointer-events-none -z-10 object-cover object-[50%_75%] opacity-40 mask-b-from-0% select-none [image-rendering:pixelated]"
          draggable={false}
        />
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-6 px-6 pt-10 pb-8">
          <div className="grid min-w-0 gap-5">
            <Link href="/" aria-label="dithix editor" className="w-fit">
              <Image
                src="/logo-2.png"
                alt="dithix"
                width={1816}
                height={1024}
                unoptimized
                preload
                className="h-auto w-[227px] select-none [image-rendering:pixelated]"
                draggable={false}
              />
            </Link>
            <div className="grid gap-2">
              <h1 className="text-sm tracking-[0.3em] text-zinc-100 uppercase">Gallery</h1>
              <p className="max-w-xl leading-relaxed text-zinc-400">
                Dithered work shared by dithix users, newest first. Take any look into the editor or keep it as a preset; only
                the settings come along, never the image.
              </p>
            </div>
          </div>
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            <PixelIcon name="editor" scale={1} />
            Open editor
          </Link>
        </div>
      </header>

      {/* min-w-0 children: a wide image must not stretch the grid past the screen. */}
      <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-10 *:min-w-0">
        {posts.length === 0 && !error && (
          <div className="grid justify-items-center gap-3 border border-dashed border-zinc-800 px-6 py-16 text-center">
            <PixelIcon name="gallery" scale={4} className="text-zinc-800" />
            <p className="text-zinc-300">Nothing here yet</p>
            <p className="text-zinc-500">Be the first: in the editor, open Export and choose Publish to gallery.</p>
          </div>
        )}
        {posts.length > 0 && (
          <ul className="columns-1 gap-8 md:columns-2 2xl:columns-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </ul>
        )}
        {error && <p className="text-red-400">{error}</p>}
        {next && (
          <Button variant="outline" size="sm" className="justify-self-center" disabled={loading} onClick={() => void loadMore()}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        )}
        {posts.length > 0 && (
          <p className="border-t border-zinc-800 pt-6 text-center text-zinc-500">
            Share your own: in the editor, open Export and choose <span className="text-zinc-300">Publish to gallery</span>.
          </p>
        )}
      </div>
    </main>
  );
}
