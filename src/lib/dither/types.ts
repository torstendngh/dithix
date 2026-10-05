/** Minimal ImageData-compatible shape so the engine runs outside the DOM (worker, tests). */
export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type RGB = [number, number, number];

export type ResizeMode = "scale" | "width" | "height";

/**
 * "area" averages every covered source pixel (smooth), "bilinear" samples 2×2 neighbours (sharper),
 * "canvas" lets the browser's `drawImage` resize (matches web tools that do the same).
 */
export type ResizeFilter = "area" | "bilinear" | "canvas";

export interface ResizeSettings {
  mode: ResizeMode;
  /** Percent of the source size, 1–100. */
  scale: number;
  width: number;
  height: number;
  filter: ResizeFilter;
}

export interface CurvePoint {
  x: number;
  y: number;
}

export type CurveChannel = "master" | "r" | "g" | "b";

export type Curves = Record<CurveChannel, CurvePoint[]>;

export interface AdjustSettings {
  /** -100..100 */
  brightness: number;
  /** -100..100 */
  contrast: number;
  /** 0.1..3, 1 = neutral */
  gamma: number;
  /** -100..100, -100 = grayscale */
  saturation: number;
  /** Hue rotation in degrees, -180..180. */
  hue: number;
  invert: boolean;
  curves: Curves;
}

export type ColorDistance = "rgb" | "redmean" | "luma";

export interface PaletteSettings {
  /** Preset palette id or null once edited by hand. */
  presetId: string | null;
  colors: string[];
  distance: ColorDistance;
}

export type AlgorithmKind = "threshold" | "ordered" | "diffusion" | "curve";

export type AlgorithmId =
  | "threshold"
  | "bayer2"
  | "bayer4"
  | "bayer8"
  | "bayer16"
  | "bayer32"
  | "cluster4"
  | "cluster8"
  | "halftone"
  | "lines-h"
  | "lines-v"
  | "lines-d"
  | "blue-noise"
  | "ign"
  | "white-noise"
  | "floyd-steinberg"
  | "false-floyd-steinberg"
  | "jarvis-judice-ninke"
  | "stucki"
  | "burkes"
  | "sierra3"
  | "sierra2"
  | "sierra-lite"
  | "atkinson"
  | "riemersma";

export type SpreadMode = "auto" | "fixed";

export interface DitherOptions {
  algorithm: AlgorithmId;
  /** Ordered (auto spread): multiplier 0..2. Diffusion: fraction of error carried 0..1. */
  strength: number;
  /** Ordered: "auto" derives the threshold range from palette spacing, "fixed" uses `spread`. */
  spreadMode: SpreadMode;
  /** Ordered, fixed mode: threshold range in 0..255 channel units. */
  spread: number;
  /** Ordered: shifts thresholds by a fraction of the spread, -1..1. 0 = centred, 0.5 = additive only. */
  bias: number;
  /** Ordered: flip the threshold map across its diagonal. */
  transpose: boolean;
  serpentine: boolean;
  seed: number;
  /**
   * Ordered: shifts the threshold pattern by this many pixels. Set per frame by motion's pattern
   * crawl and never stored, so it is not part of the defaults.
   */
  offsetX?: number;
  offsetY?: number;
}

export type GradientDirection = "right" | "left" | "down" | "up" | "radial";

/**
 * Glitch gradient: dot size grows in bands along a direction, optionally dissolving from the
 * undithered image into the dither. Sizes are in output pixels (the resize settings set the grid).
 * Lives in the filter stack as a "glitch-gradient" filter; see `gradientFromFilters`.
 */
export interface GradientSettings {
  direction: GradientDirection;
  startSize: number;
  endSize: number;
  /** Number of size steps, 2..24. */
  bands: number;
  /** Where the transition runs along the direction, 0..1. */
  from: number;
  to: number;
  /** Start from the undithered image and dissolve into the dither. */
  fadeIn: boolean;
  /** Random jitter of each dot's position along the gradient, 0..1 of its length. Hides band edges. */
  scatter: number;
  seed: number;
}

/** One entry in the filter stack. Params are numbers; meanings come from the filter registry. */
export interface FilterInstance {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, number>;
}

export type BackgroundMode = "solid" | "checker" | "stripes" | "dots" | "grid" | "gradient" | "pattern";

/** A hand-drawn tile for the "pattern" background. */
export interface BackgroundPattern {
  /** Tile width and height in cells, 2..16. */
  size: number;
  /** Row-major, one "0" (colour A) or "1" (colour B) per cell. */
  cells: string;
  /** Output pixels per cell, 1..16. */
  scale: number;
}

/** Crop window on the source image, normalised to 0..1 of its width and height. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fill for transparent areas, composited before filters and dithering. */
export interface BackgroundSettings {
  /** Off leaves transparent areas transparent. */
  enabled: boolean;
  /** Margin around the image in output pixels; it is transparent, so the fill shows there. */
  padding: number;
  mode: BackgroundMode;
  colorA: string;
  colorB: string;
  /** Pattern cell size in output pixels. */
  size: number;
  pattern: BackgroundPattern;
}

export type CrawlDirection = "right" | "left" | "down" | "up";

/**
 * Looping animation. Every effect is a function of the loop position t ∈ [0, 1) that returns to
 * its start at t = 1, so the last frame flows into the first.
 */
export interface MotionSettings {
  enabled: boolean;
  /** Loop length in seconds. */
  duration: number;
  fps: number;
  /** Pattern crawl: ordered-dither pattern movement in pixels per frame, 0 = still. */
  crawl: number;
  crawlDirection: CrawlDirection;
  /** Whole turns of the hue wheel per loop, negative = backwards. */
  hueTurns: number;
  /** Brightness pulse amplitude, 0..60 (brightness units). */
  pulse: number;
  /** Re-roll noise and glitch seeds every this many frames; 0 = off. */
  boil: number;
  /** Advance filter phases (wave, swirl, RGB split, TV glitch band…) over the loop. */
  animateFilters: boolean;
}

export interface DitherSettings {
  resize: ResizeSettings;
  adjust: AdjustSettings;
  dither: DitherOptions;
  palette: PaletteSettings;
  /** Applied in order after adjustments and background, before dithering. */
  filters: FilterInstance[];
  background: BackgroundSettings;
  motion: MotionSettings;
}

/** "gif" and "mp4" export the motion loop; "svg" is animated while motion is on. */
export type ExportFormat = "png" | "jpg" | "svg" | "gif" | "mp4";

export interface ExportSettings {
  format: ExportFormat;
  /** Integer nearest-neighbour upscale applied to the dithered image. */
  scale: number;
  /** JPG quality 0..1 */
  quality: number;
}
