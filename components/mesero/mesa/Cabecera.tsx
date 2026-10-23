'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MoreHorizontal, Printer } from 'lucide-react';
import type { Visita } from '@/lib/types';
import { soles } from '@/components/admin/caja/fechas';
import { duracionCorta, primerNombre } from '@/components/mesero/salon/servicio';

/** Nombre de la visita: «Mesa 6», «Barra 1», «Para llevar · Leonardo», «Delivery · Rosa». */
export function tituloVisita(v: Visita): string {
  if (v.tipo === 'mesa') return v.mesa?.etiqueta ?? 'Mesa';
  const base = v.tipo === 'delivery' ? 'Delivery' : 'Para llevar';
  return v.nombreCliente ? `${base} · ${v.nombreCliente}` : base;
}

/**
 * Cabecera de la mesa: qué mesa es, zona, hace cuánto se abrió y quién la
 * atiende; a la derecha el consumo, la precuenta y el menú «⋯».
 */
export function Cabecera({ visita, ahora, consumo, imprimiendo, onPrecuenta, onLiberar }: {
  visita: Visita;
  ahora: number;
  consumo: number;
  imprimiendo: boolean;
  onPrecuenta: () => void;
  onLiberar: () => void;
}) {
  const minutos = Math.max(0, Math.floor((ahora - new Date(visita.fechaApertura).getTime()) / 60000));
  const meta = [
    visita.mesa?.zona,
    `abierta hace ${duracionCorta(minutos)}`,
    visita.abiertaPor ? primerNombre(visita.abiertaPor.nombre) : null,
  ].filter(Boolean).join(' · ');
  const delivery = visita.tipo === 'delivery'
    ? [visita.telefonoCliente, visita.direccionDelivery].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="flex items-center gap-3 border-b border-[var(--linea)] bg-white px-4 py-2.5 md:px-6">
      <Link
        href="/mesero"
        className="-ml-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[13.5px] font-semibold text-[var(--tinta)] hover:bg-[var(--tinta-tint)] focus-visible:outline-2 focus-visible:outline-[var(--tinta)]"
      >
        <ArrowLeft className="size-4" strokeWidth={1.9} aria-hidden />
        <span className="max-sm:sr-only">Salón</span>
      </Link>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] leading-tight font-semibold tracking-[-0.01em] text-[var(--ink)]">{tituloVisita(visita)}</h1>
        <p className="truncate text-[12.5px] text-[var(--pizarra)] tabular-nums">
          <span className="max-sm:hidden">{meta}</span>
          <span className="sm:hidden">{duracionCorta(minutos)}</span>
          {delivery && <span> · {delivery}</span>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[11.5px] text-[var(--pizarra)]">Consumo</p>
        <p className="text-[17px] leading-tight font-semibold text-[var(--ink)] tabular-nums">S/ {soles(consumo)}</p>
      </div>

      <button
        type="button"
        onClick={onPrecuenta}
        disabled={consumo <= 0 || imprimiendo}
        title={consumo <= 0 ? 'Todavía no hay consumo' : 'Imprime la precuenta en la ticketera de recibos'}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--linea)] bg-white px-3 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)] disabled:opacity-45 max-sm:px-2.5"
      >
        <Printer className="size-4" strokeWidth={1.9} aria-hidden />
        <span className="max-sm:sr-only">{imprimiendo ? 'Imprimiendo…' : 'Precuenta'}</span>
      </button>

      <MenuMas visita={visita} consumo={consumo} onLiberar={onLiberar} />
    </div>
  );
}

function MenuMas({ visita, consumo, onLiberar }: { visita: Visita; consumo: number; onLiberar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAbierto(false); } };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc, true); };
  }, [abierto]);

  const mesa = visita.tipo === 'mesa' && !visita.paraLlevar;
  const conConsumo = consumo > 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Más acciones"
        aria-expanded={abierto}
        className="grid size-9 place-items-center rounded-lg text-[var(--pizarra)] hover:bg-[var(--piedra)] hover:text-[var(--ink)]"
      >
        <MoreHorizontal className="size-5" strokeWidth={1.9} />
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white py-1 shadow-[0_12px_30px_-12px_rgba(22,25,34,.35)]">
          <button
            type="button"
            role="menuitem"
            disabled={conConsumo}
            onClick={() => { setAbierto(false); onLiberar(); }}
            className="block w-full px-3 py-2 text-left hover:bg-[var(--piedra)] disabled:pointer-events-none"
          >
            <span className={['block text-[13.5px] font-medium', conConsumo ? 'text-[#8A8D98]' : 'text-[var(--ink)]'].join(' ')}>
              {mesa ? 'Liberar mesa' : 'Cerrar pedido'}
            </span>
            {conConsumo && <span className="block text-[12px] text-[var(--pizarra)]">Tiene consumo: se cierra al cobrar en caja.</span>}
          </button>
        </div>
      )}
    </div>
  );
}
