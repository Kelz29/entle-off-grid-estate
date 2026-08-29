"use client";

import { useState, type ReactNode } from "react";

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] uppercase tracking-[0.18em] text-eoe-espresso/70">
      {children}
    </span>
  );
}

export function TextField({
  label,
  value,
  onChange,
  maxLength = 200,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  maxLength = 600,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={rows}
        className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
      />
    </label>
  );
}

export function LinesField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <TextArea
      label={`${label} (one line per row)`}
      value={value.join("\n")}
      onChange={(v) =>
        onChange(
          v
            .split("\n")
            .map((line) => line.trimEnd())
            .filter((line, i, arr) => i < arr.length - 1 || line.trim() !== "" || arr.length === 1)
        )
      }
      rows={Math.max(2, value.length)}
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 min-h-11 w-full rounded-xl border border-eoe-espresso/15 bg-white px-3 py-2.5 text-base text-eoe-espresso outline-none focus:border-eoe-gold sm:text-sm"
      />
    </label>
  );
}

export function Card({
  title,
  hint,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const showBody = !collapsible || open;
  return (
    <section className="rounded-2xl border border-eoe-espresso/12 bg-white px-4 py-4 shadow-sm sm:px-5">
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <span className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
            {title}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-eoe-espresso">
            {open ? "Hide" : "Edit"}
          </span>
        </button>
      ) : (
        <p className="text-[11px] uppercase tracking-[0.22em] text-eoe-espresso/75">
          {title}
        </p>
      )}
      {hint && showBody && (
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-eoe-espresso/70">
          {hint}
        </p>
      )}
      {showBody && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}

export function SaveBar({
  busy,
  msg,
  onSave,
  onReset,
  disabled,
}: {
  busy: boolean;
  msg: string | null;
  onSave: () => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center gap-2 border-t border-eoe-espresso/10 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-5 sm:gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={busy || disabled}
        className="min-h-11 rounded-full bg-eoe-espresso px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-ivory hover:bg-eoe-espresso/90 disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={busy}
        className="min-h-11 rounded-full border border-eoe-espresso/20 px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-eoe-espresso hover:bg-eoe-ivory sm:px-5"
      >
        Reset
      </button>
      {msg && (
        <span className="w-full text-xs text-eoe-espresso/80 sm:w-auto">
          {msg}
        </span>
      )}
    </div>
  );
}

export function RowActions({
  onUp,
  onDown,
  onRemove,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {onUp && (
        <button
          type="button"
          onClick={onUp}
          className="min-h-11 min-w-11 rounded-full border border-eoe-espresso/15 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-eoe-espresso"
        >
          Up
        </button>
      )}
      {onDown && (
        <button
          type="button"
          onClick={onDown}
          className="min-h-11 min-w-11 rounded-full border border-eoe-espresso/15 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-eoe-espresso"
        >
          Down
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 rounded-full border border-red-200 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-red-700"
        >
          Remove
        </button>
      )}
    </div>
  );
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const next = [...list];
  const j = index + dir;
  if (j < 0 || j >= next.length) return list;
  const tmp = next[index];
  next[index] = next[j];
  next[j] = tmp;
  return next;
}
