'use client';

import { Bike, ChevronRight, Plus, ShoppingBag } from 'lucide-react';
import type { VisitaResumen } from '@/lib/api';
import { soles } from '@/components/admin/caja/fechas';

function minutosDesde(iso: string, ahora: number) {
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function Fila({ v, ahora, onClick }: { v: VisitaResumen; ahora: number; onClick: () => void }) {
  const rondas = `${v.pedidos} ${v.pedidos === 1 ? 'ronda' : 'rondas'}`;
  const tiempo = minutosDesde(v.fechaApertura, ahora);

  const insignia = v.tipo === 'mesa'
    ? <span className="text-[16px] font-bold tabular-nums">{v.mesaNumero}</span>
    : v.tipo === 'llevar'
      ? <ShoppingBag className="size-5" strokeWidth={1.9} aria-hidden />
      : <Bike className="size-5" strokeWidth={1.9} aria-hidden />;

  const titulo = v.tipo === 'mesa' ? `Mesa ${v.mesaNumero}` : v.nombreCliente || 'Cliente';
  const detalle = v.tipo === 'mesa'
    ? `${tiempo} · ${rondas}`
    : v.tipo === 'llevar'
      ? `Para llevar · ${tiempo}`
      : `Delivery${v.direccionDelivery ? ` · ${v.direccionDelivery}` : ''} · ${tiempo}`;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group grid w-full grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[var(--piedra)]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--tinta)]"
      >
        <span className="grid size-11 place-items-center rounded-[9px] bg-[var(--tinta-tint)] text-[var(--tinta)]">{insignia}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-[var(--ink)]">{titulo}</span>
            {v.listo && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--ok-tint)] px-2 py-px text-[11.5px] font-semibold text-[var(--ok)]">
                <span className="size-1.5 rounded-full bg-[var(--ok)]" aria-hidden />Listo para entregar
              </span>
            )}
          </span>
          <span className="block truncate text-[13px] text-[var(--pizarra)]">{detalle}</span>
        </span>
        <span className="min-w-[88px] text-right text-[17px] font-semibold text-[var(--ink)] tabular-nums">S/ {soles(v.total)}</span>
        <ChevronRight className="size-4 text-[#9A9DA8] transition-transform group-hover:translate-x-0.5" strokeWidth={1.9} aria-hidden />
      </button>
    </li>
  );
}

export function PorCobrar({ visitas, ahora, onSeleccionar, onNuevoPedido, onGasto }: {
  visitas: VisitaResumen[];
  ahora: number;
  onSeleccionar: (v: VisitaResumen) => void;
  onNuevoPedido: () => void;
  onGasto: () => void;
}) {
  // Las más antiguas primero: son las que llevan más tiempo esperando.
  const orden = [...visitas].sort((a, b) => a.fechaApertura.localeCompare(b.fechaApertura));

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 md:px-6 md:py-6">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          Por cobrar
          <span className="ml-2 text-[14px] font-medium text-[var(--pizarra)]">
            {visitas.length === 0 ? 'nada pendiente' : `${visitas.length} ${visitas.length === 1 ? 'cuenta' : 'cuentas'}`}
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onGasto}
            className="h-9 rounded-lg border border-[var(--linea)] bg-white px-3 text-[13.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--piedra)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]"
          >
            Registrar gasto
          </button>
          <button
            type="button"
            onClick={onNuevoPedido}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--tinta)] px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[var(--tinta-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)]"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            Nuevo pedido
            <kbd className="hidden rounded border border-white/30 bg-white/10 px-1.5 text-[11px] font-semibold lg:inline">N</kbd>
          </button>
        </div>
      </div>

      {orden.some((v) => v.tipo === 'mesa') && (
        <p className="mb-2 hidden text-[12.5px] text-[var(--pizarra)] lg:block">Escribe el número de una mesa y pulsa Enter para cobrarla.</p>
      )}

      {orden.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--linea)] bg-white px-6 py-14 text-center">
          <p className="text-[15px] font-semibold text-[var(--ink)]">Nada por cobrar ahora</p>
          <p className="mx-auto mt-1 max-w-[44ch] text-[14px] text-[var(--pizarra)]">
            Las mesas con consumo y los pedidos para llevar o delivery guardados aparecen aquí.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--linea)] overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
          {orden.map((v) => <Fila key={v.visitaId} v={v} ahora={ahora} onClick={() => onSeleccionar(v)} />)}
        </ul>
      )}
    </div>
  );
}
