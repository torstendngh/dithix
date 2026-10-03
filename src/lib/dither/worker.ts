/// <reference lib="webworker" />
import { ditherGradient, gradientFromFilters } from "./gradient";
import { ditherBuffer } from "./pipeline";
import { computeOutputSize, resample, resampleCanvas } from "./resize";
import type { DitherSettings, PixelBuffer } from "./types";

export type WorkerRequest =
  | { type: "source"; sourceId: number; bitmap: ImageBitmap }
  | { type: "process"; jobId: number; sourceId: number; settings: DitherSettings };

export type WorkerResponse =
  | { type: "result"; jobId: number; width: number; height: number; buffer: ArrayBuffer; duration: number }
  | { type: "error"; jobId: number; message: string };

let source: { id: number; pixels: PixelBuffer; bitmap: ImageBitmap } | null = null;
/** Resampled copies of the source by size + filter; gradients need several at once. */
const resized = new Map<string, PixelBuffer>();
const MAX_CACHED = 32;

function readBitmap(bitmap: ImageBitmap): PixelBuffer {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data, width, height };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "source") {
    source?.bitmap.close();
    // The bitmap is kept for the "canvas" resize filter.
    source = { id: msg.sourceId, pixels: readBitmap(msg.bitmap), bitmap: msg.bitmap };
    resized.clear();
    return;
  }

  try {
    if (!source || source.id !== msg.sourceId) throw new Error("Source image not loaded");
    const start = performance.now();
    const { width, height } = computeOutputSize(source.pixels.width, source.pixels.height, msg.settings.resize);
    // Resampling is the expensive part for large photos, so cache it per size and filter.
    const { filter } = msg.settings.resize;
    const src = source;
    const getResized = (w: number, h: number) => {
      const key = `${w}x${h}:${filter}`;
      let pixels = resized.get(key);
      if (!pixels) {
        pixels = filter === "canvas" ? resampleCanvas(src.bitmap, w, h) : resample(src.pixels, w, h, filter);
        if (resized.size >= MAX_CACHED) resized.delete(resized.keys().next().value!);
        resized.set(key, pixels);
      }
      return pixels;
    };
    const gradient = gradientFromFilters(msg.settings.filters);
    const out = gradient
      ? ditherGradient(getResized, width, height, msg.settings, gradient)
      : ditherBuffer(getResized(width, height), msg.settings);
    const buffer = out.data.buffer as ArrayBuffer;
    const response: WorkerResponse = {
      type: "result",
      jobId: msg.jobId,
      width: out.width,
      height: out.height,
      buffer,
      duration: performance.now() - start,
    };
    (self as unknown as Worker).postMessage(response, [buffer]);
  } catch (err) {
    const response: WorkerResponse = {
      type: "error",
      jobId: msg.jobId,
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
};
