'use client';

import { useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import type { ItemPedido, Pedido, PlatoCarta } from '@/lib/types';
import { hora, soles } from '@/components/admin/caja/fechas';
import { EstadoRonda } from '@/components/mesero/EstadoRonda';

const ACTIVAS = ['pendiente', 'en_preparacion', 'listo'];

/**
 * Lo que la mesa ya pidió: rondas activas primero (la más nueva arriba) y al
 * final, atenuadas, las entregadas y canceladas.
 */
export function EnLaMesa({ pedidos, platoMap, ahora, ocupado, onEntregada, onQuitarItem, onCancelarRonda }: {
  pedidos: Pedido[];
  platoMap: Map<string, PlatoCarta>;
  ahora: number;
  /** Ronda o plato que se está guardando. */
  ocupado: string | null;
  onEntregada: (pedidoId: string) => void;
  onQuitarItem: (itemId: string) => Promise<boolean>;
  onCancelarRonda: (pedidoId: string) => void;
}) {
  if (pedidos.length === 0) {
    return <p className="px-5 py-12 text-center text-[14px] text-[var(--pizarra)]">Esta mesa todavía no pidió nada. Las rondas que envíes aparecerán aquí.</p>;
  }

  // «Ronda 1, 2…» en el orden en que se pidieron.
  const enOrden = [...pedidos].sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());
  const numero = new Map(enOrden.map((p, i) => [p.id, i + 1]));
  const recientes = [...enOrden].reverse();
  const lista = [
    ...recientes.filter((p) => ACTIVAS.includes(p.estado)),
    ...recientes.filter((p) => !ACTIVAS.includes(p.estado)),
  ];

  return (
    <ul className="space-y-3 p-4">
      {lista.map((p) => (
        <RondaPedida
          key={p.id}
          pedido={p}
          numero={numero.get(p.id) ?? 1}
          platoMap={platoMap}
          ahora={ahora}
          ocupado={ocupado}
          onEntregada={onEntregada}
          onQuitarItem={onQuitarItem}
          onCancelarRonda={onCancelarRonda}
        />
      ))}
    </ul>
  );
}

