'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { api, TurnoDetalle, TurnoResumen } from '@/lib/api';
import { SidePanel } from '../salon/SidePanel';
import { PildoraArqueo } from './Arqueo';
import { CANALES, diaLima, duracion, etiquetaDia, hora, soles } from './fechas';

type Filtro = 'todos' | 'gastos' | 'ajustes';

type Mov =
  | { tipo: 'cobro'; id: string; fecha: string; titulo: string; sub: string; ajuste: string | null; monto: number }
  | { tipo: 'gasto'; id: string; fecha: string; titulo: string; sub: string; ajuste: null; monto: number };

const METODO: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape_plin: 'Yape / Plin', transferencia: 'Transferencia' };

function Linea({ etiqueta, valor, tipo }: { etiqueta: string; valor: string; tipo?: 'total' | 'dif' | 'sobra' }) {
  const cls =
    tipo === 'total' ? 'border-t border-[var(--linea)] bg-[#FBFAF7] font-semibold'
    : tipo === 'dif' ? 'border-t border-[var(--linea)] bg-[var(--alerta-tint)] font-semibold text-[var(--alerta)]'
    : tipo === 'sobra' ? 'border-t border-[var(--linea)] bg-[var(--aviso-tint)] font-semibold text-[var(--aviso)]'
    : '';
  return (
    <div className={`flex justify-between px-3.5 py-2 text-[13.5px] ${cls}`}>
      <span className={tipo ? '' : 'text-[var(--pizarra)]'}>{etiqueta}</span><b className="font-semibold">{valor}</b>
    </div>
  );
}

