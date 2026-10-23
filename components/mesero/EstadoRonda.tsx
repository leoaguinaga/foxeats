import { Check, Clock } from 'lucide-react';
import type { EstadoPedido } from '@/lib/types';
import { MINUTOS_ALERTA, MINUTOS_AVISO, duracionCorta } from './salon/servicio';

const base = 'inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-[12px] leading-[17px] font-semibold whitespace-nowrap tabular-nums';

/**
 * Estado de una ronda con las mismas pastillas del salón: en cocina con los
 * minutos (calma, aviso desde 10, alerta desde 15, sin parpadeo), lista,
 * entregada o cancelada.
 */
export function EstadoRonda({ estado, minutos }: { estado: EstadoPedido; minutos: number }) {
  switch (estado) {
    case 'listo':
      return <span className={`${base} bg-[var(--ok-tint)] text-[var(--ok)]`}><Check className="size-3" strokeWidth={2.4} aria-hidden />Lista</span>;
    case 'entregado':
      return <span className={`${base} bg-[#ECEBE6] pl-2 font-medium text-[var(--pizarra)]`}>Entregada</span>;
    case 'cancelado':
      return <span className={`${base} bg-[#ECEBE6] pl-2 font-medium text-[var(--pizarra)]`}>Cancelada</span>;
    default: {
      const color = minutos >= MINUTOS_ALERTA
        ? 'bg-[var(--alerta)] text-white'
        : minutos >= MINUTOS_AVISO
          ? 'bg-[var(--aviso-tint)] text-[var(--aviso)]'
          : 'bg-[#ECEBE6] text-[var(--ink)]';
      return (
        <span className={`${base} ${color}`} aria-label={`En cocina hace ${minutos} minutos`}>
          <Clock className="size-3" strokeWidth={2.4} aria-hidden />Cocina {duracionCorta(minutos)}
        </span>
      );
    }
  }
}
