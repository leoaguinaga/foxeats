'use client';

import { useMemo, useState, type RefObject } from 'react';
import { Minus, Plus } from 'lucide-react';
import { soles } from '@/components/admin/caja/fechas';

const BILLETES = [200, 100, 50, 20, 10];
const MONEDAS = [5, 2, 1, 0.5, 0.2, 0.1];

export type ModoEfectivo = 'total' | 'conteo';

/** Acepta coma o punto como decimal y como mucho dos decimales. */
export function limpiarMonto(v: string) {
  const s = v.replace(',', '.').replace(/[^\d.]/g, '');
  const [ent, ...resto] = s.split('.');
  return resto.length ? `${ent}.${resto.join('').slice(0, 2)}` : ent;
}

const etiquetaDenominacion = (d: number) => (d >= 1 ? `S/ ${d}` : `${Math.round(d * 100)} cént.`);

/** Estado del efectivo contado, escrito como total o billete por billete (abrir y cerrar turno). */
export function useEfectivo(onCambio?: () => void) {
  const [modo, setModo] = useState<ModoEfectivo>('total');
  const [monto, setMontoCrudo] = useState('');
  const [conteo, setConteo] = useState<Record<string, string>>({});

  const totalConteo = useMemo(
    () => [...BILLETES, ...MONEDAS].reduce((s, d) => s + d * (parseInt(conteo[d] || '0', 10) || 0), 0),
    [conteo],
  );

  // En el conteo, cero significa «aún no conté»; una gaveta vacía se declara escribiendo 0.
  const valor = modo === 'total' ? (monto === '' ? null : parseFloat(monto)) : totalConteo > 0 ? totalConteo : null;
  const valido = valor !== null && !Number.isNaN(valor) && valor >= 0;

  return {
    modo,
    monto,
    conteo,
    totalConteo,
    valor: valido ? valor : null,
    setMonto(v: string) { setMontoCrudo(limpiarMonto(v)); onCambio?.(); },
    setCantidad(d: number, v: string) {
      setConteo((prev) => ({ ...prev, [d]: v.replace(/\D/g, '').slice(0, 4) }));
      onCambio?.();
    },
    cambiarModo(m: ModoEfectivo) {
      if (m === modo) return;
      // Lo contado pasa al total para no perderlo al volver a escribirlo a mano.
      if (m === 'total' && totalConteo > 0) setMontoCrudo(totalConteo.toFixed(2));
      setModo(m);
      onCambio?.();
    },
  };
}

export type Efectivo = ReturnType<typeof useEfectivo>;

export function SelectorModo({ e }: { e: Efectivo }) {
  return (
    <div role="radiogroup" aria-label="Cómo ingresar el efectivo" className="inline-flex rounded-lg bg-[var(--piedra)] p-0.5 text-[13px]">
      {([['total', 'Escribir total'], ['conteo', 'Contar billetes']] as const).map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={e.modo === k}
          onClick={() => e.cambiarModo(k)}
          className={[
            'rounded-md px-3 py-1.5 font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
            e.modo === k ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
          ].join(' ')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function CampoTotal({ e, id, etiqueta, error, errorId, inputRef, autoFocus }: {
  e: Efectivo;
  id: string;
  etiqueta: string;
  error?: boolean;
  errorId?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      <div
        className={[
          'flex h-20 items-center gap-3 rounded-[10px] border bg-white px-5 transition-[border-color,box-shadow] focus-within:border-[var(--tinta)] focus-within:shadow-[0_0_0_3px_var(--tinta-tint)]',
          error ? 'border-[var(--alerta)]' : 'border-[var(--linea)]',
        ].join(' ')}
      >
        <span className="text-[26px] font-medium text-[var(--pizarra)]" aria-hidden>S/</span>
        <input
          ref={inputRef}
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0.00"
          value={e.monto}
          onChange={(ev) => e.setMonto(ev.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          size={1}
          className="w-full min-w-0 flex-1 bg-transparent text-[40px] font-semibold tracking-[-0.02em] text-[var(--ink)] tabular-nums caret-[var(--tinta)] outline-none placeholder:text-[#B5B7C0]"
        />
      </div>
    </>
  );
}

export function ConteoBilletes({ e }: { e: Efectivo }) {
  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {([['Billetes', BILLETES], ['Monedas', MONEDAS]] as const).map(([titulo, lista]) => (
        <fieldset key={titulo}>
          <legend className="mb-2 text-[13px] font-medium text-[var(--pizarra)]">{titulo}</legend>
          <ul className="divide-y divide-[var(--linea)]/70">
            {lista.map((d) => {
              const n = parseInt(e.conteo[d] || '0', 10) || 0;
              return (
                <li key={d} className="flex items-center gap-3 py-1.5">
                  <span className="w-16 shrink-0 text-[14px] font-medium text-[var(--ink)] tabular-nums">{etiquetaDenominacion(d)}</span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-label={`Quitar uno de ${etiquetaDenominacion(d)}`}
                      onClick={() => e.setCantidad(d, String(Math.max(0, n - 1)))}
                      disabled={n === 0}
                      className="grid size-8 place-items-center rounded-md text-[var(--pizarra)] transition-colors hover:bg-[var(--piedra)] hover:text-[var(--ink)] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[var(--tinta)]"
                    >
                      <Minus className="size-4" strokeWidth={1.9} />
                    </button>
                    <input
                      inputMode="numeric"
                      aria-label={`Cantidad de ${etiquetaDenominacion(d)}`}
                      placeholder="0"
                      value={e.conteo[d] ?? ''}
                      onChange={(ev) => e.setCantidad(d, ev.target.value)}
                      onFocus={(ev) => ev.target.select()}
                      className="h-8 w-12 rounded-md border border-[var(--linea)] bg-white text-center text-[14px] font-semibold text-[var(--ink)] tabular-nums caret-[var(--tinta)] outline-none placeholder:font-normal placeholder:text-[#9A9DA8] focus:border-[var(--tinta)] focus:shadow-[0_0_0_3px_var(--tinta-tint)]"
                    />
                    <button
                      type="button"
                      aria-label={`Sumar uno de ${etiquetaDenominacion(d)}`}
                      onClick={() => e.setCantidad(d, String(n + 1))}
                      className="grid size-8 place-items-center rounded-md text-[var(--pizarra)] transition-colors hover:bg-[var(--piedra)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--tinta)]"
                    >
                      <Plus className="size-4" strokeWidth={1.9} />
                    </button>
                  </div>
                  <span className={['ml-auto text-[14px] tabular-nums', n ? 'font-medium text-[var(--ink)]' : 'text-[#9A9DA8]'].join(' ')}>
                    {soles(d * n)}
                  </span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      <div className="flex items-baseline justify-between border-t border-[var(--linea)] pt-3 sm:col-span-2">
        <span className="text-[14px] font-medium text-[var(--pizarra)]">Total contado</span>
        <span className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--ink)] tabular-nums">
          <span className="mr-1.5 text-[18px] font-medium text-[var(--pizarra)]">S/</span>{soles(e.totalConteo)}
        </span>
      </div>
    </div>
  );
}
