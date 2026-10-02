"use client";

import { useId, useState } from "react";
import { PixelIcon, type IconName } from "@/components/icons/pixel-icon";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { Label } from "@/components/shared/label";
import { Slider } from "@/components/shared/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shared/tooltip";
import { cn } from "@/lib/tailwind-utils";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface NumberInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown multiplied, e.g. 100 for fractions shown as percent. */
  display?: number;
}

/** Number input that only commits valid values on blur / Enter. */
export function NumberInput({
  value,
  onValueChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  display = 1,
  className,
  ...props
}: NumberInputProps) {
  const shown = String(Math.round(value * display * 100) / 100);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(parsed)) {
      onValueChange(clamp(parsed / display, min, max));
    }
    setDraft(null);
  };

  return (
    <Input
      inputMode="decimal"
      value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const dir = e.key === "ArrowUp" ? 1 : -1;
          const mult = e.shiftKey ? 10 : 1;
          onValueChange(clamp(value + (dir * step * mult) / display, min, max));
          setDraft(null);
        }
      }}
      className={cn("h-6 w-14 px-1.5 text-right", className)}
      {...props}
    />
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Value restored on double-click of the label. */
  defaultValue?: number;
  display?: number;
  unit?: string;
  disabled?: boolean;
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  defaultValue,
  display = 1,
  unit,
  disabled,
}: SliderFieldProps) {
  const id = useId();
  const resettable = defaultValue !== undefined && value !== defaultValue;
  return (
    <div className={cn("grid gap-1", disabled && "opacity-40")}>
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={id}
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
          title={defaultValue !== undefined ? "Double-click to reset" : undefined}
          className={cn(resettable && "text-zinc-200")}
        >
          {label}
          {resettable && <span className="text-zinc-600">•</span>}
        </Label>
        <div className="flex items-center gap-1">
          <NumberInput
            id={id}
            value={value}
            onValueChange={onChange}
            min={min}
            max={max}
            step={step}
            display={display}
            disabled={disabled}
            aria-label={label}
          />
          {unit && <span className="w-4 text-2xs text-zinc-600">{unit}</span>}
        </div>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
        aria-label={label}
      />
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}

/** Row of joined toggle buttons for small option sets. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  ...props
}: SegmentedProps<T>) {
  return (
    <div role="group" className={cn("flex w-full", className)} aria-label={props["aria-label"]}>
      {options.map((o, i) => (
        <Button
          key={String(o.value)}
          variant="outline"
          size="xs"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          // Buttons overlap by 1px; lift the active/focused one so its full border shows.
          className={cn(
            "relative flex-1 normal-case aria-pressed:z-10 focus-visible:z-20",
            i > 0 && "-ml-px",
          )}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

interface IconButtonProps extends React.ComponentProps<typeof Button> {
  icon: IconName;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function IconButton({
  icon,
  label,
  side = "top",
  variant = "ghost",
  size = "icon-sm",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant={variant} size={size} aria-label={label} {...props}>
            <PixelIcon name={icon} />
          </Button>
        }
      />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
