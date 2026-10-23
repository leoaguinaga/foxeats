import { Tag } from 'lucide-react';
import type { PromocionVigente } from '@/lib/types';
import { etiquetaDescuento } from '@/lib/promociones';

/** Franja «Promos ahora» del pedido de mesa y de la carta del mesero. */
export function PromosAhora({ promos }: { promos: PromocionVigente[] }) {
  if (promos.length === 0) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 rounded-[10px] bg-[var(--aji-tint)] px-3 py-2 text-[13px] text-[var(--ink)]">
      <span className="inline-flex items-center gap-1.5 font-semibold"><Tag className="size-3.5 self-center" strokeWidth={2} aria-hidden />Promos ahora:</span>
      {promos.map((pr, i) => (
        <span key={pr.id}>
          {i > 0 && <span className="text-[var(--pizarra)]">· </span>}
          <span className="font-semibold tabular-nums">{etiquetaDescuento(pr)}</span> {pr.nombre}
          <span className="text-[var(--pizarra)]">{pr.horaFin ? ` hasta las ${pr.horaFin.slice(0, 5)}` : ' todo el día'}</span>
        </span>
      ))}
    </p>
  );
}
