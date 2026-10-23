import type { CajaPeriodo } from '@/lib/api';
import { CANALES, soles } from './fechas';

const TIPO_LABEL = { mesa: 'Mesa', llevar: 'Para llevar', delivery: 'Delivery' } as const;

function Fila({ etiqueta, pct, valor, nota }: { etiqueta: string; pct: number; valor: string; nota: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_84px] items-center gap-2.5 text-[13.5px]">
      <span>{etiqueta}</span>
      <span className="h-2 overflow-hidden rounded-full bg-[var(--muted)]"><b className="block h-full rounded-full bg-[var(--tinta)]" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} /></span>
      <span className="text-right font-semibold">{valor}<small className="block text-[11.5px] font-medium text-[var(--pizarra)]">{nota}</small></span>
    </div>
  );
}

export function DeDondeVino({ datos, titulo }: { datos: CajaPeriodo; titulo: string }) {
  const r = datos.resumen;
  const total = parseFloat(r.ingresos) || 1;
  return (
    <section className="rounded-[10px] border border-[var(--linea)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--linea)] px-4 py-3">
        <h3 className="text-sm font-semibold">De dónde vino</h3>
        <span className="text-[12.5px] text-[var(--pizarra)]">{titulo}</span>
      </header>
      <div className="flex flex-col gap-3 px-4 py-4">
        <span className="text-xs font-semibold tracking-wide text-[var(--pizarra)]">Medio de pago</span>
        {CANALES.map((c) => {
          const m = parseFloat(r.porCanal[c.key]);
          return <Fila key={c.key} etiqueta={c.label} pct={(m / total) * 100} valor={soles(m)} nota={`${Math.round((m / total) * 100)} %`} />;
        })}
        <div className="my-1 h-px bg-[var(--linea)]" />
        <span className="text-xs font-semibold tracking-wide text-[var(--pizarra)]">Tipo de pedido</span>
        {r.porTipo.map((t) => (
          <Fila key={t.tipo} etiqueta={TIPO_LABEL[t.tipo]} pct={(parseFloat(t.monto) / total) * 100} valor={soles(t.monto)} nota={`${t.cuentas} ${t.cuentas === 1 ? 'cuenta' : 'cuentas'}`} />
        ))}
      </div>
    </section>
  );
}
