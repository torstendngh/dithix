import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { fitAspect, normalizedAspect } from "@/lib/crop-math";
import { FULL_CROP } from "@/lib/dither/frame";
import type { CropRect, PixelBuffer } from "@/lib/dither/types";
import {
  clampView,
  fitZoom,
  nextZoomStep,
  zoomAround,
  type Size,
  type View,
} from "@/lib/viewport-math";

export interface SourceImage {
  /** Bumped on every load so consumers can tell images apart. */
  id: number;
  name: string;
  width: number;
  height: number;
  bitmap: ImageBitmap;
  /** Small downscaled copy for palette extraction. */
  sample: PixelBuffer;
}

type Point = { x: number; y: number };

interface WorkspaceState {
  source: SourceImage | null;
  result: ImageData | null;
  processing: boolean;
  /** Milliseconds the last dither pass took. */
  duration: number;
  error: string | null;
  compare: boolean;

  /** Rendered motion loop frames, in order; complete when `frames.length === frameTotal`. */
  frames: ImageData[];
  /** Frames in the loop being rendered, 0 when motion is off. */
  frameTotal: number;
  /** Whether the viewport plays the loop (when complete) instead of the still. */
  playing: boolean;
  /** Frame shown when paused, and where new keyframes go. Advances during playback. */
  playhead: number;
  /** The keyframable setting changed most recently (see keyframes.ts), for "Key last change". */
  lastChange: string | null;
  /** An export is being encoded. */
  exporting: boolean;

  /** Crop window on the current image (normalised). Per image, so it is not part of presets. */
  crop: CropRect;
  /** Locked crop shape as pixel width/height; 0 = free. */
  cropAspect: number;
  /** Crop mode: the viewport shows the whole source with an editable crop box. */
  cropping: boolean;

  /** While true the image is fitted to the viewport and `view` is ignored. */
  fit: boolean;
  view: View;
  viewport: Size;

  setSource: (source: Omit<SourceImage, "id">) => void;
  setResult: (result: ImageData, duration: number) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  setCompare: (compare: boolean) => void;
  /** Starts collecting a new loop of `total` frames (0 clears it). */
  resetFrames: (total: number) => void;
  addFrame: (index: number, frame: ImageData) => void;
  setPlaying: (playing: boolean) => void;
  setPlayhead: (frame: number) => void;
  setLastChange: (path: string | null) => void;
  setExporting: (exporting: boolean) => void;

  setCrop: (crop: CropRect) => void;
  /** Locks (or frees, with 0) the crop shape, refitting the crop to it. */
  setCropAspect: (aspect: number) => void;
  /** Back to the full image, keeping a locked shape (crop mode's Reset). */
  resetCrop: () => void;
  /** Removes the crop entirely: full image and a free shape. */
  clearCrop: () => void;
  /** Commits the crop dialog's draft in one update (a single re-render) and closes it. */
  applyCrop: (crop: CropRect, aspect: number) => void;
  setCropping: (cropping: boolean) => void;

  setViewport: (size: Size) => void;
  fitView: () => void;
  /** Anchor is relative to the viewport centre; defaults to the centre. */
  zoomTo: (zoom: number, anchor?: Point) => void;
  zoomBy: (factor: number, anchor?: Point) => void;
  stepZoom: (direction: 1 | -1) => void;
  panBy: (dx: number, dy: number) => void;
}

const imageSize = (s: { result: ImageData | null }): Size =>
  s.result ? { width: s.result.width, height: s.result.height } : { width: 0, height: 0 };

/** The view actually on screen, resolving fit mode. */
export function currentView(s: Pick<WorkspaceState, "fit" | "view" | "viewport" | "result">): View {
  return s.fit ? { zoom: fitZoom(imageSize(s), s.viewport), x: 0, y: 0 } : s.view;
}

