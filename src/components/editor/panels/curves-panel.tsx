"use client";

import { useMemo, useRef, useState } from "react";
import { buildCurveLut, isIdentityCurve } from "@/lib/dither/adjust";
import {
  hitCurvePoint,
  histogram,
  insertCurvePoint,
  moveCurvePoint,
  removeCurvePoint,
} from "@/lib/dither/curve-edit";
import type { CurveChannel } from "@/lib/dither/types";
import { cn } from "@/lib/tailwind-utils";
import { useSettingsStore } from "@/stores/settings-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { IconButton, Segmented } from "../fields";
import { Section } from "../section";

const CHANNELS: { value: CurveChannel; label: string; title: string }[] = [
  { value: "master", label: "Luma", title: "Master curve applied to all channels" },
  { value: "r", label: "R", title: "Red channel" },
  { value: "g", label: "G", title: "Green channel" },
  { value: "b", label: "B", title: "Blue channel" },
];

const STROKE: Record<CurveChannel, string> = {
  master: "#f4f4f5",
  r: "#f87171",
  g: "#4ade80",
  b: "#60a5fa",
};

const HIT_RADIUS = 10;

function CurveEditor({ channel }: { channel: CurveChannel }) {
  const points = useSettingsStore((s) => s.settings.adjust.curves[channel]);
  const setCurve = useSettingsStore((s) => s.setCurve);
  const sample = useWorkspaceStore((s) => s.source?.sample);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const curvePath = useMemo(() => {
    const lut = buildCurveLut(points);
    let d = "";
    for (let x = 0; x < 256; x++) d += `${x === 0 ? "M" : "L"}${x} ${255 - lut[x]}`;
    return d;
  }, [points]);

  const histPath = useMemo(() => {
    if (!sample) return null;
    const ch = channel === "master" ? -1 : channel === "r" ? 0 : channel === "g" ? 1 : 2;
    const bins = histogram(sample.data, ch);
    // sqrt keeps small populations visible next to large spikes.
    const max = Math.sqrt(Math.max(...bins, 1));
    let d = "M0 256";
    for (let i = 0; i < 256; i++) {
      const h = (Math.sqrt(bins[i]) / max) * 200;
      d += `H${i}V${256 - h}H${i + 1}`;
    }
    return `${d}V256Z`;
  }, [sample, channel]);

  const toCurve = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 255,
      y: 255 - ((e.clientY - rect.top) / rect.height) * 255,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = toCurve(e);
    let index = hitCurvePoint(points, p.x, p.y, HIT_RADIUS);
    if (index === -1) {
      const inserted = insertCurvePoint(points, p);
      if (inserted.index === -1) return;
      setCurve(channel, inserted.points);
      index = inserted.index;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(index);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag === null) return;
    const p = toCurve(e);
    // Read fresh state: `points` may lag a frame behind during fast drags.
    const current = useSettingsStore.getState().settings.adjust.curves[channel];
    setCurve(channel, moveCurvePoint(current, drag, p.x, p.y));
  };

  const removeAt = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = toCurve(e);
    const index = hitCurvePoint(points, p.x, p.y, HIT_RADIUS);
    if (index !== -1) setCurve(channel, removeCurvePoint(points, index));
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 255 255"
      className="aspect-square w-full touch-none border border-zinc-800 bg-zinc-950 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={removeAt}
      onContextMenu={removeAt}
      role="img"
      aria-label={`${channel} curve editor`}
    >
      {histPath && <path d={histPath} fill="#27272a" />}
      {[64, 128, 192].map((v) => (
        <g key={v} stroke="#27272a" strokeWidth={1} shapeRendering="crispEdges">
          <line x1={v} y1={0} x2={v} y2={255} />
          <line x1={0} y1={v} x2={255} y2={v} />
        </g>
      ))}
      <line x1={0} y1={255} x2={255} y2={0} stroke="#3f3f46" strokeDasharray="3 3" />
      <path d={curvePath} fill="none" stroke={STROKE[channel]} strokeWidth={1.5} />
      {points.map((p, i) => (
        <rect
          key={i}
          x={p.x - 3.5}
          y={255 - p.y - 3.5}
          width={7}
          height={7}
          fill={drag === i ? STROKE[channel] : "#09090b"}
          stroke={STROKE[channel]}
          strokeWidth={1.5}
          shapeRendering="crispEdges"
        />
      ))}
    </svg>
  );
}

export function CurvesPanel() {
  const [channel, setChannel] = useState<CurveChannel>("master");
  const curves = useSettingsStore((s) => s.settings.adjust.curves);
  const resetCurves = useSettingsStore((s) => s.resetCurves);

  return (
    <Section
      title="Curves"
      defaultOpen={false}
      icon="curve"
      actions={<IconButton icon="reset" label="Reset all curves" size="icon-xs" onClick={() => resetCurves()} />}
    >
      <Segmented
        aria-label="Curve channel"
        value={channel}
        onChange={setChannel}
        options={CHANNELS.map((c) => ({
          ...c,
          label: (
            <span className={cn(!isIdentityCurve(curves[c.value]) && "underline underline-offset-2")}>
              {c.label}
            </span>
          ),
        }))}
      />
      <CurveEditor channel={channel} />
      <p className="text-2xs leading-relaxed text-zinc-600">
        click to add · drag to move · double-click to remove
      </p>
    </Section>
  );
}