function RondaPedida({ pedido, numero, platoMap, ahora, ocupado, onEntregada, onQuitarItem, onCancelarRonda }: {
  pedido: Pedido;
  numero: number;
  platoMap: Map<string, PlatoCarta>;
  ahora: number;
  ocupado: string | null;
  onEntregada: (pedidoId: string) => void;
  onQuitarItem: (itemId: string) => Promise<boolean>;
  onCancelarRonda: (pedidoId: string) => void;
}) {
  const [porQuitar, setPorQuitar] = useState<string | null>(null);
  const activa = ACTIVAS.includes(pedido.estado);
  const minutos = Math.max(0, Math.floor((ahora - new Date(pedido.fechaCreacion).getTime()) / 60000));
  const vigentes = pedido.items.filter((i) => i.estado !== 'cancelado');
  const subtotal = vigentes.reduce((s, i) => s + parseFloat(i.precioUnitarioCongelado) * i.cantidad, 0);
  const nombre = (i: ItemPedido) => platoMap.get(i.platoCartaId)?.nombre ?? 'Plato';
  const ocupada = ocupado === pedido.id || pedido.items.some((i) => i.id === ocupado);

  return (
    <li className={['rounded-[10px] border border-[var(--linea)] bg-white', activa ? '' : 'opacity-60'].join(' ')}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-[var(--ink)]">Ronda {numero}</p>
          <p className="text-[12.5px] text-[var(--pizarra)] tabular-nums">
            {hora(pedido.fechaCreacion)} · R-{String(pedido.numeroCorto).padStart(4, '0')}
          </p>
        </div>
        <EstadoRonda estado={pedido.estado} minutos={minutos} />
      </div>

      {pedido.paraLlevar && (
        <p className="mx-4 mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-[var(--tinta-tint)] px-2 py-0.5 text-[12.5px] font-semibold text-[var(--tinta)]">
          <ShoppingBag className="size-3.5" strokeWidth={2} aria-hidden />
          Para llevar{pedido.nombreClienteLlevar ? ` · ${pedido.nombreClienteLlevar}` : ''}
        </p>
      )}

      <ul className="px-4">
        {pedido.items.map((i) => {
          const cancelado = i.estado === 'cancelado' || pedido.estado === 'cancelado';
          if (porQuitar === i.id) {
            return (
              <li key={i.id} className="-mx-2 my-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[var(--alerta-tint)] px-2 py-2 text-[13.5px]">
                <span className="min-w-0 flex-1 text-[var(--ink)]">
                  <span className="font-semibold">¿Quitar {i.cantidad} {nombre(i)}?</span>{' '}
                  <span className="text-[var(--pizarra)] tabular-nums">Se descuenta S/ {soles(parseFloat(i.precioUnitarioCongelado) * i.cantidad)}</span>
                </span>
                <span className="flex gap-1.5">
                  <button type="button" onClick={() => setPorQuitar(null)} className="h-8 rounded-md border border-[var(--linea)] bg-white px-3 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)]">No</button>
                  <button
                    type="button"
                    disabled={ocupada}
                    onClick={async () => { if (await onQuitarItem(i.id)) setPorQuitar(null); }}
                    className="h-8 rounded-md bg-[var(--alerta)] px-3 text-[13px] font-semibold text-white hover:bg-[var(--alerta-hover)] disabled:opacity-50"
                  >
                    {ocupado === i.id ? 'Quitando…' : 'Quitar'}
                  </button>
                </span>
              </li>
            );
          }
          return (
            <li key={i.id} className="flex items-start gap-2.5 py-1.5 text-[14px]">
              <span className={['w-5 shrink-0 text-right font-semibold tabular-nums', cancelado ? 'text-[#8A8D98]' : 'text-[var(--ink)]'].join(' ')}>{i.cantidad}</span>
              <span className={['min-w-0 flex-1', cancelado ? 'text-[#8A8D98] line-through' : 'text-[var(--ink)]'].join(' ')}>
                {nombre(i)}
                {i.notas && <span className="ml-1.5 text-[13px] text-[var(--pizarra)] no-underline">{i.notas}</span>}
              </span>
              {activa && !cancelado && (
                <button
                  type="button"
                  onClick={() => setPorQuitar(i.id)}
                  aria-label={`Quitar ${nombre(i)}`}
                  className="-my-1 grid size-7 shrink-0 place-items-center rounded-md text-[var(--pizarra)] hover:bg-[var(--piedra)] hover:text-[var(--alerta)]"
                >
                  <X className="size-4" strokeWidth={1.9} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {pedido.estado === 'cancelado' && pedido.motivoCancelacion && (
        <p className="px-4 pt-1 text-[12.5px] text-[var(--pizarra)]">Motivo: {pedido.motivoCancelacion}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--linea)] px-4 py-2.5">
        <span className="shrink-0 text-[13.5px] font-semibold whitespace-nowrap text-[var(--ink)] tabular-nums">S/ {soles(subtotal)}</span>
        {activa && (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              onClick={() => onCancelarRonda(pedido.id)}
              disabled={ocupada}
              className="rounded-md px-2 py-1 text-[13px] font-medium text-[var(--pizarra)] hover:bg-[var(--alerta-tint)] hover:text-[var(--alerta)] disabled:opacity-50"
            >
              Cancelar ronda
            </button>
            {pedido.estado === 'listo' && (
              <button
                type="button"
                onClick={() => onEntregada(pedido.id)}
                disabled={ocupada}
                className="h-9 rounded-lg bg-[var(--tinta)] px-3.5 text-[13.5px] font-semibold text-white hover:bg-[var(--tinta-hover)] disabled:opacity-50"
              >
                {ocupado === pedido.id ? 'Guardando…' : 'Marcar entregada'}
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  );
}