export function DetalleTurno({ turnoId, turnos, ahora, onCambiar, onCerrar }: {
  turnoId: string | null;
  turnos: TurnoResumen[];
  ahora: string;
  onCambiar: (id: string) => void;
  onCerrar: () => void;
}) {
  const [cargado, setCargado] = useState<{ id: string; detalle: TurnoDetalle | null }>({ id: '', detalle: null });
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const resumen = turnos.find((t) => t.id === turnoId);
  const idx = turnos.findIndex((t) => t.id === turnoId);
  // Mientras el turno está abierto, los cobros llegan: se vuelve a pedir con cada refresco de la lista.
  const firma = resumen ? `${resumen.totalTurno}|${resumen.totalGastos}` : '';

  useEffect(() => {
    if (!turnoId) return;
    let vivo = true;
    api.admin.turnoDetalle(turnoId)
      .then((d) => { if (vivo) setCargado({ id: turnoId, detalle: d }); })
      .catch(() => { if (vivo) setCargado({ id: turnoId, detalle: null }); });
    return () => { vivo = false; };
  }, [turnoId, firma]);

  useEffect(() => {
    if (!turnoId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, select, textarea')) return;
      if (e.key === 'ArrowDown' && idx < turnos.length - 1) { e.preventDefault(); setFiltro('todos'); onCambiar(turnos[idx + 1].id); }
      if (e.key === 'ArrowUp' && idx > 0) { e.preventDefault(); setFiltro('todos'); onCambiar(turnos[idx - 1].id); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [turnoId, idx, turnos, onCambiar]);

  const d = cargado.id === turnoId ? cargado.detalle : null;
  const cargando = !!turnoId && cargado.id !== turnoId;

  const movs = useMemo<Mov[]>(() => {
    if (!d) return [];
    const cobros: Mov[] = d.cuentas.map((c) => ({
      tipo: 'cobro', id: c.visitaId, fecha: c.fecha, titulo: c.etiqueta,
      sub: c.metodos.length > 1
        ? `${c.metodos.map((m) => `${METODO[m.metodo]} ${soles(m.monto)}`).join(' + ')} · pago dividido`
        : METODO[c.metodos[0].metodo],
      ajuste: c.ajusteMonto
        ? `ajuste ${parseFloat(c.ajusteMonto) < 0 ? '−' : '+'}${soles(Math.abs(parseFloat(c.ajusteMonto)))}${c.motivoAjuste ? ` · ${c.motivoAjuste}` : ''}`
        : null,
      monto: parseFloat(c.monto),
    }));
    const gastos: Mov[] = d.gastos.map((g) => ({
      tipo: 'gasto', id: g.id, fecha: g.createdAt, titulo: g.motivo, sub: 'Pagado de caja', ajuste: null, monto: -parseFloat(g.monto),
    }));
    return [...cobros, ...gastos].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [d]);

  const nGastos = movs.filter((m) => m.tipo === 'gasto').length;
  const nAjustes = movs.filter((m) => m.ajuste).length;
  const visibles = movs.filter((m) => filtro === 'todos' || (filtro === 'gastos' ? m.tipo === 'gasto' : !!m.ajuste));
  const dif = d?.arqueo.diferencia != null ? parseFloat(d.arqueo.diferencia) : null;

  const titulo = resumen ? `Turno de ${resumen.cajeroNombre}` : 'Turno';
  const desc = resumen
    ? `${etiquetaDia(diaLima(resumen.fechaApertura))} · ${hora(resumen.fechaApertura)} – ${resumen.fechaCierre ? hora(resumen.fechaCierre) : 'ahora'} · ${duracion(resumen.fechaApertura, resumen.fechaCierre, ahora)} · ${resumen.cobros} ${resumen.cobros === 1 ? 'cobro' : 'cobros'}`
    : undefined;

  return (
    <SidePanel open={!!turnoId} titulo={titulo} descripcion={desc} onClose={onCerrar} ancho={470}
      pie={
        <>
          <span className="mr-auto text-xs text-[var(--pizarra)]">↑ ↓ cambia de turno</span>
          <button type="button" disabled={idx <= 0} onClick={() => onCambiar(turnos[idx - 1].id)} aria-label="Turno anterior" className="rounded-md border border-[var(--linea)] p-1.5 text-[var(--pizarra)] hover:bg-[var(--muted)] disabled:opacity-40"><ChevronUp className="size-4" /></button>
          <button type="button" disabled={idx < 0 || idx >= turnos.length - 1} onClick={() => onCambiar(turnos[idx + 1].id)} aria-label="Turno siguiente" className="rounded-md border border-[var(--linea)] p-1.5 text-[var(--pizarra)] hover:bg-[var(--muted)] disabled:opacity-40"><ChevronDown className="size-4" /></button>
        </>
      }
    >
      {cargando ? (
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-[var(--pizarra)]">
          <div className="size-6 animate-spin rounded-full border-2 border-[var(--tinta)] border-t-transparent" />Cargando movimientos…
        </div>
      ) : !d ? (
        <p className="py-12 text-center font-medium text-[var(--alerta)]">No se pudo cargar el detalle del turno.</p>
      ) : (
        <div className="flex flex-col gap-5 pt-1">
          <div className="flex items-center justify-between"><PildoraArqueo turno={d} /></div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--pizarra)]">Arqueo de efectivo</p>
            <div className="overflow-hidden rounded-[10px] border border-[var(--linea)]">
              <Linea etiqueta="Fondo de apertura" valor={soles(d.arqueo.apertura)} />
              <Linea etiqueta="+ Cobros en efectivo" valor={soles(d.arqueo.efectivo)} />
              <Linea etiqueta="− Gastos pagados de caja" valor={soles(d.arqueo.gastos)} />
              <Linea etiqueta={d.estado === 'abierto' ? 'Esperado en gaveta ahora' : 'Esperado en gaveta'} valor={soles(d.arqueo.esperado)} tipo="total" />
              {d.arqueo.contado != null && <Linea etiqueta="Contado al cerrar" valor={soles(d.arqueo.contado)} />}
              {dif != null && Math.abs(dif) >= 0.005 && (
                <Linea etiqueta={dif < 0 ? 'Faltante' : 'Sobrante'} valor={`${dif < 0 ? '−' : '+'}${soles(Math.abs(dif))}`} tipo={dif < 0 ? 'dif' : 'sobra'} />
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--pizarra)]">Ingresos del turno · S/ {soles(d.totalTurno)}</p>
            <div className="grid grid-cols-4 rounded-[10px] border border-[var(--linea)]">
              {CANALES.map((c) => (
                <div key={c.key} className="border-l border-[var(--linea)] px-3 py-2 first:border-l-0">
                  <label className="block text-[11.5px] text-[var(--pizarra)]">{c.corto}</label>
                  <b className="text-sm font-semibold">{soles(d.porCanal[c.key])}</b>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide text-[var(--pizarra)]">Movimientos</span>
              <div className="inline-flex rounded-lg bg-[var(--muted)] p-[3px]" role="tablist">
                {([['todos', `Todos ${movs.length}`], ['gastos', `Gastos ${nGastos}`], ['ajustes', `Ajustes ${nAjustes}`]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)}
                    className={['rounded-md px-3 py-1 text-[13px] font-semibold whitespace-nowrap', filtro === k ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--pizarra)]'].join(' ')}>{l}</button>
                ))}
              </div>
            </div>
            {visibles.length === 0 ? (
              <p className="mt-3 rounded-[10px] border border-dashed border-[var(--linea)] py-8 text-center text-sm text-[var(--pizarra)]">
                {movs.length === 0 ? 'No se registraron cobros ni gastos en este turno.' : 'Nada que mostrar con este filtro.'}
              </p>
            ) : (
              <ul className="mt-1.5">
                {visibles.map((m) => (
                  <li key={`${m.tipo}-${m.id}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[var(--linea)] py-2.5 text-[13.5px] first:border-t-0">
                    <time className="text-[12.5px] text-[var(--pizarra)]">{hora(m.fecha)}</time>
                    <span>
                      <b className="font-semibold">{m.titulo}</b>
                      {m.tipo === 'gasto' && <span className="ml-1.5 rounded-[5px] bg-[var(--muted)] px-1.5 py-px text-[11px] font-semibold text-[var(--pizarra)]">Gasto</span>}
                      <small className="block text-xs text-[var(--pizarra)]">
                        {m.sub}{m.ajuste && <> · <span className="font-semibold text-[var(--aviso)]">{m.ajuste}</span></>}
                      </small>
                    </span>
                    <span className="text-right font-semibold">{m.monto < 0 ? '−' : ''}{soles(Math.abs(m.monto))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SidePanel>
  );
}
