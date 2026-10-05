"use client";

import { useEffect } from "react";
import { frameCount } from "@/lib/dither/motion";
import type { WorkerRequest, WorkerResponse } from "@/lib/dither/worker";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore, type SourceImage } from "@/stores/workspace-store";

/** Quiet time after the last change before the (much slower) motion loop is rendered. */
const ANIMATION_DELAY = 350;

/**
 * Owns the dithering worker. Keeps at most one job in flight; changes that arrive
 * while busy collapse into a single follow-up job so slider drags stay smooth.
 * With motion on, the loop's frames are rendered afterwards, once settings have settled.
 */
export function useDitherProcessor() {
  useEffect(() => {
    const worker = new Worker(new URL("../../lib/dither/worker.ts", import.meta.url), {
      type: "module",
    });
    const post = (msg: WorkerRequest) => worker.postMessage(msg);
    const workspace = useWorkspaceStore.getState;

    let jobId = 0;
    let inFlight: { jobId: number; sourceId: number } | null = null;
    let pending = false;
    let sentSourceId: number | null = null;

    let animId = 0;
    let animTimer: ReturnType<typeof setTimeout> | undefined;
    /** Stops any loop being rendered and, with motion on, schedules a fresh one. */
    const restartAnimation = () => {
      clearTimeout(animTimer);
      animId++;
      post({ type: "cancel-animation" });
      workspace().resetFrames(0);
      const { settings } = useSettingsStore.getState();
      if (!settings.motion.enabled) return;
      animTimer = setTimeout(() => {
        const { source } = workspace();
        if (!source) return;
        const current = useSettingsStore.getState().settings;
        workspace().resetFrames(frameCount(current.motion));
        post({ type: "animate", animId, sourceId: source.id, settings: current, crop: workspace().crop });
      }, ANIMATION_DELAY);
    };

    const run = () => {
      const { source } = workspace();
      if (!source) return;
      if (inFlight) {
        pending = true;
        return;
      }
      pending = false;
      inFlight = { jobId: ++jobId, sourceId: source.id };
      workspace().setProcessing(true);
      post({
        type: "process",
        jobId: inFlight.jobId,
        sourceId: source.id,
        settings: useSettingsStore.getState().settings,
        crop: workspace().crop,
      });
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "frame") {
        if (msg.animId === animId) {
          workspace().addFrame(msg.index, new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height));
        }
        return;
      }
      if (msg.type === "animation-error") {
        if (msg.animId === animId) workspace().setError(msg.message);
        return;
      }
      const job = inFlight;
      inFlight = null;
      const current = workspace().source;
      // Drop results computed for an image that has since been replaced.
      if (job && current && job.sourceId === current.id) {
        if (msg.type === "result") {
          const data = new Uint8ClampedArray(msg.buffer);
          workspace().setResult(new ImageData(data, msg.width, msg.height), msg.duration);
        } else {
          workspace().setError(msg.message);
        }
      }
      if (pending) run();
      else workspace().setProcessing(false);
    };
    worker.onerror = (event) => {
      inFlight = null;
      workspace().setProcessing(false);
      workspace().setError(event.message || "Worker crashed");
    };

    const sendSource = (source: SourceImage | null) => {
      if (!source || source.id === sentSourceId) return;
      sentSourceId = source.id;
      post({ type: "source", sourceId: source.id, bitmap: source.bitmap });
      if (inFlight) pending = true;
      else run();
      restartAnimation();
    };

    sendSource(workspace().source);
    const unsubSource = useWorkspaceStore.subscribe((s, prev) => {
      sendSource(s.source);
      // Re-render when the crop changes on the same image (a new image re-renders anyway).
      if (s.crop !== prev.crop && s.source === prev.source) {
        run();
        restartAnimation();
      }
    });
    const unsubSettings = useSettingsStore.subscribe((s, prev) => {
      if (s.settings === prev.settings) return;
      run();
      restartAnimation();
    });

    return () => {
      clearTimeout(animTimer);
      unsubSource();
      unsubSettings();
      worker.terminate();
    };
  }, []);
}
