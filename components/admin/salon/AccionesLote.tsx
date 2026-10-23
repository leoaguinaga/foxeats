'use client';

import { useState } from 'react';
import { ArrowRightLeft, Trash2, X } from 'lucide-react';
import type { Mesa, Zona } from '@/lib/types';
import { etiquetaMesa } from '@/lib/mesas';
import { botonCls, botonFantasmaCls, inputCls } from './controles';

/**
 * Acciones sobre varias mesas elegidas con Shift (o ⌘/Ctrl) + clic.
 * `compacto` es la barra inferior de la vista por número; si no, la tarjeta
 * del inspector del plano.
 */
export function AccionesLote({ elegidas, todas, zonas, zonaActual, onMover, onEliminar, onQuitarDelPlano, onLimpiar, compacto = false }: {
  elegidas: Mesa[];
  todas: Mesa[];
  zonas: Zona[];
  zonaActual: string;
  onMover: (zonaId: string) => void;
  onEliminar: () => void;
  onQuitarDelPlano?: () => void;
  onLimpiar: () => void;
  compacto?: boolean;
}) {
  const otras = zonas.filter((z) => z.id !== zonaActual);
  const [destino, setDestino] = useState(otras[0]?.id ?? '');
  const ocupadas = elegidas.filter((m) => m.estado === 'ocupada').length;
  const n = elegidas.length;
  const titulo = `${n} mesa${n !== 1 ? 's' : ''} seleccionada${n !== 1 ? 's' : ''}`;
  const destinoValido = otras.some((z) => z.id === destino) ? destino : otras[0]?.id ?? '';

  const mover = otras.length > 0 && (
    <div className="flex items-center gap-2">
      <select
        aria-label="Zona de destino"
        value={destinoValido}
        onChange={(e) => setDestino(e.target.value)}
        className={[inputCls, compacto ? 'h-8 w-auto min-w-36 py-0 text-[13px]' : ''].join(' ')}
      >
        {otras.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
      </select>
      <button type="button" onClick={() => onMover(destinoValido)} className={botonCls}>
        <ArrowRightLeft className="size-3.5" aria-hidden /> Mover
      </button>
    </div>
  );

  const eliminar = (
    <button
      type="button"
      onClick={onEliminar}
      disabled={ocupadas === n}
      title={ocupadas === n ? 'Todas están ocupadas' : undefined}
      className={[botonCls, 'border-[var(--alerta)]/40 text-[var(--alerta)] hover:border-[var(--alerta)] hover:bg-[var(--alerta-tint)]'].join(' ')}
    >
      <Trash2 className="size-3.5" aria-hidden /> Eliminar {n - ocupadas === n ? n : n - ocupadas}
    </button>
  );

  if (compacto) {
    return (
      <div role="region" aria-label={titulo} className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--linea)] bg-white px-4 py-3 shadow-[0_-10px_24px_-18px_rgba(22,25,34,0.4)] md:-mx-8 md:px-8">
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">{titulo}</span>
        <span className="text-xs text-[var(--pizarra)]">Shift + clic para sumar o quitar</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mover}
          {eliminar}
          <button type="button" onClick={onLimpiar} className={botonFantasmaCls}><X className="size-3.5" aria-hidden /> Soltar</button>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[10px] border border-[var(--linea)] bg-white p-4" aria-label={titulo}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-[var(--ink)]">{titulo}</h3>
        <button type="button" onClick={onLimpiar} aria-label="Soltar selección" className="-mt-1 -mr-1 rounded-md p-1.5 text-[var(--pizarra)] hover:bg-[var(--muted)]">
          <X className="size-4" />
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {[...elegidas].sort((a, b) => a.numero - b.numero).map((m) => (
          <li key={m.id} className="rounded-md bg-[var(--muted)] px-2 py-0.5 text-xs font-semibold text-[var(--ink)] tabular-nums">
            {m.tipo === 'barra' ? `${etiquetaMesa(m, todas)} · ${m.numero}` : m.numero}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--pizarra)]">Shift + clic en otra mesa la suma o la quita.</p>

      <div className="mt-4 space-y-3 border-t border-[#EFEDE8] pt-3">
        {onQuitarDelPlano && (
          <button type="button" onClick={onQuitarDelPlano} className={[botonFantasmaCls, '-ml-2'].join(' ')}>
            <X className="size-3.5" aria-hidden /> Quitar del plano
          </button>
        )}
        {mover && <div className="space-y-1.5"><p className="text-xs text-[var(--pizarra)]">Mover a otra zona</p>{mover}</div>}
        <div>
          {eliminar}
          {ocupadas > 0 && ocupadas < n && (
            <p className="mt-1.5 text-xs text-[var(--pizarra)]">{ocupadas} ocupada{ocupadas !== 1 ? 's' : ''} no se eliminará{ocupadas !== 1 ? 'n' : ''}.</p>
          )}
        </div>
      </div>
    </section>
  );
}