let sourceCounter = 0;

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => {
    /** Applies a view change starting from what is on screen, leaving fit mode. */
    const update = (fn: (view: View, s: WorkspaceState) => View) =>
      set((s) => {
        if (!s.result) return;
        s.view = clampView(fn(currentView(s), s as WorkspaceState), imageSize(s), s.viewport);
        s.fit = false;
      });

    return {
      source: null,
      result: null,
      processing: false,
      duration: 0,
      error: null,
      compare: false,
      frames: [],
      frameTotal: 0,
      playing: true,
      playhead: 0,
      lastChange: null,
      exporting: false,
      crop: { ...FULL_CROP },
      cropAspect: 0,
      cropping: false,
      fit: true,
      view: { zoom: 1, x: 0, y: 0 },
      viewport: { width: 0, height: 0 },

      setSource: (source) =>
        set((s) => {
          s.source?.bitmap.close();
          s.source = { ...source, id: ++sourceCounter };
          s.result = null;
          s.error = null;
          s.fit = true;
          s.frames = [];
          s.frameTotal = 0;
          // A new image starts uncropped; a locked shape carries over.
          s.crop = s.cropAspect ? fitAspect({ ...FULL_CROP }, normalizedAspect(s.cropAspect, source.width, source.height)) : { ...FULL_CROP };
          s.cropping = false;
        }),
      setResult: (result, duration) =>
        set((s) => {
          s.result = result;
          s.duration = duration;
          s.error = null;
          // Output size can change (resolution settings); keep the image reachable.
          if (!s.fit) s.view = clampView(s.view, imageSize(s), s.viewport);
        }),
      setProcessing: (processing) =>
        set((s) => {
          s.processing = processing;
        }),
      setError: (error) =>
        set((s) => {
          s.error = error;
        }),
      setCompare: (compare) =>
        set((s) => {
          s.compare = compare;
        }),
      resetFrames: (total) =>
        set((s) => {
          s.frames = [];
          s.frameTotal = total;
        }),
      addFrame: (index, frame) =>
        set((s) => {
          // Frames arrive in order; anything else belongs to a superseded loop.
          if (index === s.frames.length && index < s.frameTotal) s.frames.push(frame);
        }),
      setPlaying: (playing) =>
        set((s) => {
          s.playing = playing;
        }),
      setPlayhead: (frame) =>
        set((s) => {
          s.playhead = Math.max(0, Math.round(frame));
        }),
      setLastChange: (path) =>
        set((s) => {
          s.lastChange = path;
        }),
      setExporting: (exporting) =>
        set((s) => {
          s.exporting = exporting;
        }),

      setCrop: (crop) =>
        set((s) => {
          s.crop = crop;
        }),
      setCropAspect: (aspect) =>
        set((s) => {
          s.cropAspect = aspect;
          if (aspect > 0 && s.source) s.crop = fitAspect(s.crop, normalizedAspect(aspect, s.source.width, s.source.height));
        }),
      resetCrop: () =>
        set((s) => {
          s.crop =
            s.cropAspect && s.source
              ? fitAspect({ ...FULL_CROP }, normalizedAspect(s.cropAspect, s.source.width, s.source.height))
              : { ...FULL_CROP };
        }),
      clearCrop: () =>
        set((s) => {
          s.crop = { ...FULL_CROP };
          s.cropAspect = 0;
        }),
      applyCrop: (crop, aspect) =>
        set((s) => {
          s.crop = crop;
          s.cropAspect = aspect;
          s.cropping = false;
        }),
      setCropping: (cropping) =>
        set((s) => {
          s.cropping = cropping && s.source !== null;
        }),

      setViewport: (size) =>
        set((s) => {
          s.viewport = size;
        }),
      fitView: () =>
        set((s) => {
          s.fit = true;
        }),
      zoomTo: (zoom, anchor) => update((v) => zoomAround(v, zoom, anchor)),
      zoomBy: (factor, anchor) => update((v) => zoomAround(v, v.zoom * factor, anchor)),
      stepZoom: (direction) => update((v) => zoomAround(v, nextZoomStep(v.zoom, direction))),
      panBy: (dx, dy) => update((v) => ({ zoom: v.zoom, x: v.x + dx, y: v.y + dy })),
    };
  }),
);
