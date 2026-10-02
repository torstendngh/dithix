"use client";

import dynamic from "next/dynamic";

// The editor reads localStorage and canvas APIs on first render, so skip SSR
// to avoid hydration mismatches with persisted settings.
const Editor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center text-zinc-600">loading…</div>
  ),
});

export function EditorLoader() {
  return <Editor />;
}
