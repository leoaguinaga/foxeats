import { Fragment } from 'react';
import type { CajaPeriodo, TurnoResumen } from '@/lib/api';
import { PildoraArqueo } from './Arqueo';
import { CANALES, diaLima, duracion, estadoArqueo, etiquetaDia, hora, soles } from './fechas';

const th = 'bg-[#FBFAF7] px-3.5 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-[var(--pizarra)] first:text-left';
const td = 'px-3.5 py-3 text-right whitespace-nowrap align-middle first:text-left';

function Quien({ t, ahora, conDia }: { t: TurnoResumen; ahora: string; conDia: boolean }) {
  return (
    <>
      <b className="block font-semibold">{t.cajeroNombre}</b>
      <small className="text-[12.5px] text-[var(--pizarra)]">
        {hora(t.fechaApertura)} – {t.fechaCierre ? hora(t.fechaCierre) : 'ahora'} · {duracion(t.fechaApertura, t.fechaCierre, ahora)}
        {conDia && diaLima(t.fechaApertura) !== diaLima(t.fechaCierre ?? ahora) && ' · cruza medianoche'}
      </small>
    </>
  );
}

function resumenDia(ts: TurnoResumen[]) {
  const conDif = ts.filter((t) => t.estado === 'cerrado' && estadoArqueo(t).tipo !== 'ok');
  const sobra = conDif.filter((t) => estadoArqueo(t).tipo === 'sobra').length;
  const abiertos = ts.filter((t) => t.estado === 'abierto').length;
  const partes = [`${ts.length} ${ts.length === 1 ? 'turno' : 'turnos'}`];
  if (abiertos) partes.push(`${abiertos} en curso`);
  if (conDif.length - sobra) partes.push(`${conDif.length - sobra} con faltante`);
  if (sobra) partes.push(`${sobra} con sobrante`);
  if (!conDif.length && !abiertos) partes.push('cuadran');
  return partes.join(' · ');
}

