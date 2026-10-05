"use client";

import { PixelText } from "@/components/icons/pixel-text";
import { cn } from "@/lib/tailwind-utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** Compact floating status chip, bottom-left of the viewport (mirrors the zoom controls). Positioned by the viewport. */
export function StatusBar() {
  const source = useWorkspaceStore((s) => s.source);
  const result = useWorkspaceStore((s) => s.result);
  const processing = useWorkspaceStore((s) => s.processing);
  const duration = useWorkspaceStore((s) => s.duration);
  const error = useWorkspaceStore((s) => s.error);

  if (!source && !error) return null;

  return (
    <div
      role="status"
      className="flex h-[30px] min-w-0 items-center gap-2.5 border border-zinc-800 bg-zinc-950/90 px-2.5 text-2xs text-zinc-500 tabular-nums backdrop-blur"
    >
      <span
        className={cn("size-2 shrink-0", processing ? "animate-pulse bg-amber-400" : error ? "bg-red-500" : "bg-zinc-600")}
        aria-hidden
      />
      {error ? (
        <span className="truncate text-red-400">{error}</span>
      ) : (
        source && (
          <>
            <span className="truncate text-zinc-300" title={source.name}>
              {source.name}
            </span>
            <span className="shrink-0">
              {source.width}×{source.height}
              {result && <PixelText>{`→ ${result.width}×${result.height}`}</PixelText>}
            </span>
            {result && (
              <span className="shrink-0 text-zinc-600">{processing ? "…" : `${duration.toFixed(0)}ms`}</span>
            )}
          </>
        )
      )}
    </div>
  );
}
