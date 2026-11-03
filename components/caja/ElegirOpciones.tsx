'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { PlatoCarta } from '@/lib/types';

/** Clave única de una línea de pedido: los platos armables se piden de a uno, cada uno con lo suyo. */
export const claveLinea = (l: { plato: { id: string }; clave?: string }) => l.clave ?? l.plato.id;

export const nuevaClave = () => `armable-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/** Cuántas unidades de cada plato hay en las líneas (para la insignia de la carta). */
export function cantidadesPorPlato(lineas: Array<{ plato: { id: string }; cantidad: number }>) {
  const m = new Map<string, number>();
  for (const l of lineas) m.set(l.plato.id, (m.get(l.plato.id) ?? 0) + l.cantidad);
  return m;
}

/**
 * Hoja para armar un plato con opciones («Arma tu dúo»): se tocan las opciones
 * hasta completar las que pide el plato. Se puede repetir una opción; tocar
 * una opción ya elegida con «−» la quita.
 */
export function ElegirOpciones({ plato, onConfirmar, onCancelar }: {
  plato: PlatoCarta;
  onConfirmar: (elecciones: string[]) => void;
  onCancelar: () => void;
}) {
  const combo = plato.combo!;
  const [elegidas, setElegidas] = useState<string[]>([]);
  const completo = elegidas.length === combo.elegir;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelar]);

  const veces = (o: string) => elegidas.filter((e) => e === o).length;
  const sumar = (o: string) => { if (!completo) setElegidas((p) => [...p, o]); };
  const quitar = (o: string) => setElegidas((p) => { const i = p.lastIndexOf(o); return i < 0 ? p : p.filter((_, j) => j !== i); });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onCancelar}>
      <div
        role="dialog"
        aria-label={`Armar ${plato.nombre}`}
        className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--linea)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[var(--ink)]">{plato.nombre}</h2>
          <p className="text-[13px] text-[var(--pizarra)]">
            Elige {combo.elegir} {combo.elegir === 1 ? 'opción' : 'opciones'} · <span className="font-semibold tabular-nums text-[var(--ink)]">{elegidas.length} de {combo.elegir}</span>
          </p>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {combo.opciones.map((o) => {
            const n = veces(o);
            return (
              <li key={o} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => sumar(o)}
                  disabled={completo}
                  aria-pressed={n > 0}
                  className={[
                    'flex min-h-12 flex-1 items-center justify-between gap-3 rounded-lg border px-3.5 text-left text-[14.5px] font-semibold transition-colors',
                    n > 0 ? 'border-[var(--tinta)] bg-[var(--tinta-tint)] text-[var(--tinta)]' : 'border-[var(--linea)] text-[var(--ink)] hover:bg-[var(--piedra)]',
                    'disabled:opacity-45',
                  ].join(' ')}
                >
                  {o}
                  {n > 0 && <span className="grid size-6 place-items-center rounded-full bg-[var(--tinta)] text-[12px] text-white tabular-nums">{n}</span>}
                </button>
                {n > 0 && (
                  <button type="button" onClick={() => quitar(o)} aria-label={`Quitar ${o}`} className="grid size-12 place-items-center rounded-lg border border-[var(--linea)] text-[var(--pizarra)] hover:text-[var(--ink)]">
                    <Minus className="size-4" strokeWidth={1.9} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 border-t border-[var(--linea)] bg-[#FBFAF7] px-5 py-3.5">
          <button type="button" onClick={onCancelar} className="h-12 rounded-lg border border-[var(--linea)] px-4 text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(elegidas)}
            disabled={!completo}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--tinta)] text-[15px] font-semibold text-white hover:bg-[var(--tinta-hover)] disabled:opacity-45"
          >
            <Plus className="size-4" strokeWidth={2} />
            {completo ? 'Agregar a la ronda' : `Faltan ${combo.elegir - elegidas.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