export function TablaTurnos({ datos, seleccionado, onSelect }: { datos: CajaPeriodo; seleccionado: string | null; onSelect: (id: string) => void }) {
  const multiDia = datos.desde !== datos.hasta;
  const orden = [...datos.turnos]; // el backend ya los entrega del más reciente al más antiguo
  const grupos: Array<{ dia: string; turnos: TurnoResumen[] }> = [];
  if (multiDia) {
    for (const t of orden) {
      const dia = diaLima(t.fechaApertura);
      const g = grupos.find((x) => x.dia === dia);
      if (g) g.turnos.push(t);
      else grupos.push({ dia, turnos: [t] });
    }
  }

  if (!orden.length) {
    return (
      <div className="rounded-[10px] border border-[var(--linea)] bg-white px-4 py-14 text-center text-[var(--pizarra)]">
        <p className="font-medium text-[var(--ink)]">Sin turnos en este período</p>
        <p className="mt-1 text-sm">Cuando un cajero abra la caja, su turno aparecerá aquí.</p>
      </div>
    );
  }

  const fila = (t: TurnoResumen) => {
    const sel = seleccionado === t.id;
    const abrir = () => onSelect(t.id);
    return (
      <Fragment key={t.id}>
        <tr
          tabIndex={0}
          onClick={abrir}
          onKeyDown={(e) => { if (e.key === 'Enter') abrir(); }}
          aria-selected={sel}
          className={['cursor-pointer outline-none focus-visible:bg-[var(--tinta-tint)]', sel ? 'bg-[var(--tinta-tint)]' : 'hover:bg-[#FBFAF7]'].join(' ')}
        >
          <td className={`${td} ${sel ? 'shadow-[inset_3px_0_0_var(--tinta)]' : ''}`}><Quien t={t} ahora={datos.ahora} conDia={multiDia} /></td>
          <td className={td}>{t.cobros}</td>
          <td className={`${td} font-semibold`}>{soles(t.totalTurno)}</td>
          <td className={td}>{soles(t.totalGastos)}</td>
          <td className={td}>{soles(t.montoCierreTeorico)}</td>
          <td className={`${td} ${t.montoCierreReal == null ? 'text-[var(--pizarra)]' : ''}`}>{t.montoCierreReal == null ? '—' : soles(t.montoCierreReal)}</td>
          <td className={td}><PildoraArqueo turno={t} /></td>
        </tr>
        <tr onClick={abrir} className={['cursor-pointer border-b border-[var(--linea)] last:border-0', sel ? 'bg-[var(--tinta-tint)]' : 'hover:bg-[#FBFAF7]'].join(' ')}>
          <td colSpan={7} className="px-3.5 pb-3 text-left text-[12.5px] text-[var(--pizarra)]">
            {CANALES.map((c) => {
              const m = parseFloat(t.porCanal[c.key]);
              return <span key={c.key} className="mr-5">{c.corto} <b className={['ml-1 font-medium', m > 0 ? 'text-[var(--ink)]' : ''].join(' ')}>{m > 0 ? soles(m) : '—'}</b></span>;
            })}
          </td>
        </tr>
      </Fragment>
    );
  };

  return (
    <section className="overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--linea)] px-4 py-3">
        <h3 className="text-sm font-semibold">Turnos y arqueo</h3>
        <span className="text-[12.5px] text-[var(--pizarra)]">Clic en un turno para ver sus movimientos</span>
      </header>

      {/* Tablet y escritorio: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-[var(--linea)]">
              <th className={th}>Turno</th><th className={th}>Cobros</th><th className={th}>Ingresos</th><th className={th}>Gastos</th><th className={th}>Efectivo esperado</th><th className={th}>Contado</th><th className={th}>Arqueo</th>
            </tr>
          </thead>
          <tbody>
            {multiDia
              ? grupos.map((g) => {
                  const ingresos = g.turnos.reduce((s, t) => s + parseFloat(t.totalTurno), 0);
                  const gastos = g.turnos.reduce((s, t) => s + parseFloat(t.totalGastos), 0);
                  const cobros = g.turnos.reduce((s, t) => s + t.cobros, 0);
                  return (
                    <Fragment key={g.dia}>
                      <tr className="bg-[#FBFAF7] text-[12.5px] font-semibold text-[var(--pizarra)]">
                        <td className="px-3.5 py-2 text-left"><b className="text-[var(--ink)]">{etiquetaDia(g.dia)}</b></td>
                        <td className="px-3.5 py-2 text-right">{cobros}</td>
                        <td className="px-3.5 py-2 text-right"><b className="text-[var(--ink)]">{soles(ingresos)}</b></td>
                        <td className="px-3.5 py-2 text-right">{soles(gastos)}</td>
                        <td colSpan={3} className="px-3.5 py-2 text-right">{resumenDia(g.turnos)}</td>
                      </tr>
                      {g.turnos.map(fila)}
                    </Fragment>
                  );
                })
              : orden.map(fila)}
          </tbody>
        </table>
      </div>

      {/* Teléfono: una tarjeta por turno */}
      <div className="flex flex-col gap-2.5 p-3 md:hidden">
        {orden.map((t) => (
          <button key={t.id} type="button" onClick={() => onSelect(t.id)} className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--linea)] bg-white p-3 text-left active:bg-[var(--tinta-tint)]">
            <span className="flex items-center justify-between font-semibold">{t.cajeroNombre}<PildoraArqueo turno={t} /></span>
            <span className="flex justify-between text-[12.5px] text-[var(--pizarra)]">
              <span>{multiDia && `${etiquetaDia(diaLima(t.fechaApertura))} · `}{hora(t.fechaApertura)} – {t.fechaCierre ? hora(t.fechaCierre) : 'ahora'} · {t.cobros} {t.cobros === 1 ? 'cobro' : 'cobros'}</span>
              <b className="text-[var(--ink)]">S/ {soles(t.totalTurno)}</b>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
