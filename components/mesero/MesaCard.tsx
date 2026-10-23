'use client';

import { Mesa } from '@/lib/types';

interface Props {
  mesa: Mesa;
  onClick: () => void;
  /** Para puestos de barra: «B1» y su número debajo. */
  etiqueta?: string;
}

export function MesaCard({ mesa, onClick, etiqueta }: Props) {
  const libre = mesa.estado === 'libre';

  return (
    <button
      onClick={onClick}
      className={[
        'relative flex flex-col items-center justify-center rounded-2xl border-2 p-6 transition-all active:scale-95 select-none',
        'min-h-[140px] w-full cursor-pointer',
        libre
          ? 'bg-white border-[var(--ok)] hover:bg-[var(--ok-tint)]'
          : 'bg-[var(--alerta-tint)] border-[var(--alerta)] hover:bg-[var(--alerta-tint-strong)]',
      ].join(' ')}
    >
      <span
        className={[
          'text-5xl font-bold leading-none',
          libre ? 'text-[var(--ink)]' : 'text-[var(--alerta)]',
        ].join(' ')}
      >
        {etiqueta ?? mesa.numero}
      </span>

      {etiqueta && (
        <span className="mt-1 text-xs font-medium text-muted-foreground tabular-nums">Nº {mesa.numero}</span>
      )}

      <span
        className={[
          'mt-3 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide',
          libre
            ? 'bg-[var(--ok-tint)] text-[var(--ok)]'
            : 'bg-[var(--alerta)] text-white',
        ].join(' ')}
      >
        {libre ? 'Libre' : 'Ocupada'}
      </span>

      {mesa.capacidad && (
        <span className="absolute top-2 right-3 text-xs text-muted-foreground">
          {mesa.capacidad} pers.
        </span>
      )}
    </button>
  );
}
