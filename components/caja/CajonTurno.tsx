'use client';

import { useState } from 'react';
import type { GastoCaja, TurnoCaja } from '@/lib/api';
import { SidePanel } from '@/components/admin/salon/SidePanel';
import { CANALES, duracion, hora, soles } from '@/components/admin/caja/fechas';

type Filtro = 'todo' | 'cobros' | 'gastos';

type Movimiento =
  | { tipo: 'cobro'; id: string; fecha: string; titulo: string; etiqueta: string | null; detalle: string; monto: string }
  | { tipo: 'gasto'; id: string; fecha: string; gasto: GastoCaja };

/** Cobros, gastos y arqueo del turno: se consultan, no se operan, así que viven en un panel aparte. */
export function CajonTurno({ open, turno, ahora, onClose, onGasto, onEditarGasto, onEliminarGasto, onCerrarTurno }: {
  open: boolean;
  turno: TurnoCaja;
  ahora: string;
  onClose: () => void;
  onGasto: () => void;
  onEditarGasto: (g: GastoCaja) => void;
  onEliminarGasto: (g: GastoCaja) => void;
  onCerrarTurno: () => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todo');
  const canal = turno.porCanal ?? { efectivo: '0.00', tarjeta: '0.00', yape_plin: '0.00', transferencia: '0.00' };
  const pagos = turno.pagos ?? [];
  const gastos = turno.gastos ?? [];

  const movimientos: Movimiento[] = [
    ...pagos.map((p): Movimiento => ({
      tipo: 'cobro',
      id: p.id,
      fecha: p.fechaPago,
      titulo: p.mesaNumero != null ? `Mesa ${p.mesaNumero}` : p.nombreCliente || 'Cliente',
      etiqueta: p.visitaTipo === 'llevar' ? 'Para llevar' : p.visitaTipo === 'delivery' ? 'Delivery' : null,
      detalle: CANALES.find((c) => c.key === p.metodoPago)?.label ?? p.metodoPago,
      monto: p.montoTotal,
    })),
    ...gastos.map((g): Movimiento => ({ tipo: 'gasto', id: g.id, fecha: g.createdAt, gasto: g })),
  ]
    .filter((m) => filtro === 'todo' || (filtro === 'cobros' ? m.tipo === 'cobro' : m.tipo === 'gasto'))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const esperado = turno.montoCierreTeorico ?? turno.montoApertura;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      ancho={460}
      titulo="Turno actual"
      descripcion={`Desde las ${hora(turno.fechaApertura)} · ${duracion(turno.fechaApertura, null, ahora)} · ${pagos.length} ${pagos.length === 1 ? 'cobro' : 'cobros'}`}
      pie={
        <>
          <button type="button" onClick={onGasto} className="h-10 rounded-lg border border-[var(--linea)] bg-white px-3.5 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)]">
            Registrar gasto
          </button>
          <button type="button" onClick={onCerrarTurno} className="h-10 rounded-lg bg-[var(--tinta)] px-4 text-[13.5px] font-semibold text-white hover:bg-[var(--tinta-hover)]">
            Cerrar turno y contar
          </button>
        </>
      }
    >
      <div className="space-y-5 pt-1">
        <dl className="overflow-hidden rounded-[10px] border border-[var(--linea)] text-[14px]">
          <Fila t="Fondo de apertura" v={soles(turno.montoApertura)} />
          <Fila t="Cobros en efectivo" v={soles(canal.efectivo)} />
          <Fila t="Gastos" v={parseFloat(turno.totalGastos ?? '0') > 0 ? `− ${soles(turno.totalGastos!)}` : '0.00'} />
          <div className="flex justify-between border-t border-[var(--linea)] bg-[#FBFAF7] px-3.5 py-2.5 font-semibold text-[var(--ink)]">
            <dt>Debería haber en la gaveta</dt>
            <dd className="tabular-nums">S/ {soles(esperado)}</dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-[var(--linea)] sm:grid-cols-4">
          {CANALES.map((c, i) => (
            <div key={c.key} className={['px-3 py-2', i > 0 ? 'border-l border-[var(--linea)]' : '', i === 2 ? 'max-sm:border-l-0 max-sm:border-t' : '', i === 3 ? 'max-sm:border-t' : ''].join(' ')}>
              <dt className="text-[11.5px] text-[var(--pizarra)]">{c.corto}</dt>
              <dd className="text-[14.5px] font-semibold text-[var(--ink)] tabular-nums">{soles(canal[c.key as keyof typeof canal])}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="movimientos">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 id="movimientos" className="text-[14px] font-semibold text-[var(--ink)]">Movimientos</h3>
            <div role="radiogroup" aria-label="Filtrar movimientos" className="inline-flex rounded-lg bg-[#ECEBE6] p-0.5 text-[12.5px]">
              {([['todo', 'Todo'], ['cobros', 'Cobros'], ['gastos', 'Gastos']] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={filtro === k}
                  onClick={() => setFiltro(k)}
                  className={['rounded-md px-2.5 py-1 font-semibold', filtro === k ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)]'].join(' ')}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {movimientos.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-[var(--pizarra)]">
              {filtro === 'gastos' ? 'Sin gastos en este turno.' : filtro === 'cobros' ? 'Todavía no hay cobros.' : 'Todavía no hay movimientos.'}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--linea)]">
              {movimientos.map((m) => (
                <li key={`${m.tipo}-${m.id}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 text-[13.5px]">
                  <time className="text-[12.5px] text-[var(--pizarra)] tabular-nums">{hora(m.fecha)}</time>
                  {m.tipo === 'cobro' ? (
                    <>
                      <span className="min-w-0">
                        <span className="font-semibold text-[var(--ink)]">{m.titulo}</span>
                        {m.etiqueta && <span className="ml-1.5 rounded bg-[#ECEBE6] px-1.5 py-px text-[11px] font-semibold text-[var(--pizarra)]">{m.etiqueta}</span>}
                        <span className="block text-[12px] text-[var(--pizarra)]">{m.detalle}</span>
                      </span>
                      <span className="text-right font-semibold text-[var(--ink)] tabular-nums">{soles(m.monto)}</span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[var(--ink)]">{m.gasto.motivo}</span>
                        <span className="text-[12px] text-[var(--pizarra)]">
                          Gasto ·{' '}
                          <button type="button" onClick={() => onEditarGasto(m.gasto)} className="font-medium text-[var(--tinta)] hover:underline">Editar</button>
                          {' · '}
                          <button type="button" onClick={() => onEliminarGasto(m.gasto)} className="font-medium text-[var(--alerta)] hover:underline">Eliminar</button>
                        </span>
                      </span>
                      <span className="text-right font-semibold text-[var(--ink)] tabular-nums">− {soles(m.gasto.monto)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SidePanel>
  );
}

function Fila({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between border-t border-[var(--linea)] px-3.5 py-2 first:border-t-0">
      <dt className="text-[var(--pizarra)]">{t}</dt>
      <dd className="font-medium text-[var(--ink)] tabular-nums">{v}</dd>
    </div>
  );
}
