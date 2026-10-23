'use client';

import { Plus, Users } from 'lucide-react';
import type { Mesa } from '@/lib/types';
import { etiquetaMesa } from '@/lib/mesas';
import { EstadoMesaPill } from './controles';

const MAX_HUECOS_VISIBLES = 12;

/** La zona como lista de mesas ordenada por número, con los huecos a la vista. */
export function VistaNumeros({ mesas, onElegir, onAgregar, multi = [], onAlternar }: {
  mesas: Mesa[];
  onElegir: (m: Mesa) => void;
  onAgregar: () => void;
  /** Ids elegidos con Shift + clic. */
  multi?: string[];
  onAlternar?: (m: Mesa) => void;
}) {
  const ordenadas = [...mesas].sort((a, b) => a.numero - b.numero);
  const min = ordenadas[0]?.numero;
  const max = ordenadas[ordenadas.length - 1]?.numero;
  const numeros = new Set(ordenadas.map((m) => m.numero));
  const huecos: number[] = [];
  if (min !== undefined && max !== undefined) {
    for (let n = min; n <= max; n++) if (!numeros.has(n)) huecos.push(n);
  }
  const mostrarHuecos = huecos.length > 0 && huecos.length <= MAX_HUECOS_VISIBLES;
  const personas = ordenadas.reduce((s, m) => s + (m.capacidad ?? 0), 0);

  if (ordenadas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-[var(--linea)] bg-white px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[var(--ink)]">Esta zona aún no tiene mesas</p>
        <p className="max-w-[44ch] text-[13px] text-[var(--pizarra)]">Agrega una o varias mesas seguidas. Se identifican por su número, sin importar dónde estén.</p>
        <button
          type="button"
          onClick={onAgregar}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--tinta)] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[var(--tinta-hover)]"
        >
          <Plus className="size-3.5" aria-hidden /> Agregar mesas
        </button>
      </div>
    );
  }

  // Tarjetas: mesas reales intercaladas con los números que faltan
  const items: Array<{ tipo: 'mesa'; mesa: Mesa } | { tipo: 'hueco'; numero: number }> = [];
  for (const m of ordenadas) {
    if (mostrarHuecos) {
      const previo = items.length ? items[items.length - 1] : null;
      const desde = previo ? (previo.tipo === 'mesa' ? previo.mesa.numero : previo.numero) + 1 : m.numero;
      for (let n = desde; n < m.numero; n++) items.push({ tipo: 'hueco', numero: n });
    }
    items.push({ tipo: 'mesa', mesa: m });
  }

  return (
    <section aria-label="Mesas por número">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[13px] font-semibold text-[var(--ink)] tabular-nums">
          {min === max ? `Mesa ${min}` : `Mesas ${min} – ${max}`}
        </h3>
        <p className="text-[12.5px] text-[var(--pizarra)] tabular-nums">
          {ordenadas.length} mesa{ordenadas.length !== 1 ? 's' : ''} · {personas} personas
          {huecos.length > 0 && (huecos.length <= 3
            ? ` · falta${huecos.length > 1 ? 'n' : ''} ${huecos.length > 1 ? 'la ' + huecos.slice(0, -1).join(', la ') + ' y la ' + huecos[huecos.length - 1] : 'la ' + huecos[0]}`
            : ` · ${huecos.length} números sin mesa`)}
        </p>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2">
        {items.map((it) => it.tipo === 'hueco' ? (
          <li key={`h-${it.numero}`} className="flex min-h-[74px] flex-col items-center justify-center rounded-[9px] border border-dashed border-[var(--linea)] text-center text-xs text-[var(--pizarra)] tabular-nums">
            {it.numero}<span>sin mesa</span>
          </li>
        ) : (
          <li key={it.mesa.id}>
            <button
              type="button"
              onClick={(e) => {
                if ((e.shiftKey || e.metaKey || e.ctrlKey || multi.length > 0) && onAlternar) onAlternar(it.mesa);
                else onElegir(it.mesa);
              }}
              aria-pressed={multi.includes(it.mesa.id)}
              className={[
                'flex min-h-[74px] w-full flex-col justify-between gap-2 rounded-[9px] border bg-white px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]',
                multi.includes(it.mesa.id)
                  ? 'border-[var(--tinta)] shadow-[0_0_0_3px_var(--aji)]'
                  : 'border-[var(--linea)] hover:border-[var(--tinta)]/50',
              ].join(' ')}
            >
              <span className="flex items-baseline gap-1.5">
                <b className="text-[22px] leading-none font-semibold text-[var(--ink)] tabular-nums">{it.mesa.numero}</b>
                {it.mesa.tipo === 'barra' && <span className="text-xs font-medium text-[var(--tinta)]">{etiquetaMesa(it.mesa, mesas)}</span>}
              </span>
              <span className="flex items-center justify-between gap-1 text-xs whitespace-nowrap text-[var(--pizarra)]">
                <span className="inline-flex items-center gap-1"><Users className="size-3" aria-hidden />{it.mesa.capacidad ?? '—'}</span>
                <EstadoMesaPill ocupada={it.mesa.estado === 'ocupada'} />
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onAgregar}
            className="flex min-h-[74px] w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-[var(--tinta)]/60 text-[13px] font-semibold text-[var(--tinta)] transition-colors hover:bg-[var(--tinta-tint)]"
          >
            <Plus className="size-3.5" aria-hidden /> Agregar
          </button>
        </li>
      </ul>
    </section>
  );
}
