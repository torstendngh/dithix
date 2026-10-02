"use client";

import { useEffect } from "react";
import type { WorkerRequest, WorkerResponse } from "@/lib/dither/worker";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore, type SourceImage } from "@/stores/workspace-store";

/**
 * Owns the dithering worker. Keeps at most one job in flight; changes that arrive
 * while busy collapse into a single follow-up job so slider drags stay smooth.
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
      });
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
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
    };

    sendSource(workspace().source);
    const unsubSource = useWorkspaceStore.subscribe((s) => sendSource(s.source));
    const unsubSettings = useSettingsStore.subscribe((s, prev) => {
      if (s.settings !== prev.settings) run();
    });

    return () => {
      unsubSource();
      unsubSettings();
      worker.terminate();
    };
  }, []);
}
