"use client";

import { useId, useState } from "react";
import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { cn } from "@/lib/tailwind-utils";

interface SectionProps {
  title: string;
  icon: IconName;
  /** Extra controls shown in the header, just left of the chevron. */
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Section({ title, icon, actions, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const toggle = () => setOpen((o) => !o);

  return (
    <section className="border-b border-border">
      <div className="group/header flex h-9 items-center">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3 text-left text-2xs tracking-[0.2em] text-zinc-400 uppercase outline-none hover:text-zinc-100 focus-visible:text-zinc-100"
        >
          <PixelIcon name={icon} scale={1} className="text-zinc-500" />
          <span className="truncate">{title}</span>
        </button>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
        {/* Chevron always sits at the far right edge; same toggle, kept out of the tab order. */}
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          aria-hidden
          className="grid h-full w-8 shrink-0 place-items-center text-zinc-600 outline-none hover:text-zinc-100 group-has-[button[aria-expanded]:hover]/header:text-zinc-300"
        >
          <PixelIcon
            name="chevron-down"
            scale={1}
            className={cn("transition-transform", !open && "-rotate-90")}
          />
        </button>
      </div>
      {open && (
        <div id={bodyId} className="grid gap-3 px-3 pt-1 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
