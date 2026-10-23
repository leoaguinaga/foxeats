'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, CajaPeriodo } from '@/lib/api';
import { Atencion, FranjaCifras } from '@/components/admin/caja/Cifras';
import { Grafico } from '@/components/admin/caja/Grafico';
import { DeDondeVino } from '@/components/admin/caja/DeDondeVino';
import { TablaTurnos } from '@/components/admin/caja/TablaTurnos';
import { DetalleTurno } from '@/components/admin/caja/DetalleTurno';
import { etiquetaRango, hoyLima, periodoEnCurso, rangoDe, TipoPeriodo } from '@/components/admin/caja/fechas';

const PERIODOS: Array<{ k: TipoPeriodo; label: string }> = [
  { k: 'hoy', label: 'Hoy' },
  { k: 'ayer', label: 'Ayer' },
  { k: '7d', label: '7 días' },
  { k: 'mes', label: 'Este mes' },
  { k: 'rango', label: 'Rango…' },
];

const REFRESCO_MS = 15_000;

export default function AdminTurnosPage() {
  const [tipo, setTipo] = useState<TipoPeriodo>('hoy');
  const [rango, setRango] = useState(() => rangoDe('hoy'));
  const [cajero, setCajero] = useState('');
  const [datos, setDatos] = useState<CajaPeriodo | null>(null);
  const [error, setError] = useState(false);
  const [actualizado, setActualizado] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const [turnoId, setTurnoId] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
 

  const { desde, hasta } = rango;
  const enCurso = periodoEnCurso(desde, hasta);

  const cargar = useCallback(async () => {
    try {
      const d = await api.admin.caja({ desde, hasta, cajero: cajero || undefined });
      setDatos(d);
      setError(false);
      setActualizado(Date.now());
      setSegundos(0);
    } catch {
      setError(true);
    }
  }, [desde, hasta, cajero]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al cambiar el período + sondeo en vivo
    cargar();
    if (!enCurso) return;
    const id = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(id);
  }, [cargar, enCurso]);

  useEffect(() => {
    const id = setInterval(() => setSegundos(actualizado ? Math.round((Date.now() - actualizado) / 1000) : 0), 1000);
    return () => clearInterval(id);
  }, [actualizado]);

  const elegir = (k: TipoPeriodo) => {
    setTipo(k);
    if (k !== 'rango') setRango(rangoDe(k));
    setTurnoId(null);
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const blob = await api.admin.exportarCaja({ desde, hasta, cajero: cajero || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caja_${desde}_${hasta}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo exportar el período');
    } finally {
      setExportando(false);
    }
  };

  const verAjustes = () => {
    const a = datos?.resumen.ajustes[0];
    if (a) setTurnoId(a.turnoId);
  };

  const hoy = hoyLima();
  const subtitulo = desde === hasta && desde === hoy ? 'Ingresos, gastos y arqueo de cada turno' : etiquetaRango(desde, hasta);
  const tituloPeriodo = tipo === 'hoy' ? 'Hoy' : desde === hasta ? etiquetaRango(desde, hasta) : 'En el período';

  return (
    <div className="mx-auto w-full max-w-[1240px] p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Caja</h1>
          <p className="mt-0.5 text-[13px] text-[var(--pizarra)] first-letter:uppercase">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enCurso && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--pizarra)]">
              <i className="size-[7px] rounded-full bg-[var(--aji)] shadow-[0_0_0_3px_var(--aji-tint)]" />
              En vivo · hace {segundos} s
            </span>
          )}
          <div className="flex max-w-full overflow-x-auto rounded-lg bg-[var(--muted)] p-[3px]" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => (
              <button key={p.k} type="button" role="tab" aria-selected={tipo === p.k} onClick={() => elegir(p.k)}
                className={['rounded-md px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap', tipo === p.k ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--pizarra)] hover:text-[var(--ink)]'].join(' ')}>
                {p.label}
              </button>
            ))}
          </div>
          {datos && datos.cajeros.length > 1 && (
            <select value={cajero} onChange={(e) => { setCajero(e.target.value); setTurnoId(null); }} aria-label="Cajero"
              className="h-9 rounded-lg border border-[var(--linea)] bg-white px-2.5 text-[13px] font-medium">
              <option value="">Cajero: todos</option>
              {datos.cajeros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
          <button type="button" onClick={exportar} disabled={exportando}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--linea)] bg-white px-3 text-[13px] font-semibold hover:bg-[var(--muted)] disabled:opacity-50">
            <Download className="size-3.5" aria-hidden />{exportando ? 'Exportando…' : 'Exportar'}
          </button>
        </div>
      </div>

      {tipo === 'rango' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <label className="flex items-center gap-2">Desde
            <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && setRango({ desde: e.target.value, hasta })} className="h-9 rounded-lg border border-[var(--linea)] bg-white px-2.5" />
          </label>
          <label className="flex items-center gap-2">Hasta
            <input type="date" value={hasta} min={desde} max={hoy} onChange={(e) => e.target.value && setRango({ desde, hasta: e.target.value })} className="h-9 rounded-lg border border-[var(--linea)] bg-white px-2.5" />
          </label>
        </div>
      )}

      {!datos ? (
        <p className="py-24 text-center text-[var(--pizarra)]">{error ? 'No se pudo cargar la caja. Reintentando…' : 'Cargando caja…'}</p>
      ) : (
        <>
          {error && <p className="mt-3 rounded-lg bg-[var(--aviso-tint)] px-3 py-2 text-[13px] text-[var(--aviso)]">No se pudo actualizar; se muestra la última lectura.</p>}
          <div className="mt-5"><FranjaCifras datos={datos} enCurso={enCurso} /></div>
          <Atencion datos={datos} onTurno={setTurnoId} onAjustes={verAjustes} />
          <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_330px]">
            <Grafico datos={datos} />
            <DeDondeVino datos={datos} titulo={tituloPeriodo} />
          </div>
          <div className="mt-3.5">
            <TablaTurnos datos={datos} seleccionado={turnoId} onSelect={setTurnoId} />
          </div>
        </>
      )}

      <DetalleTurno
        turnoId={turnoId}
        turnos={datos?.turnos ?? []}
        ahora={datos?.ahora ?? new Date().toISOString()}
        onCambiar={setTurnoId}
        onCerrar={() => setTurnoId(null)}
      />
    </div>
  );
}
