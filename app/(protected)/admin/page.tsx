'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cantidadTexto, etaAgota } from '@/components/admin/stock/stock';
import { ArrowRight, CircleAlert, CircleCheck, Printer, Package, Wallet, WifiOff } from 'lucide-react';
import { api, MonitorItem, TurnoResumen, VisitaResumen } from '@/lib/api';
import { Mesa } from '@/lib/types';
import { useAdminPulse } from '@/components/admin/admin-pulse';

const MINUTOS_ALERTA = 15;
const MINUTOS_AVISO = 10;
const INTERVALO_MS = 10_000;

const soles = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });

function duracion(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

const ESTADO_RONDA: Record<string, string> = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo para entregar',
};

const CANALES: Array<{ key: keyof TurnoResumen['porCanal']; label: string; color: string }> = [
  { key: 'efectivo',      label: 'Efectivo',      color: 'var(--tinta)' },
  { key: 'tarjeta',       label: 'Tarjeta',       color: '#6C7AA6' },
  { key: 'yape_plin',     label: 'Yape / Plin',   color: 'var(--aji)' },
  { key: 'transferencia', label: 'Transferencia', color: '#B9BDCB' },
];

const lugar = (mesaNumero: number | null | undefined) =>
  mesaNumero ? `Mesa ${mesaNumero}` : 'Para llevar';

