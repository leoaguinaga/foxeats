import { estadoArqueo, soles } from './fechas';
import type { TurnoResumen } from '@/lib/api';

/** Estado del arqueo como etiqueta: en curso (tinta), cuadra (ok), falta (alerta), sobra (aviso). */
export function PildoraArqueo({ turno }: { turno: Pick<TurnoResumen, 'estado' | 'diferencia'> }) {
  const e = estadoArqueo(turno);
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap';
  if (e.tipo === 'curso') {
    return (
      <span className={`${base} bg-[var(--tinta)] text-white`}>
        <i className="size-1.5 rounded-full bg-[var(--aji)]" />En curso
      </span>
    );
  }
  if (e.tipo === 'ok') return <span className={`${base} bg-[var(--ok-tint)] text-[var(--ok)]`}>Cuadra</span>;
  if (e.tipo === 'falta') return <span className={`${base} bg-[var(--alerta-tint)] text-[var(--alerta)]`}>Falta S/ {soles(e.monto)}</span>;
  return <span className={`${base} bg-[var(--aviso-tint)] text-[var(--aviso)]`}>Sobra S/ {soles(e.monto)}</span>;
}
