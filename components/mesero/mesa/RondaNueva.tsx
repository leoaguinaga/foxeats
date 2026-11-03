'use client';

import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { PlatoCarta, PromocionVigente } from '@/lib/types';
import { etiquetaDescuento } from '@/lib/promociones';
import { soles } from '@/components/admin/caja/fechas';
import { campoCaja } from '@/components/caja/Catalogo';
import { claveLinea } from '@/components/caja/ElegirOpciones';
import { Interruptor } from '@/components/admin/carta/Interruptor';

export interface LineaRonda {
  plato: PlatoCarta;
  cantidad: number;
  notas: string;
  clave?: string;
  elecciones?: string[];
}

/**
 * La ronda que se va a enviar, como el ticket de caja: pasos de cantidad, nota
 * por línea, «para llevar» con nombre en línea y el botón principal debajo.
 * En escritorio es la columna derecha; bajo 1024 px, una hoja que sube.
 */
export function RondaNueva({
  lineas, precio, promos, maximo, onCambiar, onAnotar,
  mostrarLlevar, paraLlevar, nombre, onParaLlevar, onNombre,
  enviando, error, onEnviar, onCerrarHoja, titulo,
}: {
  lineas: LineaRonda[];
  /** Precio unitario que se cobrará (con promo si rige). */
  precio: (p: PlatoCarta) => number;
  promos: Map<string, PromocionVigente>;
  maximo: (p: PlatoCarta) => number;
  onCambiar: (platoId: string, diff: number) => void;
  onAnotar: (platoId: string, notas: string) => void;
  mostrarLlevar: boolean;
  paraLlevar: boolean;
  nombre: string;
  onParaLlevar: (v: boolean) => void;
  onNombre: (v: string) => void;
  enviando: boolean;
  error: string | null;
  onEnviar: () => void;
  onCerrarHoja: () => void;
  titulo: string;
}) {
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + precio(l.plato) * l.cantidad, 0);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--linea)] px-5 py-3 lg:hidden">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">{titulo} <span className="font-normal text-[var(--pizarra)]">· Ronda nueva</span></h2>
        <button type="button" onClick={onCerrarHoja} className="-mr-1 rounded-md px-2 py-1 text-[13px] font-semibold text-[var(--tinta)] hover:bg-[var(--tinta-tint)]">
          Seguir agregando
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {lineas.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-[var(--pizarra)]">Toca un plato de la carta para sumarlo a la ronda.</p>
        ) : (
          <ul className="divide-y divide-[var(--linea)]">
            {lineas.map((l) => {
              const promo = promos.get(l.plato.id);
              const max = maximo(l.plato);
              return (
                <li key={claveLinea(l)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5">
                  <span className="text-[14px] font-semibold text-[var(--ink)]">{l.plato.nombre}{l.elecciones && <span className="mt-0.5 block text-[13px] font-normal text-[var(--pizarra)]">{l.elecciones.join(' + ')}</span>}</span>
                  <span className="text-right text-[14px] font-semibold text-[var(--ink)] tabular-nums">
                    S/ {soles(precio(l.plato) * l.cantidad)}
                    {promo && <span className="ml-1.5 rounded bg-[var(--aji)] px-1 text-[10.5px] leading-4 font-bold">{etiquetaDescuento(promo)}</span>}
                  </span>
                  {notaAbierta === claveLinea(l) ? (
                    <input
                      autoFocus
                      value={l.notas}
                      onChange={(e) => onAnotar(claveLinea(l), e.target.value)}
                      onBlur={() => setNotaAbierta(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') { e.stopPropagation(); setNotaAbierta(null); }
                      }}
                      placeholder="Sin cebolla, bien cocido…"
                      aria-label={`Nota para ${l.plato.nombre}`}
                      className="h-8 min-w-0 rounded-md border border-[var(--linea)] px-2 text-[13px] outline-none focus:border-[var(--tinta)]"
                    />
                  ) : (
                    <button type="button" onClick={() => setNotaAbierta(claveLinea(l))} className="justify-self-start truncate text-left text-[13px] font-medium text-[var(--tinta)] hover:underline">
                      {l.notas ? <span className="text-[var(--pizarra)]">{l.notas}</span> : 'Agregar nota'}
                    </button>
                  )}
                  <span className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--linea)]">
                    <button type="button" onClick={() => onCambiar(claveLinea(l), -1)} aria-label={l.cantidad === 1 ? `Quitar ${l.plato.nombre}` : `Uno menos de ${l.plato.nombre}`} className="grid h-9 w-10 place-items-center bg-[#FBFAF7] text-[var(--pizarra)] hover:text-[var(--ink)]">
                      {l.cantidad === 1 ? <X className="size-4" strokeWidth={1.9} /> : <Minus className="size-4" strokeWidth={1.9} />}
                    </button>
                    <span className="w-9 text-center text-[14px] font-semibold tabular-nums">{l.cantidad}</span>
                    <button type="button" onClick={() => onCambiar(claveLinea(l), 1)} disabled={l.cantidad >= max || !!l.clave} aria-label={`Uno más de ${l.plato.nombre}`} className="grid h-9 w-10 place-items-center bg-[#FBFAF7] text-[var(--pizarra)] hover:text-[var(--ink)] disabled:opacity-35">
                      <Plus className="size-4" strokeWidth={1.9} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2.5 border-t border-[var(--linea)] bg-[#FBFAF7] px-5 py-3.5">
        {mostrarLlevar && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] font-medium text-[var(--ink)]">Esta ronda es para llevar</span>
              <Interruptor activo={paraLlevar} onChange={onParaLlevar} etiqueta="Esta ronda es para llevar" soloControl />
            </div>
            {paraLlevar && (
              <input
                autoFocus
                value={nombre}
                onChange={(e) => onNombre(e.target.value)}
                autoComplete="off"
                placeholder="¿A nombre de quién?"
                aria-label="Nombre de quien lleva la ronda"
                className={campoCaja}
              />
            )}
          </div>
        )}
        {error && <p role="alert" className="text-[13px] font-medium text-[var(--alerta)]">{error}</p>}
        <button
          type="button"
          onClick={onEnviar}
          disabled={enviando || lineas.length === 0}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-lg bg-[var(--tinta)] px-4 text-white transition-colors hover:bg-[var(--tinta-hover)] disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
        >
          <span className="text-[15px] font-semibold">{enviando ? 'Enviando…' : 'Enviar a cocina'}</span>
          {unidades > 0 && (
            <span className="text-[13.5px] text-white/80 tabular-nums">
              {unidades} {unidades === 1 ? 'plato' : 'platos'} · <span className="font-semibold text-white">S/ {soles(total)}</span>
            </span>
          )}
        </button>
        <p className="text-center text-[12px] text-[var(--pizarra)] max-lg:hidden">
          <kbd className="font-sans font-semibold">{mac ? '⌘' : 'Ctrl'} Enter</kbd> envía · <kbd className="font-sans font-semibold">Esc</kbd> vacía la ronda
        </p>
      </div>
    </>
  );
}
