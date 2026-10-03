"use client";

import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/popover";
import { hexToRgb, isHex, rgbToHex } from "@/lib/dither/color";
import { hsvToRgb, parseColor, rgbToHsv, type HSV } from "@/lib/color-parse";
import { cn } from "@/lib/tailwind-utils";
import { useUiStore } from "@/stores/ui-store";

const toHex = (hsv: HSV) => rgbToHex(hsvToRgb(hsv));
const toHsv = (hex: string) => rgbToHsv(hexToRgb(isHex(hex) ? hex : "#000000"));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface ColorPickerProps {
  value: string;
  /** Called live while dragging, typing a valid colour or picking a swatch. */
  onChange: (hex: string) => void;
  /** The element that opens the picker (rendered as the popover trigger). */
  trigger: React.ReactElement;
  /** Accessible name for the picker, e.g. "Palette colour 3". */
  label: string;
  /** Quick picks, e.g. the current palette, so a background can use palette colours. */
  palette?: string[];
}

/**
 * Colour picker popover: saturation/value square, hue strip, a text field that accepts hex, rgb(),
 * hsl(), names and any other CSS colour (see `parseColor`), plus palette and recent swatches.
 * A colour joins "recent" when the picker closes with a different colour than it opened with.
 */
export function ColorPicker({ value, onChange, trigger, label, palette }: ColorPickerProps) {
  const recent = useUiStore((s) => s.recentColors);
  const addRecentColor = useUiStore((s) => s.addRecentColor);
  const [open, setOpen] = useState(false);
  const opened = useRef(value);

  // HSV is kept separately so hue and saturation survive greys and black (where hex loses them).
  const [hsv, setHsv] = useState(() => toHsv(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (toHex(hsv) !== value.toLowerCase()) setHsv(toHsv(value));
  }

  const [text, setText] = useState<string | null>(null);
  const parsed = text === null ? null : parseColor(text);

  const setFromHsv = (next: HSV) => {
    setHsv(next);
    setText(null);
    const hex = toHex(next);
    setSeen(hex);
    onChange(hex);
  };
  const setFromHex = (hex: string) => {
    setHsv(toHsv(hex));
    setSeen(hex);
    setText(null);
    onChange(hex);
  };
  const commitText = () => {
    if (text === null) return;
    if (parsed) setFromHex(parsed);
    else setText(null); // invalid: fall back to the current colour
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          opened.current = value;
          setText(null);
        } else if (value.toLowerCase() !== opened.current.toLowerCase()) {
          addRecentColor(value);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger render={trigger} />
      {/* End-aligned: triggers sit at the right of the sidebar, so a start-aligned popup runs off-screen. */}
      <PopoverContent align="end" className="grid w-60 grid-cols-[minmax(0,1fr)] gap-2 p-2" aria-label={label}>
        <SaturationValue hsv={hsv} onChange={setFromHsv} />
        <Hue hsv={hsv} onChange={setFromHsv} />

        <div className="flex items-center gap-1.5">
          <div className="flex h-7 w-10 shrink-0 border border-zinc-700" title="Before → now">
            <span className="flex-1" style={{ background: opened.current }} />
            <span className="flex-1" style={{ background: value }} />
          </div>
          <input
            value={text ?? value}
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape" && text !== null) {
                e.stopPropagation();
                setText(null);
              }
            }}
            onPaste={(e) => {
              // A pasted colour applies straight away.
              const hex = parseColor(e.clipboardData.getData("text"));
              if (hex) {
                e.preventDefault();
                setFromHex(hex);
              }
            }}
            spellCheck={false}
            autoComplete="off"
            aria-label={`${label} value`}
            aria-invalid={text !== null && !parsed}
            placeholder="#rrggbb, rgb(), hsl(), name…"
            className="h-7 min-w-0 flex-1 border border-input bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus-visible:border-ring aria-invalid:border-red-700"
          />
        </div>
        {text !== null && (
          <p className={cn("text-2xs leading-snug", parsed ? "text-zinc-500" : "text-red-400")}>
            {parsed ? (
              <>
                Enter to use <span className="text-zinc-300">{parsed}</span>
              </>
            ) : (
              "Not a colour. Try #f80, rgb(255 136 0), hsl(32 100% 50%) or orange."
            )}
          </p>
        )}

        {palette && palette.length > 0 && <SwatchRow title="Palette" colors={palette} current={value} onPick={setFromHex} />}
        {recent.length > 0 && <SwatchRow title="Recent" colors={recent} current={value} onPick={setFromHex} />}
      </PopoverContent>
    </Popover>
  );
}

function SwatchRow({ title, colors, current, onPick }: { title: string; colors: string[]; current: string; onPick: (hex: string) => void }) {
  return (
    <div className="grid gap-1">
      <span className="text-2xs tracking-widest text-zinc-500 uppercase">{title}</span>
      <div className="grid grid-cols-8 gap-1">
        {colors.map((c, i) => (
          <button
            key={`${c}-${i}`}
            type="button"
            title={c}
            aria-label={`${title} ${c}`}
            aria-pressed={c.toLowerCase() === current.toLowerCase()}
            onClick={() => onPick(c.toLowerCase())}
            className="aspect-square border border-zinc-700 outline-none hover:border-zinc-300 focus-visible:border-zinc-100 aria-pressed:border-zinc-100"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

/** Pointer drag inside an element, reporting the position as 0..1 fractions. */
function useDrag(onMove: (x: number, y: number) => void) {
  const report = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onMove(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height));
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      report(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) report(e);
    },
  };
}

function SaturationValue({ hsv, onChange }: { hsv: HSV; onChange: (hsv: HSV) => void }) {
  const drag = useDrag((x, y) => onChange({ ...hsv, s: x, v: 1 - y }));
  const step = (ds: number, dv: number) => onChange({ ...hsv, s: clamp01(hsv.s + ds), v: clamp01(hsv.v + dv) });
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      aria-valuenow={Math.round(hsv.s * 100)}
      onKeyDown={(e) => {
        const d = e.shiftKey ? 0.1 : 0.01;
        const moves: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
        if (moves[e.key]) {
          e.preventDefault();
          step(...moves[e.key]);
        }
      }}
      className="relative h-36 cursor-crosshair touch-none border border-zinc-700 outline-none focus-visible:border-zinc-100"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h} 100% 50%)`,
      }}
    >
      <span
        className="pointer-events-none absolute size-2.5 -translate-1/2 border border-white shadow-[0_0_0_1px_#000]"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: toHex(hsv) }}
      />
    </div>
  );
}

function Hue({ hsv, onChange }: { hsv: HSV; onChange: (hsv: HSV) => void }) {
  const drag = useDrag((x) => onChange({ ...hsv, h: Math.min(359.9, x * 360) }));
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hsv.h)}
      onKeyDown={(e) => {
        const d = (e.shiftKey ? 10 : 1) * (e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1);
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
          onChange({ ...hsv, h: (hsv.h + d + 360) % 360 });
        }
      }}
      className="relative h-3 cursor-ew-resize touch-none border border-zinc-700 outline-none focus-visible:border-zinc-100"
      style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
    >
      <span
        className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-1/2 border border-white shadow-[0_0_0_1px_#000]"
        style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }}
      />
    </div>
  );
}
