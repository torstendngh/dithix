/// <reference lib="webworker" />
import { ditherGradient, gradientFromFilters } from "./gradient";
import { frameCount, settingsAtFrame } from "./motion";
import { ditherBuffer } from "./pipeline";
import { computeOutputSize, resample, resampleCanvas } from "./resize";
import type { DitherSettings, PixelBuffer } from "./types";

export type WorkerRequest =
  | { type: "source"; sourceId: number; bitmap: ImageBitmap }
  | { type: "process"; jobId: number; sourceId: number; settings: DitherSettings }
  /** Renders every frame of the motion loop, one per task; a newer animate or cancel stops it. */
  | { type: "animate"; animId: number; sourceId: number; settings: DitherSettings }
  | { type: "cancel-animation" };

export type WorkerResponse =
  | { type: "result"; jobId: number; width: number; height: number; buffer: ArrayBuffer; duration: number }
  | { type: "error"; jobId: number; message: string }
  | { type: "frame"; animId: number; index: number; total: number; width: number; height: number; buffer: ArrayBuffer }
  | { type: "animation-error"; animId: number; message: string };

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

/** Resampling is the expensive part for large photos, so it is cached per size and filter. */
function resampler(settings: DitherSettings) {
  const src = source!;
  const { filter } = settings.resize;
  return (w: number, h: number) => {
    const key = `${w}x${h}:${filter}`;
    let pixels = resized.get(key);
    if (!pixels) {
      pixels = filter === "canvas" ? resampleCanvas(src.bitmap, w, h) : resample(src.pixels, w, h, filter);
      if (resized.size >= MAX_CACHED) resized.delete(resized.keys().next().value!);
      resized.set(key, pixels);
    }
    return pixels;
  };
}

function render(settings: DitherSettings): PixelBuffer {
  const { width, height } = computeOutputSize(source!.pixels.width, source!.pixels.height, settings.resize);
  const getResized = resampler(settings);
  const gradient = gradientFromFilters(settings.filters);
  return gradient
    ? ditherGradient(getResized, width, height, settings, gradient)
    : ditherBuffer(getResized(width, height), settings);
}

const post = (msg: WorkerResponse, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(msg, transfer);

/** The animation being rendered; replaced (and so stopped) by any newer animate or cancel. */
let animation: { animId: number; sourceId: number; settings: DitherSettings; next: number; total: number } | null = null;

function renderNextFrame() {
  const job = animation;
  if (!job) return;
  try {
    if (!source || source.id !== job.sourceId) throw new Error("Source image not loaded");
    const out = render(settingsAtFrame(job.settings, job.next, job.total));
    const buffer = out.data.buffer as ArrayBuffer;
    post({ type: "frame", animId: job.animId, index: job.next, total: job.total, width: out.width, height: out.height, buffer }, [buffer]);
    job.next++;
    // Yield between frames so still-image jobs and cancellations get handled promptly.
    if (job.next < job.total) setTimeout(renderNextFrame, 0);
    else if (animation === job) animation = null;
  } catch (err) {
    post({ type: "animation-error", animId: job.animId, message: err instanceof Error ? err.message : String(err) });
    if (animation === job) animation = null;
  }
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
  if (msg.type === "cancel-animation") {
    animation = null;
    return;
  }
  if (msg.type === "animate") {
    const running = animation !== null;
    animation = { animId: msg.animId, sourceId: msg.sourceId, settings: msg.settings, next: 0, total: frameCount(msg.settings.motion) };
    // A loop already scheduled picks up the new job; otherwise start one.
    if (!running) setTimeout(renderNextFrame, 0);
    return;
  }

  try {
    if (!source || source.id !== msg.sourceId) throw new Error("Source image not loaded");
    const start = performance.now();
    const out = render(msg.settings);
    const buffer = out.data.buffer as ArrayBuffer;
    post({ type: "result", jobId: msg.jobId, width: out.width, height: out.height, buffer, duration: performance.now() - start }, [buffer]);
  } catch (err) {
    post({ type: "error", jobId: msg.jobId, message: err instanceof Error ? err.message : String(err) });
  }
};
