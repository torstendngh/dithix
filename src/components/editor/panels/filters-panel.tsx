"use client";

import { useState } from "react";
import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { PixelText } from "@/components/icons/pixel-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/popover";
import { Switch } from "@/components/shared/switch";
import { FILTER_CATEGORIES, FILTERS, getFilter, GLITCH_GRADIENT, MAX_FILTERS, type ParamDef } from "@/lib/dither/filters";
import { bandSizes } from "@/lib/dither/gradient";
import type { FilterInstance } from "@/lib/dither/types";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldRow, IconButton, Segmented, SliderField } from "../fields";
import { Section } from "../section";

function ParamControl({ filter, param }: { filter: FilterInstance; param: ParamDef }) {
  const setFilterParam = useSettingsStore((s) => s.setFilterParam);
  const value = filter.params[param.key];
  const onChange = (v: number) => setFilterParam(filter.id, param.key, v);

  if (param.options) {
    return (
      <FieldRow label={param.label}>
        <Segmented
          aria-label={param.label}
          className="w-auto"
          value={value}
          options={param.options.map((o) => ({
            value: o.value,
            label: o.icon ? <PixelIcon name={o.icon as IconName} scale={1} /> : <PixelText>{o.label}</PixelText>,
            title: o.label,
          }))}
          onChange={onChange}
        />
      </FieldRow>
    );
  }
  return (
    <SliderField
      label={param.label}
      value={value}
      onChange={onChange}
      min={param.min}
      max={param.max}
      step={param.step}
      display={param.display}
      unit={param.unit}
      defaultValue={param.default}
    />
  );
}

/** Dot size per band of a glitch-gradient filter, lighter for bigger dots. */
function BandPreview({ params }: { params: Record<string, number> }) {
  const sizes = bandSizes({ startSize: params.startSize, endSize: params.endSize, bands: params.bands });
  const max = Math.max(...sizes);
  const min = Math.min(...sizes);
  return (
    <div className="flex h-3 border border-zinc-800" aria-hidden title="Dot size per band">
      {sizes.map((size, i) => {
        const shade = max === min ? 0.5 : (size - min) / (max - min);
        return (
          <span
            key={i}
            className="flex-1 border-r border-zinc-950 last:border-r-0"
            style={{ background: `color-mix(in oklab, var(--color-zinc-200) ${Math.round(15 + shade * 70)}%, transparent)` }}
          />
        );
      })}
    </div>
  );
}

function FilterCard({ filter, index, count }: { filter: FilterInstance; index: number; count: number }) {
  const def = getFilter(filter.type)!;
  const removeFilter = useSettingsStore((s) => s.removeFilter);
  const moveFilter = useSettingsStore((s) => s.moveFilter);
  const setFilterEnabled = useSettingsStore((s) => s.setFilterEnabled);
  const [expanded, setExpanded] = useState(true);

  return (
    <li className={cn("border border-zinc-800", !filter.enabled && "opacity-50")} data-filter={filter.type}>
      <div className="flex h-8 items-center gap-1.5 bg-zinc-900/60 pr-1 pl-2">
        <Switch
          size="sm"
          checked={filter.enabled}
          onCheckedChange={(enabled) => setFilterEnabled(filter.id, enabled)}
          aria-label={`Enable ${def.name}`}
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-zinc-200 outline-none focus-visible:underline"
          title={def.description}
        >
          <span className="text-zinc-600 tabular-nums">{index + 1}</span>
          <span className="truncate">{def.name}</span>
          {def.category === "glitch" && (
            <span className="border border-fuchsia-900 px-1 text-2xs leading-4 text-fuchsia-400">exp</span>
          )}
        </button>
        <IconButton icon="arrow-up" label="Move up" size="icon-xs" disabled={index === 0} onClick={() => moveFilter(filter.id, -1)} />
        <IconButton
          icon="arrow-down"
          label="Move down"
          size="icon-xs"
          disabled={index === count - 1}
          onClick={() => moveFilter(filter.id, 1)}
        />
        <IconButton icon="trash" label={`Remove ${def.name}`} size="icon-xs" onClick={() => removeFilter(filter.id)} />
      </div>
      {expanded && (
        <div className="grid gap-3 p-2.5">
          {def.params.map((p) => (
            <ParamControl key={p.key} filter={filter} param={p} />
          ))}
          {filter.type === GLITCH_GRADIENT && <BandPreview params={filter.params} />}
        </div>
      )}
    </li>
  );
}

function AddFilterMenu({ onAdded }: { onAdded: () => void }) {
  const addFilter = useSettingsStore((s) => s.addFilter);
  const filters = useSettingsStore((s) => s.settings.filters);
  const full = filters.length >= MAX_FILTERS;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Add filter"
        title={full ? `Up to ${MAX_FILTERS} filters` : "Add filter"}
        disabled={full}
        className="grid size-6 place-items-center text-zinc-400 outline-none hover:bg-zinc-900 hover:text-zinc-100 focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40 data-popup-open:bg-zinc-800 data-popup-open:text-zinc-100"
      >
        <PixelIcon name="plus" scale={1} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 pb-1" aria-label="Filters to add">
        {FILTER_CATEGORIES.map((cat) => (
          <div key={cat.id}>
            <div className="px-2 pt-2 pb-1 text-2xs tracking-widest text-zinc-500 uppercase">{cat.label}</div>
            <ul>
              {FILTERS.filter((f) => f.category === cat.id).map((f) => (
                <li key={f.type}>
                  <button
                    type="button"
                    disabled={f.unique && filters.some((x) => x.type === f.type)}
                    title={f.unique ? "Only one per stack" : undefined}
                    className="grid w-full gap-0.5 px-2 py-1.5 text-left outline-none hover:bg-zinc-800/60 focus-visible:bg-zinc-800/60 disabled:pointer-events-none disabled:opacity-40"
                    onClick={() => {
                      addFilter(f.type);
                      setOpen(false);
                      onAdded();
                    }}
                  >
                    <span className="text-zinc-200">{f.name}</span>
                    <span className="text-2xs leading-snug text-zinc-500">{f.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function FiltersPanel() {
  const filters = useSettingsStore((s) => s.settings.filters);
  const clearFilters = useSettingsStore((s) => s.clearFilters);
  const [open, setOpen] = useState(true);
  const active = filters.filter((f) => f.enabled).length;

  return (
    <Section
      title={filters.length ? `Filters · ${active}/${filters.length}` : "Filters"}
      icon="funnel"
      open={open}
      onOpenChange={setOpen}
      actions={
        <>
          {filters.length > 0 && (
            <IconButton icon="trash" label="Remove all filters" size="icon-xs" onClick={clearFilters} />
          )}
          <AddFilterMenu onAdded={() => setOpen(true)} />
        </>
      }
    >
      {filters.length === 0 ? (
        <p className="text-2xs leading-relaxed text-zinc-600">
          No filters yet. Add blur, glow, warps or glitches (including the glitch gradient) with + — they run in order, before dithering.
        </p>
      ) : (
        <ol className="grid gap-2">
          {filters.map((f, i) => (
            <FilterCard key={f.id} filter={f} index={i} count={filters.length} />
          ))}
        </ol>
      )}
    </Section>
  );
}
