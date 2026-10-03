import type { PixelBuffer } from "./dither/types";

/** Hardware encoders commonly top out around 4K; stay under it. */
const MAX_VIDEO_SIDE = 3840;
// H.264 first: it plays everywhere. VP9/AV1 in MP4 cover browsers that can't encode it.
const CODECS = ["avc", "vp9", "av1"] as const;

const even = (v: number) => v + (v % 2);

/** Upscale used for video: at least 2× (chroma subsampling smears single pixels), within limits. */
export function videoScale(width: number, height: number, requested: number): number {
  const fit = Math.max(1, Math.floor(MAX_VIDEO_SIDE / Math.max(width, height, 1)));
  return Math.max(1, Math.min(Math.max(2, requested), fit));
}

/** Whether this browser can encode MP4 at all (WebCodecs plus a usable codec). */
export async function canEncodeMp4(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  const { canEncodeVideo } = await import("mediabunny");
  for (const codec of CODECS) if (await canEncodeVideo(codec, { width: 640, height: 480 })) return true;
  return false;
}

/**
 * Encodes one pass of the loop as MP4. Frames are drawn nearest-neighbour onto an even-sized
 * canvas over `background` (video has no alpha) and timed exactly at `fps`.
 */
export async function encodeMp4(frames: PixelBuffer[], fps: number, scale: number, background: string): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, QUALITY_VERY_HIGH, canEncodeVideo } = await import(
    "mediabunny"
  );
  const { width, height } = frames[0];
  const s = videoScale(width, height, scale);
  const w = even(width * s);
  const h = even(height * s);

  let codec: (typeof CODECS)[number] | null = null;
  for (const c of CODECS) {
    if (await canEncodeVideo(c, { width: w, height: h, frameRate: fps })) {
      codec = c;
      break;
    }
  }
  if (!codec) throw new Error("This browser can't encode video. Try GIF instead.");

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  // Each frame goes onto a 1:1 canvas first, then is scaled up crisply in one draw.
  const frameCanvas = new OffscreenCanvas(width, height);
  const frameCtx = frameCanvas.getContext("2d")!;

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_VERY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    frameCtx.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.width, f.height), 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(frameCanvas, 0, 0, width * s, height * s);
    await source.add(i / fps, 1 / fps);
  }
  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("Video encoding produced no data");
  return new Blob([buffer], { type: "video/mp4" });
}
