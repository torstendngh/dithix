import { rgbToHex } from "./color";
import type { PixelBuffer, RGB } from "./types";

export interface PalettePreset {
  id: string;
  name: string;
  colors: string[];
}

const grayscale = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const v = Math.round((i * 255) / (n - 1));
    return rgbToHex([v, v, v]);
  });

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: "1bit", name: "1-bit", colors: ["#000000", "#ffffff"] },
  { id: "zinc", name: "Zinc", colors: ["#09090b", "#fafafa"] },
  { id: "obra-dinn", name: "Obra Dinn", colors: ["#333319", "#e5ffff"] },
  {
    id: "zinc-mint",
    name: "Zinc Mint",
    colors: ["#27272a", "#3f3f46", "#52525b", "#60ffd3", "#18181b"],
  },
  { id: "gray4", name: "Gray 4", colors: grayscale(4) },
  { id: "gray8", name: "Gray 8", colors: grayscale(8) },
  { id: "gray16", name: "Gray 16", colors: grayscale(16) },
  { id: "gameboy", name: "Game Boy", colors: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { id: "amber", name: "Amber CRT", colors: ["#0d0700", "#4d2a00", "#b36200", "#ffb000"] },
  { id: "green", name: "Green CRT", colors: ["#001100", "#004400", "#00aa00", "#33ff33"] },
  { id: "sepia", name: "Sepia", colors: ["#2b1d0e", "#6b4a2b", "#b08d63", "#efe0c2"] },
  { id: "cga", name: "CGA", colors: ["#000000", "#55ffff", "#ff55ff", "#ffffff"] },
  {
    id: "rgb8",
    name: "3-bit RGB",
    colors: ["#000000", "#ff0000", "#00ff00", "#0000ff", "#00ffff", "#ff00ff", "#ffff00", "#ffffff"],
  },
  { id: "cmyk", name: "CMYK", colors: ["#ffffff", "#00ffff", "#ff00ff", "#ffff00", "#000000"] },
  {
    id: "ega",
    name: "EGA",
    colors: [
      "#000000", "#0000aa", "#00aa00", "#00aaaa", "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
      "#555555", "#5555ff", "#55ff55", "#55ffff", "#ff5555", "#ff55ff", "#ffff55", "#ffffff",
    ],
  },
  {
    id: "zx",
    name: "ZX Spectrum",
    colors: [
      "#000000", "#0000d7", "#d70000", "#d700d7", "#00d700", "#00d7d7", "#d7d700", "#d7d7d7",
      "#0000ff", "#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#ffff00", "#ffffff",
    ],
  },
  {
    id: "c64",
    name: "Commodore 64",
    colors: [
      "#000000", "#ffffff", "#68372b", "#70a4b2", "#6f3d86", "#588d43", "#352879", "#b8c76f",
      "#6f4f25", "#433900", "#9a6759", "#444444", "#6c6c6c", "#9ad284", "#6c5eb5", "#959595",
    ],
  },
  {
    id: "pico8",
    name: "PICO-8",
    colors: [
      "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
      "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa",
    ],
  },
  {
    id: "sweetie16",
    name: "Sweetie 16",
    colors: [
      "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179",
      "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
    ],
  },
];

export function getPalettePreset(id: string | null): PalettePreset | undefined {
  return PALETTE_PRESETS.find((p) => p.id === id);
}

/**
 * Median-cut palette extraction. Samples at most ~64k pixels, ignores transparent ones.
 */
export function extractPalette(image: PixelBuffer, count: number): string[] {
  const { data } = image;
  const total = data.length / 4;
  const step = Math.max(1, Math.floor(total / 65536));
  const pixels: RGB[] = [];
  for (let i = 0; i < total; i += step) {
    const p = i * 4;
    if (data[p + 3] < 128) continue;
    pixels.push([data[p], data[p + 1], data[p + 2]]);
  }
  if (pixels.length === 0) return ["#000000"];

  type Box = { pixels: RGB[]; channel: number; range: number };
  const describe = (px: RGB[]): Box => {
    const min = [255, 255, 255];
    const max = [0, 0, 0];
    for (const p of px) {
      for (let c = 0; c < 3; c++) {
        if (p[c] < min[c]) min[c] = p[c];
        if (p[c] > max[c]) max[c] = p[c];
      }
    }
    const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const channel = ranges.indexOf(Math.max(...ranges));
    return { pixels: px, channel, range: ranges[channel] };
  };

  const boxes: Box[] = [describe(pixels)];
  while (boxes.length < count) {
    // Split the box with the widest range weighted by population.
    let target = -1;
    let score = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const s = b.range * Math.sqrt(b.pixels.length);
      if (b.pixels.length > 1 && b.range > 0 && s > score) {
        score = s;
        target = i;
      }
    }
    if (target === -1) break;
    const box = boxes[target];
    const c = box.channel;
    box.pixels.sort((a, b) => a[c] - b[c]);
    const mid = box.pixels.length >> 1;
    boxes.splice(target, 1, describe(box.pixels.slice(0, mid)), describe(box.pixels.slice(mid)));
  }

  const colors = boxes.map((b) => {
    const sum = [0, 0, 0];
    for (const p of b.pixels) {
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
    }
    const n = b.pixels.length;
    return [sum[0] / n, sum[1] / n, sum[2] / n] as RGB;
  });

  colors.sort((a, b) => a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114 - (b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114));
  return [...new Set(colors.map(rgbToHex))];
}