export default function AdminInicio() {
  const { turnos, turnoAbierto, ticketerasCaidas, insumosAgotados, insumosPorReponer, ultimoConteo, conteoVencido } = useAdminPulse();
  const [mesas, setMesas]     = useState<Mesa[] | null>(null);
  const [monitor, setMonitor] = useState<MonitorItem[]>([]);
  const [visitas, setVisitas] = useState<VisitaResumen[]>([]);
  const [actualizado, setActualizado] = useState<number | null>(null);
  const [sinConexion, setSinConexion] = useState(false);

  const fetchDatos = useCallback(async () => {
    const [m, mo, v] = await Promise.allSettled([
      api.mesas.list(),
      api.monitor.get(),
      api.caja.visitasParaCobrar(),
    ]);
    if (m.status  === 'fulfilled') setMesas(m.value.filter((x) => x.numero !== 0));
    if (mo.status === 'fulfilled') setMonitor(mo.value);
    if (v.status  === 'fulfilled') setVisitas(v.value);
    const todoFallo = [m, mo, v].every((r) => r.status === 'rejected');
    setSinConexion(todoFallo);
    if (!todoFallo) setActualizado(Date.now());
    else setMesas((prev) => prev ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + sondeo
    fetchDatos();
    const id = setInterval(fetchDatos, INTERVALO_MS);
    return () => clearInterval(id);
  }, [fetchDatos]);

  // ── Derivados ─────────────────────────────────────────────
  const rondas = monitor
    .filter((r) => r.estado !== 'entregado' && r.estado !== 'cancelado')
    .sort((a, b) => b.minutosEspera - a.minutosEspera);
  const demoradas = rondas.filter((r) => r.minutosEspera >= MINUTOS_ALERTA);
  const demoraPorMesa = new Map<number, number>();
  for (const r of demoradas) {
    demoraPorMesa.set(r.mesaNumero, Math.max(demoraPorMesa.get(r.mesaNumero) ?? 0, r.minutosEspera));
  }

  const listaMesas = mesas ?? [];
  const ocupadas = listaMesas.filter((m) => m.estado === 'ocupada').length;
  const visitaPorMesa = new Map(
    visitas.filter((v) => v.tipo === 'mesa' && v.mesaNumero).map((v) => [v.mesaNumero as number, v]),
  );

  const listaTurnos = turnos ?? [];
  const cobradoHoy = listaTurnos.reduce((s, t) => s + parseFloat(t.totalTurno), 0);
  const cobrosHoy  = listaTurnos.reduce((s, t) => s + t.cobros, 0);
  const porCobrar  = visitas.reduce((s, v) => s + parseFloat(v.total), 0);
  const externas   = visitas.filter((v) => v.tipo !== 'mesa').length;

  const platosAfectados = new Set(
    insumosAgotados.flatMap((i) => i.platosAsociados.filter((p) => !p.disponible).map((p) => p.id)),
  ).size;

  const atencion: Array<{ id: string; nivel: 'alerta' | 'aviso'; titulo: string; detalle: string; href?: string; accion?: string }> = [
    ...ticketerasCaidas.map((p) => ({
      id: `tk-${p.tipo}`,
      nivel: 'alerta' as const,
      titulo: `${p.label} sin conexión`,
      detalle: `${p.ip ?? 'Sin IP'}:${p.port} · ${p.tipo === 'cocina' ? 'las comandas no se están imprimiendo' : 'no se imprimen precuentas ni recibos'}`,
      href: '/admin/ticketeras',
      accion: 'Revisar',
    })),
    ...demoradas.map((r) => ({
      id: `r-${r.pedidoId}`,
      nivel: 'alerta' as const,
      titulo: `${lugar(r.mesaNumero)} espera su ronda hace ${r.minutosEspera} min`,
      detalle: `${platos(r)} · ${ESTADO_RONDA[r.estado] ?? r.estado}`,
    })),
    ...(insumosAgotados.length > 0 ? [{
      id: 'stock',
      nivel: 'aviso' as const,
      titulo: insumosAgotados.length === 1 ? '1 insumo agotado' : `${insumosAgotados.length} insumos agotados`,
      detalle: `${insumosAgotados.slice(0, 3).map((i) => i.nombre).join(', ')}${insumosAgotados.length > 3 ? '…' : ''}`
        + (platosAfectados > 0 ? ` · ${platosAfectados} plato${platosAfectados !== 1 ? 's' : ''} no disponible${platosAfectados !== 1 ? 's' : ''}` : ''),
      href: '/admin/stock',
      accion: 'Ir a Stock',
    }] : []),
    ...(insumosPorReponer.length > 0 ? [{
      id: 'stock-bajo',
      nivel: 'aviso' as const,
      titulo: insumosPorReponer.length === 1 ? '1 insumo por reponer' : `${insumosPorReponer.length} insumos por reponer`,
      detalle: insumosPorReponer.slice(0, 3).map((i) => {
        const eta = etaAgota(i);
        return `${i.nombre}: ${cantidadTexto(i, i.stockActual)}${eta ? ` (${eta})` : ''}`;
      }).join(' · ') + (insumosPorReponer.length > 3 ? '…' : ''),
      href: '/admin/stock',
      accion: 'Recibir compra',
    }] : []),
    ...(ultimoConteo !== undefined && conteoVencido ? [{
      id: 'stock-conteo',
      nivel: 'aviso' as const,
      titulo: ultimoConteo === null ? 'Todavía no se ha contado el stock' : 'Hace más de dos días que no se cuenta el stock',
      detalle: 'Un conteo corto al cerrar deja el sistema igual a lo que hay en el almacén',
      href: '/admin/stock',
      accion: 'Contar stock',
    }] : []),
    ...(turnos !== null && !turnoAbierto && (ocupadas > 0 || visitas.length > 0) ? [{
      id: 'caja',
      nivel: 'aviso' as const,
      titulo: 'Hay cuentas abiertas y la caja está cerrada',
      detalle: `${visitas.length} cuenta${visitas.length !== 1 ? 's' : ''} por cobrar · el cajero debe abrir turno`,
      href: '/admin/turnos',
      accion: 'Ver caja',
    }] : []),
  ];

  const cargando = mesas === null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 md:px-8 md:py-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">Inicio</h1>
        <EnVivo actualizado={actualizado} sinConexion={sinConexion} />
      </div>

      {sinConexion && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-[10px] border border-[var(--aviso)]/30 bg-[var(--aviso-tint)] px-4 py-3 text-sm text-[#7a3c08]">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <b className="font-semibold">No se pudieron actualizar los datos.</b>{' '}
            {actualizado
              ? `Mostrando lo recibido a las ${hora(new Date(actualizado).toISOString())}. Se reintenta cada 10 s.`
              : 'Revisa que el servidor esté en marcha. Se reintenta cada 10 s.'}
          </div>
        </div>
      )}

      {/* Resumen */}
      <section aria-label="Resumen del día" className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
        <Metrica label="Cobrado hoy" cargando={turnos === null} className="border-b border-[var(--linea)] lg:border-b-0">
          <strong className={valorCls}>{soles(cobradoHoy)}</strong>
          <span className={subCls}>
            {cobrosHoy === 0 ? 'Sin cobros todavía' : `${cobrosHoy} cobro${cobrosHoy !== 1 ? 's' : ''} · ticket medio ${soles(cobradoHoy / cobrosHoy)}`}
          </span>
        </Metrica>
        <Metrica label="Salón" cargando={cargando} className="border-b border-l border-[var(--linea)] lg:border-b-0">
          <strong className={valorCls}>
            {ocupadas} <small className="text-[15px] font-medium tracking-normal text-[var(--pizarra)]">de {listaMesas.length} mesas</small>
          </strong>
          <Ocupacion total={listaMesas.length} ocupadas={ocupadas} />
        </Metrica>
        <Metrica label="Rondas en cocina" cargando={cargando} className="lg:border-l lg:border-[var(--linea)]">
          <strong className={valorCls}>{rondas.length}</strong>
          <span className={demoradas.length > 0 ? subCls.replace('text-[var(--pizarra)]', 'font-semibold text-[var(--alerta)]') : subCls}>
            {demoradas.length > 0
              ? `${demoradas.length} ${demoradas.length === 1 ? 'espera' : 'esperan'} más de ${MINUTOS_ALERTA} min`
              : rondas.length > 0 ? 'Ninguna demorada' : 'Cocina sin pedidos'}
          </span>
        </Metrica>
        <Metrica label="Por cobrar" cargando={cargando} className="border-l border-[var(--linea)]">
          <strong className={valorCls}>{soles(porCobrar)}</strong>
          <span className={subCls}>
            {visitas.length === 0
              ? 'Sin cuentas abiertas'
              : `${visitas.length} cuenta${visitas.length !== 1 ? 's' : ''} abierta${visitas.length !== 1 ? 's' : ''}${externas > 0 ? ` · ${externas} para llevar o delivery` : ''}`}
          </span>
        </Metrica>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Necesita atención */}
          <Panel titulo="Necesita atención" extra={atencion.length > 0 ? `${atencion.length} asunto${atencion.length !== 1 ? 's' : ''}` : undefined}>
            {cargando ? (
              <Esqueleto filas={2} />
            ) : atencion.length === 0 ? (
              <div className="m-4 flex items-center gap-2.5 rounded-lg bg-[var(--ok-tint)] px-4 py-3 text-sm font-medium text-[#1c5e41]">
                <CircleCheck className="size-4 shrink-0" aria-hidden />
                Nada necesita tu atención ahora
              </div>
            ) : (
              <ul>
                {atencion.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 border-b border-[#EFEDE8] px-4 py-3 last:border-b-0 md:px-5">
                    <IconoAtencion id={a.id} nivel={a.nivel} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--ink)]">{a.titulo}</p>
                      <p className="mt-0.5 text-[12.5px] text-[var(--pizarra)]">{a.detalle}</p>
                    </div>
                    {a.href && (
                      <Link href={a.href} className={botonCls}>{a.accion}</Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Salón */}
          <Panel titulo="Salón" enlace={{ href: '/admin/mesas', label: 'Gestionar mesas' }}>
            {cargando ? (
              <Esqueleto filas={2} />
            ) : listaMesas.length === 0 ? (
              <Vacio titulo="Todavía no hay mesas" texto="Crea las mesas del salón para ver aquí su estado durante el servicio.">
                <Link href="/admin/mesas" className={botonCls}>Configurar mesas</Link>
              </Vacio>
            ) : (
              <>
                <ul className="grid grid-cols-3 gap-2.5 p-4 sm:grid-cols-4 md:p-5 xl:grid-cols-6">
                  {listaMesas.map((mesa) => {
                    const ocupada = mesa.estado === 'ocupada';
                    const espera = demoraPorMesa.get(mesa.numero);
                    const visita = visitaPorMesa.get(mesa.numero);
                    const enMesa = visita && actualizado ? Math.max(0, Math.floor((actualizado - new Date(visita.fechaApertura).getTime()) / 60000)) : null;
                    return (
                      <li
                        key={mesa.id}
                        className={[
                          'flex min-h-[68px] flex-col justify-between rounded-lg border px-2.5 py-2',
                          !ocupada && 'border-[var(--linea)] bg-[#FAF9F6] text-[var(--ink)]',
                          ocupada && !espera && 'border-[var(--tinta)] bg-[var(--tinta)] text-white',
                          espera && 'border-[var(--tinta)] bg-[var(--tinta)] text-white ring-2 ring-[var(--alerta)] ring-offset-1',
                        ].filter(Boolean).join(' ')}
                      >
                        <b className="text-base font-semibold tabular-nums">{mesa.numero}</b>
                        <span className={[
                          'text-[11.5px]',
                          espera ? 'font-semibold text-[#FFD2CC]' : ocupada ? 'text-white/70' : 'text-[var(--pizarra)]',
                        ].join(' ')}>
                          {espera
                            ? `Espera ${espera}′`
                            : ocupada ? (enMesa !== null ? duracion(enMesa) : 'Ocupada') : 'Libre'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-4 text-xs text-[var(--pizarra)] md:px-5">
                  <Leyenda className="border border-[var(--linea)] bg-[#FAF9F6]">Libre</Leyenda>
                  <Leyenda className="bg-[var(--tinta)]">Ocupada · tiempo en mesa</Leyenda>
                  <Leyenda className="bg-[var(--tinta)] ring-2 ring-[var(--alerta)]">Ronda espera más de {MINUTOS_ALERTA} min</Leyenda>
                </div>
              </>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <PanelCaja turnos={turnos} turnoAbierto={turnoAbierto} />

          {/* Cocina */}
          <Panel titulo="Cocina" extra={rondas.length > 0 ? 'La más antigua arriba' : undefined}>
            {cargando ? (
              <Esqueleto filas={3} />
            ) : rondas.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-[var(--pizarra)]">No hay rondas en curso.</p>
            ) : (
              <ul>
                {rondas.map((r) => (
                  <li key={r.pedidoId} className="flex items-center gap-3 border-b border-[#EFEDE8] px-4 py-2.5 last:border-b-0 md:px-5">
                    <span className="w-9 shrink-0 text-sm font-semibold text-[var(--ink)] tabular-nums">
                      {r.mesaNumero ? `M${r.mesaNumero}` : 'LL'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--ink)]">{lugar(r.mesaNumero)} · {platos(r)}</p>
                      <p className="text-[12.5px] text-[var(--pizarra)]">{ESTADO_RONDA[r.estado] ?? r.estado}</p>
                    </div>
                    <span className={[
                      'rounded-md px-2 py-0.5 text-[12.5px] font-semibold tabular-nums',
                      r.minutosEspera >= MINUTOS_ALERTA ? 'bg-[var(--alerta-tint)] text-[var(--alerta)]'
                        : r.minutosEspera >= MINUTOS_AVISO ? 'bg-[var(--aviso-tint)] text-[var(--aviso)]'
                        : 'bg-[var(--muted)] text-[var(--ink)]',
                    ].join(' ')}>
                      {r.minutosEspera}′
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ── Piezas ──────────────────────────────────────────────────

const valorCls = 'block text-[26px] leading-tight font-semibold tracking-[-0.02em] whitespace-nowrap text-[var(--ink)] tabular-nums md:text-[28px]';
const subCls = 'mt-1.5 block text-[12.5px] text-[var(--pizarra)]';
const botonCls = 'shrink-0 whitespace-nowrap rounded-[7px] border border-[var(--linea)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--tinta)]/40 hover:bg-[var(--tinta-tint)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]';

function platos(r: MonitorItem) {
  const n = r.items.reduce((s, i) => s + i.cantidad, 0);
  return `${n} plato${n !== 1 ? 's' : ''}`;
}

function EnVivo({ actualizado, sinConexion }: { actualizado: number | null; sinConexion: boolean }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!actualizado) return null;
  const seg = Math.max(0, Math.round((ahora - actualizado) / 1000));
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[var(--pizarra)]">
      <span className={[
        'size-2 rounded-full',
        sinConexion ? 'bg-[var(--aviso)]' : 'bg-[var(--aji)] shadow-[0_0_0_4px_var(--aji-tint)]',
      ].join(' ')} />
      {sinConexion ? 'Sin conexión' : 'En vivo'} · {seg < 60 ? `hace ${seg} s` : `hace ${Math.floor(seg / 60)} min`}
    </span>
  );
}

function Metrica({ label, cargando, className = '', children }: {
  label: string; cargando: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={['min-w-0 px-4 py-4 md:px-5', className].join(' ')}>
      <p className="mb-1.5 text-[12.5px] text-[var(--pizarra)]">{label}</p>
      {cargando ? (
        <>
          <div className="h-7 w-28 animate-pulse rounded bg-[var(--muted)]" />
          <div className="mt-2.5 h-3 w-36 animate-pulse rounded bg-[var(--muted)]" />
        </>
      ) : children}
    </div>
  );
}

function Ocupacion({ total, ocupadas }: { total: number; ocupadas: number }) {
  if (total === 0) return <span className={subCls}>Sin mesas configuradas</span>;
  // Un segmento por mesa hasta 24; con más mesas, una barra proporcional.
  if (total > 24) {
    return (
      <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-[var(--muted)]" aria-hidden>
        <div className="h-full bg-[var(--tinta)]" style={{ width: `${(ocupadas / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="mt-3 flex gap-[3px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={['h-1.5 flex-1 rounded-[2px]', i < ocupadas ? 'bg-[var(--tinta)]' : 'bg-[var(--muted)]'].join(' ')} />
      ))}
    </div>
  );
}

function Panel({ titulo, extra, enlace, children }: {
  titulo: string; extra?: string; enlace?: { href: string; label: string }; children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--linea)] px-4 py-3 md:px-5">
        <h2 className="text-[14.5px] font-semibold text-[var(--ink)]">{titulo}</h2>
        {enlace ? (
          <Link href={enlace.href} className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-[var(--tinta)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]">
            {enlace.label} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : extra ? (
          <span className="text-[12.5px] text-[var(--pizarra)]">{extra}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function IconoAtencion({ id, nivel }: { id: string; nivel: 'alerta' | 'aviso' }) {
  const Icono = id.startsWith('tk-') ? Printer : id.startsWith('stock') ? Package : id === 'caja' ? Wallet : CircleAlert;
  return (
    <span className={[
      'grid size-8 shrink-0 place-items-center rounded-lg',
      nivel === 'alerta' ? 'bg-[var(--alerta-tint)] text-[var(--alerta)]' : 'bg-[var(--aviso-tint)] text-[var(--aviso)]',
    ].join(' ')}>
      <Icono className="size-4" aria-hidden />
      <span className="sr-only">{nivel === 'alerta' ? 'Urgente' : 'Aviso'}</span>
    </span>
  );
}

function PanelCaja({ turnos, turnoAbierto }: { turnos: TurnoResumen[] | null; turnoAbierto?: TurnoResumen }) {
  if (turnos === null) {
    return <Panel titulo="Caja"><Esqueleto filas={3} /></Panel>;
  }

  if (!turnoAbierto) {
    const cerrados = turnos.filter((t) => t.estado === 'cerrado');
    const cerradoHoy = cerrados.reduce((s, t) => s + parseFloat(t.totalTurno), 0);
    return (
      <Panel titulo="Caja" enlace={{ href: '/admin/turnos', label: 'Ver turnos' }}>
        <Vacio titulo="No hay un turno de caja abierto" texto="Los cobros aparecerán aquí cuando el cajero abra turno.">
          {cerrados.length > 0 && (
            <p className="text-[13px] text-[var(--ink)]">
              Cerrado hoy: <b className="font-semibold tabular-nums">{soles(cerradoHoy)}</b>
              {' '}({cerrados.length} turno{cerrados.length !== 1 ? 's' : ''})
            </p>
          )}
        </Vacio>
      </Panel>
    );
  }

  const t = turnoAbierto;
  const total = parseFloat(t.totalTurno);
  const canales = CANALES.map((c) => ({ ...c, monto: parseFloat(t.porCanal[c.key] ?? '0') }));
  const gastos = parseFloat(t.totalGastos ?? '0');

  return (
    <Panel titulo="Caja" enlace={{ href: '/admin/turnos', label: 'Ver turno' }}>
      <div className="p-4 md:p-5">
        <div className="flex justify-between gap-3 text-[13px] whitespace-nowrap text-[var(--pizarra)]">
          <span className="truncate">{t.cajeroNombre} · desde {hora(t.fechaApertura)}</span>
          <span className="tabular-nums">Apertura {soles(parseFloat(t.montoApertura))}</span>
        </div>
        <p className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.02em] text-[var(--ink)] tabular-nums">{soles(total)}</p>
        <p className="text-[13px] text-[var(--pizarra)]">
          Cobrado en el turno · {t.cobros} cobro{t.cobros !== 1 ? 's' : ''}
        </p>

        {total > 0 && (
          <div className="mt-4 mb-3 flex h-2 gap-0.5 overflow-hidden rounded" aria-hidden>
            {canales.filter((c) => c.monto > 0).map((c) => (
              <span key={c.key} style={{ flexGrow: c.monto, background: c.color }} />
            ))}
          </div>
        )}
        <dl className={total > 0 ? '' : 'mt-4'}>
          {canales.map((c) => (
            <div key={c.key} className="flex items-center gap-2 py-1 text-[13px]">
              <span className="size-2 rounded-[2px]" style={{ background: c.color }} />
              <dt className="flex-1 text-[var(--ink)]">{c.label}</dt>
              <dd className={['font-semibold tabular-nums', c.monto > 0 ? 'text-[var(--ink)]' : 'text-[var(--pizarra)]'].join(' ')}>
                {soles(c.monto)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex justify-between border-t border-[#EFEDE8] pt-3 text-[13px] text-[var(--pizarra)]">
          <span>Gastos del turno</span>
          <b className="font-semibold text-[var(--ink)] tabular-nums">{gastos > 0 ? `− ${soles(gastos)}` : soles(0)}</b>
        </div>
      </div>
    </Panel>
  );
}

function Vacio({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="m-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--linea)] px-4 py-6 text-center md:m-5">
      <p className="text-sm font-semibold text-[var(--ink)]">{titulo}</p>
      <p className="max-w-[40ch] text-[13px] text-[var(--pizarra)]">{texto}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

function Leyenda({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={['inline-block size-2.5 rounded-[3px]', className].join(' ')} />
      {children}
    </span>
  );
}

function Esqueleto({ filas }: { filas: number }) {
  return (
    <div className="space-y-3 p-4 md:p-5" aria-hidden>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-[var(--muted)]" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}
