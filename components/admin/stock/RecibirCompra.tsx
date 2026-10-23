'use client';

import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { api, type InsumoStock } from '@/lib/api';
import { botonFantasmaCls, botonCls, inputCls } from '@/components/admin/salon/controles';
import { cantidadTexto, plural, sugeridoCompra } from './stock';

/** Todos los insumos en una sola pantalla: lo que llegó, en la unidad en que llegó. */
export function RecibirCompra({ insumos, foco, onVolver, onGuardado }: {
  insumos: InsumoStock[]; foco?: string; onVolver: () => void; onGuardado: () => void;
}) {
  const [cant, setCant] = useState<Record<string, number>>({});
  const [proveedor, setProveedor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const guardar = useRef<HTMLButtonElement>(null);

  const grupos = useMemo(() => {
    const m = new Map<string, InsumoStock[]>();
    for (const i of [...insumos].sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre))) {
      m.set(i.grupo, [...(m.get(i.grupo) ?? []), i]);
    }
    return [...m];
  }, [insumos]);
  const orden = grupos.flatMap(([, l]) => l.map((i) => i.id));
  const cargados = insumos.filter((i) => (cant[i.id] ?? 0) > 0);

  const set = (id: string, n: number) => setCant((c) => ({ ...c, [id]: Math.max(0, n) }));

  async function enviar() {
    setGuardando(true);
    try {
      await api.admin.registrarCompra({
        proveedor: proveedor.trim() || undefined,
        items: cargados.map((i) => ({ insumoId: i.id, cantidad: cant[i.id] })),
      });
      toast.success(`Compra guardada: ${cargados.length} ${cargados.length === 1 ? 'insumo' : 'insumos'}. Los platos se habilitaron solos.`);
      onGuardado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la compra');
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-6 sm:px-8">
        <button type="button" onClick={onVolver} className="mb-3 inline-flex items-center gap-1 text-[13px] text-[var(--pizarra)] hover:text-[var(--ink)]"><ArrowLeft className="size-4" />Stock</button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Recibir compra</h1>
            <p className="mt-1 text-[13px] text-[var(--pizarra)]">Escribe lo que llegó, en la unidad en que llegó. Enter pasa al siguiente.</p>
          </div>
          <button type="button" className={botonCls} onClick={() => setCant(Object.fromEntries(insumos.map((i) => [i.id, sugeridoCompra(i)]).filter(([, n]) => n)))}>
            Llenar con lo sugerido
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
          <div className="hidden grid-cols-[minmax(170px,1.3fr)_minmax(130px,.9fr)_250px_minmax(150px,1fr)] gap-4 bg-[#FAF9F6] px-4 py-2 text-xs font-semibold text-[var(--pizarra)] md:grid">
            <span>Insumo</span><span>Hay ahora</span><span>Llegó</span><span>Quedará</span>
          </div>
          {grupos.map(([g, lista]) => (
            <div key={g}>
              <div className="border-t border-[var(--linea)] bg-[var(--piedra)] px-4 py-1.5 text-xs font-semibold text-[var(--pizarra)]">{g}</div>
              {lista.map((i) => {
                const n = cant[i.id] ?? 0, s = sugeridoCompra(i);
                return (
                  <div key={i.id} className={['grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-[var(--linea)] px-4 py-2.5 md:grid-cols-[minmax(170px,1.3fr)_minmax(130px,.9fr)_250px_minmax(150px,1fr)]', n ? 'bg-[#FBFAF5]' : ''].join(' ')}>
                    <div className="min-w-0">
                      <b className="block truncate text-sm font-semibold">{i.nombre}</b>
                      {s > 0
                        ? <button type="button" onClick={() => set(i.id, s)} className="text-xs font-medium text-[var(--tinta)] underline decoration-[#b9bfd3] underline-offset-[3px]">Sugerido: {s} {plural(i.nombreUnidadCompra, s)}</button>
                        : <span className="text-xs text-[var(--pizarra)]">{i.unidadesPorUnidadDeCompra} {plural(i.nombreUnidadMinima, i.unidadesPorUnidadDeCompra)} por {i.nombreUnidadCompra}</span>}
                    </div>
                    <span className="text-[12.5px] text-[var(--pizarra)] md:text-sm md:text-[var(--ink)]">{cantidadTexto(i, i.stockActual)}</span>
                    <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                      <span className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--linea)] bg-white">
                        <button type="button" tabIndex={-1} aria-label="Menos" onClick={() => set(i.id, n - 1)} className="grid size-9 place-items-center text-[var(--pizarra)] hover:bg-[var(--muted)]"><Minus className="size-3.5" /></button>
                        <input
                          ref={(el) => { refs.current[i.id] = el; if (el && foco === i.id && !el.dataset.foco) { el.dataset.foco = '1'; el.focus(); } }}
                          value={n || ''}
                          placeholder="0"
                          inputMode="numeric"
                          aria-label={`${plural(i.nombreUnidadCompra, 2)} de ${i.nombre}`}
                          onChange={(ev) => set(i.id, parseInt(ev.target.value.replace(/\D/g, ''), 10) || 0)}
                          onKeyDown={(ev) => {
                            if (ev.key !== 'Enter') return;
                            ev.preventDefault();
                            const sig = orden[orden.indexOf(i.id) + 1];
                            (sig ? refs.current[sig] : guardar.current)?.focus();
                          }}
                          className="h-9 w-14 border-x border-[var(--muted)] text-center text-sm font-semibold tabular-nums outline-none focus:bg-[var(--tinta-tint)]"
                        />
                        <button type="button" tabIndex={-1} aria-label="Más" onClick={() => set(i.id, n + 1)} className="grid size-9 place-items-center text-[var(--pizarra)] hover:bg-[var(--muted)]"><Plus className="size-3.5" /></button>
                      </span>
                      <span className="text-[12.5px] text-[var(--pizarra)]">{plural(i.nombreUnidadCompra, 2)}</span>
                    </div>
                    <div className="hidden text-[13px] leading-snug md:block">
                      {n ? <><b>{cantidadTexto(i, i.stockActual + n * i.unidadesPorUnidadDeCompra)}</b><br /><span className="text-xs text-[var(--pizarra)]">+{n * i.unidadesPorUnidadDeCompra} {plural(i.nombreUnidadMinima, n * i.unidadesPorUnidadDeCompra)}</span></> : <span className="text-[var(--pizarra)]">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 bg-[var(--tinta)] px-5 py-3 text-white sm:px-8">
        <span className="text-[13.5px] text-white/80">
          {cargados.length
            ? <><b className="text-white">{cargados.length} {cargados.length === 1 ? 'insumo' : 'insumos'}</b> · {cargados.map((i) => `${cant[i.id]} ${plural(i.nombreUnidadCompra, cant[i.id])} ${i.nombre.split(' ')[0]}`).join(', ')}</>
            : 'Nada ingresado todavía'}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Proveedor o nota (opcional)" aria-label="Proveedor o nota" className={`${inputCls} w-56 border-white/20 bg-white/10 text-white placeholder:text-white/55`} />
          <button type="button" className={`${botonFantasmaCls} text-white/80 hover:bg-white/10 hover:text-white`} onClick={onVolver}>Cancelar</button>
          <button ref={guardar} type="button" disabled={!cargados.length || guardando} onClick={enviar} className="inline-flex items-center rounded-lg bg-[var(--aji)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)] hover:bg-[#f5be55] disabled:pointer-events-none disabled:opacity-45">
            {guardando ? 'Guardando…' : 'Guardar compra'}
          </button>
        </div>
      </div>
    </div>
  );
}
