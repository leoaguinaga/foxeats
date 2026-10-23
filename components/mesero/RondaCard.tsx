'use client';

import { Pedido, PlatoCarta } from '@/lib/types';
import { EstadoBadge } from './EstadoBadge';

interface Props {
  pedido: Pedido;
  platoMap: Map<string, PlatoCarta>;
  onCancelar: (pedidoId: string) => void;
  onCancelarItem?: (itemId: string) => void;
  cargando?: boolean;
}

const ESTADOS_ACTIVOS = ['pendiente', 'en_preparacion', 'listo'];

export function RondaCard({ pedido, platoMap, onCancelar, onCancelarItem, cargando }: Props) {
  const hora = new Date(pedido.fechaCreacion).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const subtotal = pedido.items
    .filter((i) => i.estado !== 'cancelado')
    .reduce(
      (s, i) => s + parseFloat(i.precioUnitarioCongelado) * i.cantidad,
      0,
    );

  const activo = ESTADOS_ACTIVOS.includes(pedido.estado);
  const codigoRonda = `R-${String(pedido.numeroCorto).padStart(4, '0')}`;

  return (
    <div className={[
      'rounded-xl border bg-white p-4 space-y-3 transition-opacity',
      !activo ? 'opacity-60' : '',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-[var(--ink)]">{codigoRonda}</span>
          <span className="text-xs text-muted-foreground">· {hora}</span>
        </div>
        <EstadoBadge estado={pedido.estado} />
      </div>

      {pedido.paraLlevar && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--tinta)]/10 px-3 py-1.5 border border-[var(--tinta)]/30">
          <span className="text-base leading-none">🥡</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[var(--tinta)] uppercase tracking-wide">Para llevar</p>
            {pedido.nombreClienteLlevar && (
              <p className="text-sm font-medium text-[var(--ink)] truncate">{pedido.nombreClienteLlevar}</p>
            )}
          </div>
        </div>
      )}

      {pedido.estado === 'cancelado' && pedido.motivoCancelacion && (
        <p className="text-xs text-muted-foreground italic">
          Motivo: {pedido.motivoCancelacion}
        </p>
      )}

      <ul className="space-y-1.5">
        {pedido.items.map((item) => {
          const plato = platoMap.get(item.platoCartaId);
          const tachado = pedido.estado === 'cancelado' || item.estado === 'cancelado';
          return (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className={tachado ? 'opacity-50 line-through flex-1 min-w-0' : 'flex-1 min-w-0'}>
                <span className="font-medium">{item.cantidad}×</span>{' '}
                <span>{plato?.nombre ?? item.platoCartaId}</span>
                {item.notas && (
                  <span className="ml-2 text-xs text-muted-foreground italic">→ {item.notas}</span>
                )}
              </span>
              {activo && !tachado && onCancelarItem && (
                <button
                  onClick={() => onCancelarItem(item.id)}
                  disabled={cargando}
                  className="text-xs text-muted-foreground hover:text-[var(--alerta)] transition-colors opacity-70 hover:opacity-100 px-1 py-0.5 font-bold"
                  title="Cancelar producto"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-sm text-muted-foreground">S/{subtotal.toFixed(2)}</span>

        {activo && (
          <button
            onClick={() => onCancelar(pedido.id)}
            disabled={cargando}
            className="text-xs text-muted-foreground hover:text-[var(--alerta)] underline transition-colors disabled:opacity-40"
          >
            {cargando ? '…' : 'Cancelar ronda'}
          </button>
        )}
      </div>
    </div>
  );
}

