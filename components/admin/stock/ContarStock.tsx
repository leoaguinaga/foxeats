'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, ClipboardList, Minus, Plus } from 'lucide-react';
import { api, type InsumoStock } from '@/lib/api';
import { botonFantasmaCls } from '@/components/admin/salon/controles';
import { MOTIVOS_DIFERENCIA, cantidadTexto, esFraccion, plural } from './stock';

const FR = ['0', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

/** Conteo ciego en dos pasos: contar sin ver el sistema, luego revisar diferencias con su motivo. */
export function ContarStock({ insumos, onVolver, onGuardado }: {
  insumos: InsumoStock[]; onVolver: () => void; onGuardado: () => void;
}) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  // Orden del almacén; los que no tienen posición quedan al final, agrupados.
  const lista = useMemo(
    () => [...insumos].sort((a, b) => (a.ordenConteo || 9999) - (b.ordenConteo || 9999) || a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre)),
    [insumos],
  );
  const contados = lista.filter((i) => conteo[i.id] != null);
  const set = (id: string, n: number) => setConteo((c) => ({ ...c, [id]: Math.max(0, n) }));

  const filas = contados.map((i) => ({ i, d: conteo[i.id] - i.stockActual }));
  const conDif = filas.filter((f) => f.d !== 0);
  const faltan = conDif.filter((f) => !motivos[f.i.id]).length;

  async function guardar() {
    setGuardando(true);
    try {
      const r = await api.admin.registrarConteo(filas.map(({ i }) => ({ insumoId: i.id, contado: conteo[i.id], motivo: motivos[i.id] })));
      toast.success(`Conteo guardado. ${r.diferencias ? `${r.diferencias} ${r.diferencias === 1 ? 'insumo corregido' : 'insumos corregidos'}.` : 'Todo cuadraba.'}`);
      onGuardado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el conteo');
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-6 sm:px-8">
        <button type="button" onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-[13px] text-[var(--pizarra)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" />Stock</button>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Contar stock</h1>
        <div className="mt-1.5 flex gap-3 text-[12.5px] text-[var(--pizarra)]">
          {([[1, 'Contar'], [2, 'Revisar diferencias']] as const).map(([n, t]) => (
            <span key={n} className={`inline-flex items-center gap-1.5 ${paso === n ? 'font-semibold text-[var(--ink)]' : ''}`}>
              <i className={`grid size-[18px] place-items-center rounded-full text-[11px] font-bold not-italic ${paso === n ? 'bg-[var(--tinta)] text-white' : 'bg-[var(--muted)]'}`}>{n}</i>{t}
            </span>
          ))}
        </div>

        {paso === 1 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-[var(--muted)] px-3 py-2.5 text-[13px] text-[#3a3e4a]">
            <ClipboardList className="mt-0.5 size-4 shrink-0" />
            <span>Cuenta lo que ves, sin mirar el sistema: la cantidad esperada se muestra recién en el paso 2. Lo que no cuentes se queda como está.</span>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
          {paso === 1 ? (
            <>
              <div className="hidden grid-cols-[minmax(170px,1.3fr)_minmax(110px,.8fr)_minmax(250px,1.4fr)] gap-4 bg-[#FAF9F6] px-4 py-2 text-xs font-semibold text-[var(--pizarra)] md:grid">
                <span>Insumo · orden del almacén</span><span>Unidad</span><span>Contado</span>
              </div>
              {lista.map((i) => {
                const v = conteo[i.id];
                const frac = esFraccion(i);
                return (
                  <div key={i.id} className={['grid grid-cols-1 items-center gap-x-4 gap-y-2 border-t border-[var(--linea)] px-4 py-2.5 first:border-t-0 md:grid-cols-[minmax(170px,1.3fr)_minmax(110px,.8fr)_minmax(250px,1.4fr)]', v != null ? 'bg-[#FBFAF5]' : ''].join(' ')}>
                    <div className="min-w-0"><b className="block truncate text-sm font-semibold">{i.nombre}</b><span className="text-xs text-[var(--pizarra)]">{i.grupo}</span></div>
                    <span className="text-[12.5px] text-[var(--pizarra)]">{frac ? `${plural(i.nombreUnidadCompra, 2)} y ${plural(i.nombreUnidadMinima, 2)}` : plural(i.nombreUnidadMinima, 2)}</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--linea)] bg-white">
                        <button type="button" tabIndex={-1} aria-label="Menos" onClick={() => set(i.id, (v ?? 0) - (frac ? 8 : 1))} className="grid size-11 place-items-center text-[var(--pizarra)] hover:bg-[var(--muted)]"><Minus className="size-4" /></button>
                        <input
                          value={v != null ? (frac ? Math.floor(v / 8) : v) : ''}
                          placeholder={frac ? '0' : '—'}
                          inputMode="numeric"
                          aria-label={frac ? `${plural(i.nombreUnidadCompra, 2)} enteros de ${i.nombre}` : `${plural(i.nombreUnidadMinima, 2)} de ${i.nombre}`}
                          onChange={(ev) => {
                            const n = parseInt(ev.target.value.replace(/\D/g, ''), 10) || 0;
                            set(i.id, frac ? n * 8 + ((v ?? 0) % 8) : n);
                          }}
                          className="h-11 w-16 border-x border-[var(--muted)] text-center text-base font-semibold tabular-nums outline-none focus:bg-[var(--tinta-tint)]"
                        />
                        <button type="button" tabIndex={-1} aria-label="Más" onClick={() => set(i.id, (v ?? 0) + (frac ? 8 : 1))} className="grid size-11 place-items-center text-[var(--pizarra)] hover:bg-[var(--muted)]"><Plus className="size-4" /></button>
                      </span>
                      {frac ? (
                        <>
                          <span className="text-[12.5px] text-[var(--pizarra)]">enteros +</span>
                          <select
                            value={v != null ? v % 8 : 0}
                            onChange={(ev) => set(i.id, Math.floor((v ?? 0) / 8) * 8 + +ev.target.value)}
                            aria-label={`${plural(i.nombreUnidadMinima, 2)} sueltos de ${i.nombre}`}
                            className="h-8 rounded-lg border border-[var(--linea)] bg-white px-2 text-[13px]"
                          >{FR.map((f, o) => <option key={o} value={o}>{f}</option>)}</select>
                        </>
                      ) : i.unidadesPorUnidadDeCompra > 1 && (
                        <button type="button" tabIndex={-1} onClick={() => set(i.id, (v ?? 0) + i.unidadesPorUnidadDeCompra)} className={botonFantasmaCls}>+1 {i.nombreUnidadCompra}</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(170px,1.3fr)_minmax(160px,1fr)_minmax(110px,.7fr)_minmax(180px,1fr)] gap-4 bg-[#FAF9F6] px-4 py-2 text-xs font-semibold text-[var(--pizarra)] md:grid">
                <span>Insumo</span><span>Sistema → contado</span><span>Diferencia</span><span>Motivo</span>
              </div>
              {filas.map(({ i, d }) => (
                <div key={i.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 border-t border-[var(--linea)] px-4 py-2.5 first:border-t-0 md:grid-cols-[minmax(170px,1.3fr)_minmax(160px,1fr)_minmax(110px,.7fr)_minmax(180px,1fr)]">
                  <div className="min-w-0"><b className="block truncate text-sm font-semibold">{i.nombre}</b><span className="text-xs text-[var(--pizarra)]">{i.grupo}</span></div>
                  <span className="text-[13px] text-[var(--pizarra)]">{cantidadTexto(i, i.stockActual)} → <b className="text-[var(--ink)]">{cantidadTexto(i, conteo[i.id])}</b></span>
                  <span className={['text-sm font-semibold', d < 0 ? 'text-[var(--alerta)]' : d > 0 ? 'text-[var(--aviso)]' : 'text-[var(--ok)]'].join(' ')}>
                    {d === 0 ? 'Cuadra' : `${d > 0 ? '+' : '−'}${Math.abs(d)} ${plural(i.nombreUnidadMinima, d)}`}
                  </span>
                  {d === 0 ? <Check className="size-4 text-[var(--ok)]" aria-label="Cuadra" /> : (
                    <select
                      value={motivos[i.id] ?? ''}
                      onChange={(ev) => setMotivos((m) => ({ ...m, [i.id]: ev.target.value }))}
                      aria-label={`Motivo de la diferencia en ${i.nombre}`}
                      className="h-8 rounded-lg border border-[var(--linea)] bg-white px-2 text-[13px]"
                    >
                      <option value="">Elige el motivo…</option>
                      {MOTIVOS_DIFERENCIA.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 bg-[var(--tinta)] px-5 py-3 text-white sm:px-8">
        <span className="text-[13.5px] text-white/80">
          {paso === 1
            ? <><b className="text-white">{contados.length} de {lista.length}</b> contados{contados.length < lista.length && ' · lo que no cuentes se queda como está'}</>
            : <><b className="text-white">{filas.length - conDif.length} cuadran</b> · {conDif.length} con diferencia{faltan > 0 && ` · falta el motivo de ${faltan}`}</>}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className={`${botonFantasmaCls} text-white/80 hover:bg-white/10 hover:text-white`} onClick={paso === 2 ? () => setPaso(1) : onVolver}>
            {paso === 2 ? 'Volver a contar' : 'Cancelar'}
          </button>
          <button
            type="button"
            disabled={paso === 1 ? !contados.length : faltan > 0 || guardando}
            onClick={paso === 1 ? () => setPaso(2) : guardar}
            className="inline-flex items-center rounded-lg bg-[var(--aji)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)] hover:bg-[#f5be55] disabled:pointer-events-none disabled:opacity-45"
          >
            {paso === 1 ? 'Revisar diferencias' : guardando ? 'Guardando…' : 'Guardar conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}
