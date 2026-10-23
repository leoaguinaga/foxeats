'use client';

import { Minus, Plus } from 'lucide-react';

// Piezas de formulario compartidas por el editor de Salón.

export const botonCls =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--linea)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--tinta)]/40 hover:bg-[var(--tinta-tint)] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]';

export const botonPrimarioCls =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-[var(--tinta)] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]';

export const botonFantasmaCls =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-[var(--pizarra)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-[var(--tinta)]';

export const inputCls =
  'h-9 w-full rounded-lg border border-[var(--linea)] bg-white px-3 text-sm text-[var(--ink)] tabular-nums outline-none transition-colors placeholder:text-[var(--pizarra)]/60 focus:border-[var(--tinta)] focus:ring-2 focus:ring-[var(--tinta)]/20';

export function Campo({ label, htmlFor, children, ayuda }: {
  label: string; htmlFor?: string; children: React.ReactNode; ayuda?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs text-[var(--pizarra)]">{label}</label>
      {children}
      {ayuda && <p className="text-xs text-[var(--pizarra)]">{ayuda}</p>}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, etiqueta }: {
  value: number; min: number; max: number; onChange: (n: number) => void; etiqueta: string;
}) {
  return (
    <div className="flex h-9 items-center justify-between overflow-hidden rounded-lg border border-[var(--linea)] bg-white">
      <button
        type="button"
        aria-label={`Menos ${etiqueta}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid h-full w-9 place-items-center text-[var(--pizarra)] hover:bg-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-35"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="text-sm font-semibold text-[var(--ink)] tabular-nums" aria-live="polite">{value}</span>
      <button
        type="button"
        aria-label={`Más ${etiqueta}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid h-full w-9 place-items-center text-[var(--pizarra)] hover:bg-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-35"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function Segmentado<T extends string>({ value, opciones, onChange, etiqueta }: {
  value: T; opciones: Array<{ value: T; label: string }>; onChange: (v: T) => void; etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-lg bg-[var(--muted)] p-[3px]">
      {opciones.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={[
              'rounded-md px-3 py-1 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
              on ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function EstadoMesaPill({ ocupada }: { ocupada: boolean }) {
  return (
    <span className={[
      'rounded-full px-2 py-px text-[11px] font-semibold',
      ocupada ? 'bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'bg-[var(--ok-tint)] text-[var(--ok)]',
    ].join(' ')}>
      {ocupada ? 'Ocupada' : 'Libre'}
    </span>
  );
}
