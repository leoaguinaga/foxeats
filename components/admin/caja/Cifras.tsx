import type { CajaPeriodo } from '@/lib/api';
import { soles } from './fechas';

function Kpi({ etiqueta, children, nota, grande = false }: { etiqueta: string; children: React.ReactNode; nota?: string; grande?: boolean }) {
  return (
    <div className="border-t border-[var(--linea)] px-4 py-3.5 first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0">
      <p className="mb-1 text-[12.5px] text-[var(--pizarra)]">{etiqueta}</p>
      <p className={['font-bold leading-tight tracking-tight text-[var(--ink)]', grande ? 'text-[28px]' : 'text-[22px]'].join(' ')}>{children}</p>
      {nota && <p className="mt-0.5 text-xs text-[var(--pizarra)]">{nota}</p>}
    </div>
  );
}

const Cur = () => <span className="mr-0.5 text-[0.62em] font-semibold text-[var(--pizarra)]">S/</span>;

export function FranjaCifras({ datos, enCurso }: { datos: CajaPeriodo; enCurso: boolean }) {
  const r = datos.resumen;
  const dif = parseFloat(r.arqueo.diferencia);
  const pesos = datos.desde === datos.hasta;
  return (
    <div className="grid grid-cols-2 rounded-[10px] border border-[var(--linea)] bg-white md:grid-cols-[1.25fr_1fr_1fr_1fr_1fr]">
      <div className="col-span-2 md:col-span-1">
        <Kpi etiqueta="Ingresos" grande nota={`${r.cuentas} ${r.cuentas === 1 ? 'cuenta' : 'cuentas'} · ticket S/ ${soles(r.ticketPromedio)}`}>
          <Cur />{soles(r.ingresos)}
        </Kpi>
      </div>
      <Kpi etiqueta="Gastos de caja" nota={`${r.cantidadGastos} ${r.cantidadGastos === 1 ? 'gasto' : 'gastos'}`}><Cur />{soles(r.gastos)}</Kpi>
      <Kpi etiqueta="Neto" nota="ingresos − gastos"><Cur />{soles(r.neto)}</Kpi>
      {pesos && enCurso && r.gavetaAhora ? (
        <Kpi etiqueta="En gaveta ahora" nota={`efectivo esperado · ${r.gavetaAhora.cajero.split(' ')[0]}`}><Cur />{soles(r.gavetaAhora.monto)}</Kpi>
      ) : !pesos && r.mejorDia ? (
        <Kpi etiqueta="Mejor día" nota={new Date(`${r.mejorDia.clave}T12:00:00-05:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', timeZone: 'America/Lima' })}><Cur />{soles(r.mejorDia.monto)}</Kpi>
      ) : (
        <Kpi etiqueta="Efectivo cobrado" nota="en caja, sin descontar gastos"><Cur />{soles(r.porCanal.efectivo)}</Kpi>
      )}
      <Kpi
        etiqueta="Diferencias de arqueo"
        nota={r.arqueo.turnosCerrados
          ? `${r.arqueo.turnosConDiferencia} de ${r.arqueo.turnosCerrados} ${r.arqueo.turnosCerrados === 1 ? 'turno cerrado' : 'turnos cerrados'} no cuadr${r.arqueo.turnosConDiferencia === 1 ? 'ó' : 'aron'}`
          : 'sin turnos cerrados'}
      >
        <span className={Math.abs(dif) < 0.005 ? '' : dif < 0 ? 'text-[var(--alerta)]' : 'text-[var(--aviso)]'}>
          {Math.abs(dif) < 0.005 ? 'S/ 0.00' : `${dif < 0 ? '−' : '+'}S/ ${soles(Math.abs(dif))}`}
        </span>
      </Kpi>
    </div>
  );
}

/** Lo que pide revisión: faltantes, sobrantes y ajustes manuales. */
export function Atencion({ datos, onTurno, onAjustes }: { datos: CajaPeriodo; onTurno: (id: string) => void; onAjustes: () => void }) {
  const items: Array<{ nivel: 'al' | 'av'; clave: string; titulo: string; detalle: string; accion: string; onClick: () => void }> = [];

  for (const t of datos.turnos) {
    if (t.estado !== 'cerrado' || t.diferencia == null) continue;
    const d = parseFloat(t.diferencia);
    if (Math.abs(d) < 0.005) continue;
    items.push({
      nivel: d < 0 ? 'al' : 'av',
      clave: t.id,
      titulo: `El turno de ${t.cajeroNombre} cerró con ${d < 0 ? 'faltante' : 'sobrante'} de S/ ${soles(Math.abs(d))}.`,
      detalle: `Contó S/ ${soles(t.montoCierreReal ?? 0)}, se esperaban S/ ${soles(t.montoCierreTeorico)}.`,
      accion: 'Ver arqueo',
      onClick: () => onTurno(t.id),
    });
  }

  const aj = datos.resumen.ajustes;
  if (aj.length) {
    const lista = aj.slice(0, 2).map((a) => {
      const m = parseFloat(a.monto);
      return `${m < 0 ? '−' : '+'}S/ ${soles(Math.abs(m))} ${a.motivo ? a.motivo.toLowerCase() : 'ajuste'} en ${a.cuenta}`;
    }).join(' · ');
    items.push({
      nivel: 'av',
      clave: 'ajustes',
      titulo: `${aj.length} ${aj.length === 1 ? 'ajuste manual' : 'ajustes manuales'}:`,
      detalle: lista + (aj.length > 2 ? ` · y ${aj.length - 2} más` : ''),
      accion: 'Ver ajustes',
      onClick: onAjustes,
    });
  }

  if (!items.length) return null;
  return (
    <ul className="mt-3.5 rounded-[10px] border border-[var(--linea)] bg-white">
      {items.map((i) => (
        <li key={i.clave} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--linea)] px-4 py-2.5 text-[13.5px] first:border-t-0">
          <i className={['size-2 rounded-full', i.nivel === 'al' ? 'bg-[var(--alerta)]' : 'bg-[var(--aviso)]'].join(' ')} />
          <span><b className="font-semibold">{i.titulo}</b> <span className="text-[var(--pizarra)]">{i.detalle}</span></span>
          <button type="button" onClick={i.onClick} className="rounded-md px-1.5 py-1 text-[13px] font-semibold whitespace-nowrap text-[var(--tinta)] hover:bg-[var(--tinta-tint)]">{i.accion}</button>
        </li>
      ))}
    </ul>
  );
}
