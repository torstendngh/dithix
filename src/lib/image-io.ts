import { upscaleNearest, toSvg } from "@/lib/dither/export";
import type { ExportSettings, PixelBuffer } from "@/lib/dither/types";
import type { SourceImage } from "@/stores/workspace-store";

const SAMPLE_SIZE = 256;
/** Browsers start failing to allocate canvases beyond this side length. */
export const MAX_EXPORT_SIDE = 16384;

function readSample(bitmap: ImageBitmap): PixelBuffer {
  const s = Math.min(1, SAMPLE_SIZE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * s));
  const height = Math.max(1, Math.round(bitmap.height * s));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, data };
}

export async function loadImage(blob: Blob, name: string): Promise<Omit<SourceImage, "id">> {
  if (!blob.type.startsWith("image/")) throw new Error(`${name} is not an image`);
  const bitmap = await createImageBitmap(blob);
  return { name, width: bitmap.width, height: bitmap.height, bitmap, sample: readSample(bitmap) };
}

/** Procedural test image so the app can be tried without uploading anything. */
export async function createSampleImage(): Promise<Omit<SourceImage, "id">> {
  const width = 960;
  const height = 640;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0b1d3a");
  sky.addColorStop(0.55, "#e07a5f");
  sky.addColorStop(0.75, "#f2cc8f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sun = ctx.createRadialGradient(width * 0.68, height * 0.55, 10, width * 0.68, height * 0.55, 160);
  sun.addColorStop(0, "rgba(255,250,220,1)");
  sun.addColorStop(0.35, "rgba(255,210,120,0.9)");
  sun.addColorStop(1, "rgba(255,160,90,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width, height);

  const ridge = (base: number, amp: number, freq: number, phase: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 4) {
      const y = base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 1.3) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(height * 0.62, 40, 0.008, 1, "#3d405b");
  ridge(height * 0.72, 30, 0.012, 3, "#2a2c45");
  ridge(height * 0.84, 22, 0.017, 5, "#14152a");

  // Grey ramp along the bottom for judging tone reproduction.
  for (let i = 0; i < 16; i++) {
    const v = Math.round((i / 15) * 255);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect((i * width) / 16, height - 48, width / 16 + 1, 48);
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render sample"))), "image/png"),
  );
  return loadImage(blob, "sample.png");
}

export function maxExportScale(width: number, height: number): number {
  return Math.max(1, Math.floor(MAX_EXPORT_SIDE / Math.max(width, height, 1)));
}

export function exportFileName(sourceName: string, format: ExportSettings["format"]): string {
  const base = sourceName.replace(/\.[^.]+$/, "") || "image";
  return `${base}-dithix.${format}`;
}

export async function renderExport(
  result: ImageData,
  settings: ExportSettings,
  background: string,
): Promise<Blob> {
  const scale = Math.min(settings.scale, maxExportScale(result.width, result.height));
  if (settings.format === "svg") {
    return new Blob([toSvg(result, scale)], { type: "image/svg+xml" });
  }
  const up = upscaleNearest(result, scale);
  const canvas = document.createElement("canvas");
  canvas.width = up.width;
  canvas.height = up.height;
  const ctx = canvas.getContext("2d")!;
  const image = new ImageData(new Uint8ClampedArray(up.data), up.width, up.height);
  if (settings.format === "jpg") {
    // JPG has no alpha: composite transparent areas over the first palette colour.
    const layer = document.createElement("canvas");
    layer.width = up.width;
    layer.height = up.height;
    layer.getContext("2d")!.putImageData(image, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, up.width, up.height);
    ctx.drawImage(layer, 0, 0);
  } else {
    ctx.putImageData(image, 0, 0);
  }
  const type = settings.format === "jpg" ? "image/jpeg" : "image/png";
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export failed — try a smaller scale"))),
      type,
      settings.quality,
    ),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
