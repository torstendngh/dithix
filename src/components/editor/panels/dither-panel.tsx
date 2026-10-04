"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Switch } from "@/components/shared/switch";
import { ALGORITHM_GROUPS, ALGORITHMS, getAlgorithm } from "@/lib/dither/algorithms";
import type { AlgorithmId } from "@/lib/dither/types";
import { useSettingsStore } from "@/stores/settings-store";
import { FieldRow, IconButton, NumberInput, Segmented, SliderField } from "../fields";
import { Section } from "../section";

const BAYER: { value: AlgorithmId; label: string }[] = [
  { value: "bayer2", label: "2" },
  { value: "bayer4", label: "4" },
  { value: "bayer8", label: "8" },
  { value: "bayer16", label: "16" },
  { value: "bayer32", label: "32" },
];

const ITEMS = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a.name]));

export function DitherPanel() {
  const dither = useSettingsStore((s) => s.settings.dither);
  const setDither = useSettingsStore((s) => s.setDither);
  const info = getAlgorithm(dither.algorithm);
  const seeded = dither.algorithm === "white-noise" || dither.algorithm === "blue-noise";
  const isBayer = dither.algorithm.startsWith("bayer");

  return (
    <Section id="dither" title="Dither" icon="dither">
      <div className="grid gap-1.5">
        <span className="text-zinc-400">Bayer matrix</span>
        <Segmented
          aria-label="Bayer matrix size"
          value={isBayer ? dither.algorithm : ("" as AlgorithmId)}
          options={BAYER.map((b) => ({ ...b, label: `${b.label}×${b.label}`, title: `Bayer ${b.label}×${b.label}` }))}
          onChange={(algorithm) => setDither({ algorithm })}
        />
      </div>

      <div className="grid gap-1.5">
        <span className="text-zinc-400">Algorithm</span>
        <Select
          items={ITEMS}
          value={dither.algorithm}
          onValueChange={(v) => v && setDither({ algorithm: v as AlgorithmId })}
        >
          <SelectTrigger className="w-full" aria-label="Algorithm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {ALGORITHM_GROUPS.map((group) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {ALGORITHMS.filter((a) => a.group === group).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {info.kind === "ordered" && (
        <>
          <FieldRow label="Spread">
            <Segmented
              aria-label="Spread mode"
              className="w-auto"
              value={dither.spreadMode}
              options={[
                { value: "auto", label: "Auto", title: "Scaled to the gaps between palette colours" },
                { value: "fixed", label: "Fixed", title: "Absolute range in 0–255 channel units" },
              ]}
              onChange={(spreadMode) => setDither({ spreadMode })}
            />
          </FieldRow>
          {dither.spreadMode === "auto" ? (
            <SliderField
              label="Amount"
              value={dither.strength}
              onChange={(strength) => setDither({ strength })}
              min={0}
              max={2}
              step={0.01}
              display={100}
              defaultValue={1}
              unit="%"
            />
          ) : (
            <SliderField
              label="Range"
              value={dither.spread}
              onChange={(spread) => setDither({ spread })}
              min={0}
              max={255}
              defaultValue={64}
            />
          )}
          <SliderField
            label="Bias"
            value={dither.bias}
            onChange={(bias) => setDither({ bias })}
            min={-1}
            max={1}
            step={0.01}
            display={100}
            defaultValue={0}
            unit="%"
          />
          <FieldRow label="Transpose matrix">
            <Switch
              aria-label="Transpose matrix"
              checked={dither.transpose}
              onCheckedChange={(transpose) => setDither({ transpose })}
            />
          </FieldRow>
        </>
      )}

      {(info.kind === "diffusion" || info.kind === "curve") && (
        <SliderField
          label="Diffusion"
          value={Math.min(1, dither.strength)}
          onChange={(strength) => setDither({ strength })}
          min={0}
          max={1}
          step={0.01}
          display={100}
          defaultValue={1}
          unit="%"
        />
      )}

      {info.kind === "diffusion" && (
        <FieldRow label="Serpentine">
          <Switch
            aria-label="Serpentine scanning"
            checked={dither.serpentine}
            onCheckedChange={(serpentine) => setDither({ serpentine })}
          />
        </FieldRow>
      )}

      {seeded && (
        <FieldRow label="Seed">
          <div className="flex items-center gap-1">
            <NumberInput
              aria-label="Seed"
              value={dither.seed}
              onValueChange={(seed) => setDither({ seed: Math.round(seed) })}
              min={0}
              max={99999}
            />
            <IconButton
              icon="dice"
              label="Random seed"
              size="icon-xs"
              onClick={() => setDither({ seed: Math.floor(Math.random() * 99999) })}
            />
          </div>
        </FieldRow>
      )}
    </Section>
  );
}
