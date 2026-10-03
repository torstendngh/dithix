import { rgbToHex } from "./dither/color";
import type { RGB } from "./dither/types";

/**
 * Turns whatever someone types or pastes into an opaque "#rrggbb", or null when it isn't a colour.
 *
 * Handled here (so it works anywhere, including tests): hex with or without "#"/"0x" in 3, 4, 6
 * or 8 digits, `rgb()`/`rgba()` and `hsl()`/`hsla()` in comma or space syntax with percentages and
 * angle units. Anything else — named colours, `hwb()`, `lab()`, `oklch()`, `color(display-p3 …)` —
 * goes through the browser's own parser and is gamut-mapped to sRGB. Alpha is dropped: the
 * dither works on opaque colours, so "#ff000080" means plain red.
 */
export function parseColor(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  return parseHex(s) ?? parseRgbFn(s) ?? parseHslFn(s) ?? parseWithBrowser(s);
}

function parseHex(s: string): string | null {
  const m = /^(?:#|0x)?([0-9a-f]{3,8})$/.exec(s);
  if (!m) return null;
  const h = m[1];
  if (h.length === 3 || h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
  return null;
}

/** Splits "a, b, c / d", "a b c / d" or "a,b,c,d" into [a, b, c] (alpha ignored). */
function fnArgs(s: string, names: string[]): string[] | null {
  const m = /^([a-z]+)\((.*)\)$/.exec(s);
  if (!m || !names.includes(m[1])) return null;
  const parts = m[2].split("/")[0].trim().split(/\s*,\s*|\s+/).filter(Boolean);
  return parts.length === 3 || parts.length === 4 ? parts.slice(0, 3) : null;
}

const num = (v: string) => (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/.test(v) ? Number(v) : NaN);

/** "50%" → 0.5 × scale, "128" → 128; NaN when malformed. */
function channel(v: string, scale: number): number {
  return v.endsWith("%") ? (num(v.slice(0, -1)) / 100) * scale : num(v);
}

function parseRgbFn(s: string): string | null {
  const args = fnArgs(s, ["rgb", "rgba"]);
  if (!args) return null;
  const rgb = args.map((a) => channel(a, 255));
  return rgb.every(Number.isFinite) ? rgbToHex(rgb.map((v) => Math.round(clamp255(v))) as RGB) : null;
}

function angle(v: string): number {
  const m = /^(.*?)(deg|grad|rad|turn)?$/.exec(v)!;
  const n = num(m[1]);
  switch (m[2]) {
    case "grad":
      return (n * 360) / 400;
    case "rad":
      return (n * 180) / Math.PI;
    case "turn":
      return n * 360;
    default:
      return n;
  }
}

function parseHslFn(s: string): string | null {
  const args = fnArgs(s, ["hsl", "hsla"]);
  if (!args) return null;
  const h = angle(args[0]);
  const sat = channel(args[1].endsWith("%") ? args[1] : `${args[1]}%`, 1);
  const l = channel(args[2].endsWith("%") ? args[2] : `${args[2]}%`, 1);
  if (![h, sat, l].every(Number.isFinite)) return null;
  return rgbToHex(hslToRgb(h, Math.min(1, Math.max(0, sat)), Math.min(1, Math.max(0, l))));
}

let probe: CanvasRenderingContext2D | null | undefined;

/** Any other CSS colour, via a 1×1 canvas: the browser parses it and maps it into sRGB. */
function parseWithBrowser(s: string): string | null {
  if (typeof document === "undefined" || typeof CSS === "undefined" || !CSS.supports("color", s)) return null;
  if (probe === undefined) {
    probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = s;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  // Fully transparent ("transparent", alpha 0) carries no colour to keep.
  return a === 0 ? null : rgbToHex([r, g, b]);
}

const clamp255 = (v: number) => Math.min(255, Math.max(0, v));

export function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Hue 0..360, saturation and value 0..1. */
export interface HSV {
  h: number;
  s: number;
  v: number;
}

export function rgbToHsv([r, g, b]: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
