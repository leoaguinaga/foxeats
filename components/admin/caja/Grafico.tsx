import type { CajaPeriodo } from '@/lib/api';
import { diaLima, hoyLima, horaDecimal, hora, soles, solesEnteros } from './fechas';

const abreviatura = (f: string) =>
  new Date(`${f}T12:00:00-05:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).replace('.', '');

/** Ingresos por hora (un día) o por día (período largo), con los turnos en el mismo eje. */
export function Grafico({ datos }: { datos: CajaPeriodo }) {
  const { serie, serieTipo } = datos.resumen;
  const valores = serie.map((s) => parseFloat(s.monto));
  const max = Math.max(...valores, 1);
  const tope = Math.ceil(max / 100) * 100 || 100;
  const hoy = hoyLima();
  const horaActual = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  const esAhora = (clave: string) => (serieTipo === 'hora' ? datos.desde === hoy && Number(clave) === horaActual : clave === hoy);
  const mostrarTodos = serie.length <= 14;
  const hayCobros = valores.some((v) => v > 0);

  const primera = serieTipo === 'hora' ? Number(serie[0]?.clave ?? 0) : 0;
  const lane = serieTipo === 'hora' && serie.length
    ? datos.turnos.map((t) => {
        const ini = horaDecimal(t.fechaApertura, datos.desde);
        const fin = horaDecimal(t.fechaCierre ?? datos.ahora, datos.desde);
        const izq = Math.max(0, ((ini - primera) / serie.length) * 100);
        const ancho = Math.min(100 - izq, ((fin - Math.max(ini, primera)) / serie.length) * 100);
        return { t, izq, ancho };
      }).filter((x) => x.ancho > 0 && diaLima(x.t.fechaApertura) <= datos.desde)
    : [];

  return (
    <section className="rounded-[10px] border border-[var(--linea)] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--linea)] px-4 py-3">
        <h3 className="text-sm font-semibold">{serieTipo === 'hora' ? 'Ingresos por hora' : 'Ingresos por día'}</h3>
        <span className="text-[12.5px] text-[var(--pizarra)]">{serieTipo === 'hora' ? 'Turnos debajo, en el mismo eje' : 'Suma de los cobros de cada día'}</span>
      </header>
      <div className="px-4 py-4">
        {!hayCobros ? (
          <p className="py-10 text-center text-sm text-[var(--pizarra)]">Sin cobros en este período.</p>
        ) : (
          <>
            <div className="relative pl-11">
              <div className="absolute top-1 left-0 flex h-[150px] w-9 flex-col justify-between text-right text-[11px] text-[var(--pizarra)]">
                <span>S/ {solesEnteros(tope)}</span><span>{solesEnteros(tope / 2)}</span><span>0</span>
              </div>
              <div
                className="grid h-[150px] items-end gap-1.5 border-b border-[var(--linea)]"
                style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))`, backgroundImage: 'linear-gradient(var(--muted) 1px, transparent 1px)', backgroundSize: '100% 75px' }}
              >
                {serie.map((s, i) => {
                  const v = valores[i];
                  const etiquetar = v > 0 && (mostrarTodos ? true : v >= max * 0.85) ;
                  return (
                    <div
                      key={s.clave}
                      title={`${serieTipo === 'hora' ? `${s.clave}:00` : abreviatura(s.clave)} · S/ ${soles(v)}`}
                      className={['relative min-h-0.5 rounded-t-[3px]', esAhora(s.clave) ? 'bg-[var(--aji)]' : 'bg-[var(--tinta)]', v === 0 ? 'bg-transparent' : ''].join(' ')}
                      style={{ height: `${(v / tope) * 100}%` }}
                    >
                      {etiquetar && <em className="absolute bottom-full left-1/2 -translate-x-1/2 pb-0.5 text-[10.5px] whitespace-nowrap text-[var(--pizarra)] not-italic">{solesEnteros(v)}</em>}
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-1.5 pt-1 text-center text-[11px] text-[var(--pizarra)]" style={{ gridTemplateColumns: `repeat(${serie.length}, minmax(0, 1fr))` }}>
                {serie.map((s, i) => (
                  <span key={s.clave} className="overflow-hidden whitespace-nowrap">
                    {serieTipo === 'hora' ? s.clave : serie.length <= 10 || i % Math.ceil(serie.length / 8) === 0 ? abreviatura(s.clave) : ''}
                  </span>
                ))}
              </div>
            </div>
            {serieTipo === 'hora' && lane.length > 0 && (
              <div className="relative mt-3.5 h-[34px] pl-11">
                <span className="absolute top-2 left-0 text-[11px] text-[var(--pizarra)]">Turnos</span>
                <div className="relative h-full">
                  {lane.map(({ t, izq, ancho }) => (
                    <div
                      key={t.id}
                      style={{ left: `${izq}%`, width: `${Math.max(ancho - 0.8, 1)}%` }}
                      className={[
                        'absolute top-[3px] flex h-7 items-center gap-2 overflow-hidden rounded-[7px] px-2.5 text-[12.5px] font-medium whitespace-nowrap',
                        t.estado === 'abierto'
                          ? 'bg-[var(--tinta)] text-white'
                          : 'border border-[#CDD2E2] bg-[var(--tinta-tint)] text-[var(--tinta)]',
                      ].join(' ')}
                    >
                      {t.cajeroNombre}
                      <small className="font-normal opacity-75">{hora(t.fechaApertura)} – {t.fechaCierre ? hora(t.fechaCierre) : 'ahora'}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
