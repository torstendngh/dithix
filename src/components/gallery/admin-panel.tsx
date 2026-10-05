"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelIcon } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { fetchGallery, fetchPending, moderate } from "@/lib/gallery/client";
import type { GalleryPost } from "@/lib/gallery/shared";
import { cn } from "@/lib/tailwind-utils";

const TOKEN_KEY = "dithix:admin-token";

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};
const writeToken = (token: string) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private mode: the token just isn't remembered for the tab.
  }
};

type View = "pending" | "live";

function Row({ post, view, token, onDone }: { post: GalleryPost; view: View; token: string; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const act = async (action: "approve" | "delete") => {
    setBusy(true);
    setError("");
    try {
      await moderate(token, post.id, action);
      onDone(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  };

  return (
    <li className="grid grid-cols-[8rem_1fr] gap-4 border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-[12rem_1fr]">
      <a href={post.imageUrl} target="_blank" rel="noreferrer" className="checkerboard grid aspect-square place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- 1× pixel art; the optimiser would blur it. */}
        <img src={post.imageUrl} alt={post.title} className="size-full object-contain [image-rendering:pixelated]" />
      </a>
      <div className="grid content-start gap-2">
        <div className="grid gap-0.5">
          <span className="text-sm text-zinc-100">{post.title}</span>
          <span className="text-zinc-400">by {post.author}</span>
          <span className="text-2xs text-zinc-600 tabular-nums">
            {new Date(post.date).toLocaleString()} · {post.format.toUpperCase()} {post.width}×{post.height} · {post.settings.palette.colors.length} colours ·{" "}
            {post.settings.dither.algorithm}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === "pending" && (
            <Button size="sm" disabled={busy} onClick={() => void act("approve")}>
              <PixelIcon name="check" scale={1} />
              Approve
            </Button>
          )}
          {confirmDelete ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} className="border-red-500/60 text-red-300" onClick={() => void act("delete")}>
                <PixelIcon name="trash" scale={1} />
                Delete for good
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <PixelIcon name="trash" scale={1} />
              {view === "pending" ? "Reject" : "Delete"}
            </Button>
          )}
        </div>
        {error && <p className="text-red-400">{error}</p>}
      </div>
    </li>
  );
}

/** Gallery review: approve or reject pending posts, take down live ones. */
export function AdminPanel() {
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<View>("pending");
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => setToken(readToken()), []);

  const load = useCallback(
    async (before: string | null = null) => {
      if (!token) return;
      setState("loading");
      try {
        if (view === "pending") {
          setPosts((await fetchPending(token)).posts);
          setNext(null);
        } else {
          const page = await fetchGallery(before);
          setPosts((prev) => (before ? [...prev, ...page.posts] : page.posts));
          setNext(page.next);
        }
        setState("idle");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load";
        if (message === "Wrong admin token.") {
          writeToken("");
          setToken("");
        }
        setError(message);
        setState("error");
      }
    },
    [token, view],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) {
    return (
      <main className="grid h-full place-items-center overflow-y-auto p-6">
        <form
          className="grid w-full max-w-sm gap-3 border border-zinc-800 bg-zinc-950 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            writeToken(draft.trim());
            setToken(draft.trim());
          }}
        >
          <h1 className="text-sm text-zinc-50">Gallery review</h1>
          <p className="leading-relaxed text-zinc-400">Enter the GALLERY_ADMIN_TOKEN. It is kept for this tab only.</p>
          <Input type="password" autoComplete="current-password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="admin token" />
          {state === "error" && <p className="text-red-400">{error}</p>}
          <Button type="submit" disabled={!draft.trim()}>
            Sign in
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-4 p-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-sm text-zinc-50">Gallery review</h1>
          <div className="flex gap-1" role="tablist">
            {(["pending", "live"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "h-7 border px-2.5 capitalize outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  view === v ? "border-zinc-100 text-zinc-50" : "border-zinc-800 text-zinc-500 hover:text-zinc-200",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <PixelIcon name="reset" scale={1} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                writeToken("");
                setToken("");
              }}
            >
              Sign out
            </Button>
          </div>
        </header>

        {state === "error" && <p className="text-red-400">{error}</p>}
        {state === "idle" && posts.length === 0 && (
          <p className="text-zinc-500">{view === "pending" ? "Nothing waiting for review." : "No live posts."}</p>
        )}
        <ul className="grid gap-3">
          {posts.map((p) => (
            <Row key={p.id} post={p} view={view} token={token} onDone={(id) => setPosts((list) => list.filter((x) => x.id !== id))} />
          ))}
        </ul>
        {state === "loading" && <p className="text-zinc-500">loading…</p>}
        {view === "live" && next && state === "idle" && (
          <Button variant="outline" size="sm" className="justify-self-center" onClick={() => void load(next)}>
            Load more
          </Button>
        )}
      </div>
    </main>
  );
}
