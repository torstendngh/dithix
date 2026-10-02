"use client";

import { useState } from "react";
import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { Input } from "@/components/shared/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/popover";
import { cn } from "@/lib/tailwind-utils";
import { IconButton } from "./fields";

export interface LibraryItem {
  id: string;
  name: string;
  /** Shown at the end of the row, e.g. a colour strip. */
  preview?: React.ReactNode;
}

export interface LibraryGroup {
  label: string;
  items: LibraryItem[];
}

interface LibraryPickerProps {
  /** Lower-case singular, used in labels: "preset", "palette". */
  noun: string;
  icon: IconName;
  /** Accessible name of the trigger. */
  triggerLabel: string;
  /** What the overwrite action saves, for its tooltip: "settings", "colours". */
  current: string;
  saved: LibraryItem[];
  builtIn: LibraryGroup[];
  activeId: string | null;
  /** Shown in the trigger after the name, e.g. the current palette strip. */
  triggerPreview?: React.ReactNode;
  onApply: (id: string) => void;
  onSave: (name: string) => void;
  onOverwrite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

interface RowProps {
  item: LibraryItem;
  editable: boolean;
  active: boolean;
  noun: string;
  current: string;
  onApply: () => void;
  onOverwrite: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function Row({ item, editable, active, noun, current, onApply, onOverwrite, onRename, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  // Deleting takes a second click so a stray click can't lose anything.
  const [confirming, setConfirming] = useState(false);
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  return (
    <li
      className={cn(
        "group flex h-7 items-center gap-1 pr-1 pl-2",
        active ? "bg-zinc-800 text-zinc-50" : "text-zinc-300 hover:bg-zinc-800/60",
      )}
      onMouseLeave={() => setConfirming(false)}
    >
      {editing ? (
        <Input
          autoFocus
          defaultValue={item.name}
          aria-label={`${Noun} name`}
          className="h-6"
          maxLength={40}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            onRename(e.target.value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={onApply}
          onDoubleClick={() => editable && setEditing(true)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:underline"
        >
          <span className="grid w-2 shrink-0 place-items-center">
            {active && <PixelIcon name="check" scale={1} />}
          </span>
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.preview}
        </button>
      )}
      {editable && !editing && (
        <span
          className={cn(
            "flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            confirming && "opacity-100",
          )}
        >
          <IconButton
            icon="save"
            label={active ? `Matches current ${current}` : `Overwrite with current ${current}`}
            size="icon-xs"
            disabled={active}
            onClick={onOverwrite}
          />
          <IconButton icon="pencil" label="Rename" size="icon-xs" onClick={() => setEditing(true)} />
          <IconButton
            icon="trash"
            label={confirming ? "Click again to delete" : "Delete"}
            size="icon-xs"
            className={cn(confirming && "bg-red-950 text-red-400 hover:bg-red-900 hover:text-red-300")}
            onBlur={() => setConfirming(false)}
            onClick={() => (confirming ? onDelete() : setConfirming(true))}
          />
        </span>
      )}
    </li>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 text-2xs tracking-widest text-zinc-500 uppercase">{children}</div>
  );
}

/**
 * Picker + manager for a library of saved and built-in items: apply, save as new, overwrite,
 * rename and delete. Used for presets and palettes.
 */
export function LibraryPicker({
  noun,
  icon,
  triggerLabel,
  current,
  saved,
  builtIn,
  activeId,
  triggerPreview,
  onApply,
  onSave,
  onOverwrite,
  onRename,
  onDelete,
}: LibraryPickerProps) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  const active = [...saved, ...builtIn.flatMap((g) => g.items)].find((i) => i.id === activeId);

  const apply = (id: string) => {
    onApply(id);
    setOpen(false);
  };
  const startNaming = () => {
    setOpen(false);
    setNaming(true);
  };
  const save = () => {
    onSave(name);
    setName("");
    setNaming(false);
  };
  const row = (item: LibraryItem, editable: boolean) => (
    <Row
      key={item.id}
      item={item}
      editable={editable}
      active={item.id === activeId}
      noun={noun}
      current={current}
      onApply={() => apply(item.id)}
      onOverwrite={() => onOverwrite(item.id)}
      onRename={(n) => onRename(item.id, n)}
      onDelete={() => onDelete(item.id)}
    />
  );

  if (naming) {
    return (
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
          placeholder={`${Noun} name`}
          aria-label={`New ${noun} name`}
          maxLength={40}
        />
        <IconButton icon="check" label={`Save ${noun}`} variant="outline" size="icon" side="bottom" type="submit" />
        <IconButton
          icon="close"
          label="Cancel"
          variant="outline"
          size="icon"
          side="bottom"
          onClick={() => setNaming(false)}
        />
      </form>
    );
  }

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={triggerLabel}
          className="flex h-8 min-w-0 flex-1 items-center gap-1.5 border border-input bg-zinc-950 px-2 text-left outline-none hover:border-zinc-700 hover:bg-zinc-900 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring data-popup-open:border-zinc-600"
        >
          <PixelIcon name={icon} scale={1} className="text-zinc-500" />
          <span className={cn("min-w-0 flex-1 truncate", !active && "text-zinc-500")}>
            {active?.name ?? "Custom"}
          </span>
          {triggerPreview}
          <PixelIcon name="chevron-down" scale={1} className="text-muted-foreground" />
        </PopoverTrigger>
        {/* Spans the trigger plus the save button next to it. */}
        <PopoverContent className="w-[calc(var(--anchor-width)+2.25rem)] pb-1" aria-label={`${Noun}s`}>
          <GroupLabel>Saved</GroupLabel>
          {saved.length === 0 ? (
            <p className="px-2 pb-1 text-zinc-600">Nothing saved yet.</p>
          ) : (
            <ul>{saved.map((item) => row(item, true))}</ul>
          )}
          {builtIn.map((group) => (
            <div key={group.label}>
              <GroupLabel>{group.label}</GroupLabel>
              <ul>{group.items.map((item) => row(item, false))}</ul>
            </div>
          ))}
          <div className="mx-1 mt-1 border-t border-zinc-800 pt-1">
            <button
              type="button"
              onClick={startNaming}
              className="flex h-7 w-full items-center gap-2 px-1 text-left text-zinc-400 outline-none hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:bg-zinc-800/60"
            >
              <PixelIcon name="plus" scale={1} />
              Save current as new {noun}…
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <IconButton
        icon="save"
        label={`Save as new ${noun}`}
        variant="outline"
        size="icon"
        side="bottom"
        onClick={startNaming}
      />
    </div>
  );
}
