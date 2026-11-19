'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { etiquetaMesa } from '@/lib/mesas';
import type { Mesa, Zona } from '@/lib/types';
import { HojaInferior } from '@/components/mesero/salon/HojaInferior';

/**
 * Hoja inferior para mover una visita activa (con todas sus rondas y consumo)
 * a otra mesa libre del salón.
 */
export function CambiarMesa({
  open,
  mesaActualId,
  mesaActualEtiqueta,
  guardando,
  error,
  onConfirmar,
  onCerrar,
}: {
  open: boolean;
  mesaActualId: string | null;
  mesaActualEtiqueta: string;
  guardando: boolean;
  error: string | null;
  onConfirmar: (mesaId: string, etiquetaDestino: string) => void;
  onCerrar: () => void;
}) {
  return (
    <HojaInferior open={open} onClose={onCerrar} bloqueada={guardando} titulo="Cambiar de mesa">
      {/* Se monta de nuevo en cada apertura para recargar mesas libres y limpiar selección. */}
      {open && (
        <Contenido
          mesaActualId={mesaActualId}
          mesaActualEtiqueta={mesaActualEtiqueta}
          guardando={guardando}
          errorEnvio={error}
          onConfirmar={onConfirmar}
          onCerrar={onCerrar}
        />
      )}
    </HojaInferior>
  );
}

function Contenido({
  mesaActualId,
  mesaActualEtiqueta,
  guardando,
  errorEnvio,
  onConfirmar,
  onCerrar,
}: {
  mesaActualId: string | null;
  mesaActualEtiqueta: string;
  guardando: boolean;
  errorEnvio: string | null;
  onConfirmar: (mesaId: string, etiquetaDestino: string) => void;
  onCerrar: () => void;
}) {
  const [todas, setTodas] = useState<Mesa[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [zonaActiva, setZonaActiva] = useState<string | null>(null);
  const [elegidaId, setElegidaId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([api.mesas.list(), api.zonas.list()])
      .then(([m, z]) => {
        if (cancelado) return;
        const salon = m.filter((x) => x.numero !== 0);
        setTodas(salon);
        setZonas(z);

        if (z.length > 1) {
          const zonaDe = (mesa: Mesa) =>
            mesa.zonaId && z.some((item) => item.id === mesa.zonaId) ? mesa.zonaId : z[0]?.id ?? null;
          const actual = salon.find((x) => x.id === mesaActualId);
          const zonaActual = actual ? zonaDe(actual) : null;
          const libres = salon.filter((x) => x.estado === 'libre' && x.id !== mesaActualId);
          const conLibresEnActual = zonaActual && libres.some((x) => zonaDe(x) === zonaActual);
          const primeraConLibres = z.find((item) => libres.some((x) => zonaDe(x) === item.id))?.id ?? z[0]?.id ?? null;
          setZonaActiva(conLibresEnActual ? zonaActual : primeraConLibres);
        }
      })
      .catch((err) => {
        if (cancelado) return;
        setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar las mesas libres');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [mesaActualId]);

  const libres = useMemo(
    () => todas.filter((m) => m.estado === 'libre' && m.id !== mesaActualId).sort((a, b) => a.numero - b.numero),
    [todas, mesaActualId],
  );

  const zonaDe = (m: Mesa) =>
    m.zonaId && zonas.some((z) => z.id === m.zonaId) ? m.zonaId : zonas[0]?.id ?? null;

  const zona = zonas.find((z) => z.id === zonaActiva) ?? zonas[0] ?? null;
  const visibles = zonas.length > 1 && zona ? libres.filter((m) => zonaDe(m) === zona.id) : libres;

  const mesaElegida = libres.find((m) => m.id === elegidaId) ?? null;
  const etiquetaDestino = mesaElegida ? etiquetaMesa(mesaElegida, todas) : null;
  const error = errorEnvio ?? errorCarga;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Cambiar de mesa</h2>
        <p className="mt-1 text-[13.5px] text-[var(--pizarra)]">
          La cuenta y las rondas de <span className="font-medium text-[var(--ink)]">{mesaActualEtiqueta}</span> pasarán a la mesa que elijas.
        </p>
      </div>

      {cargando ? (
        <div className="py-10 text-center text-[13.5px] text-[var(--pizarra)]">Buscando mesas libres…</div>
      ) : libres.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--linea)] bg-[#FBFAF7] px-4 py-6 text-center">
          <p className="text-[14px] font-semibold text-[var(--ink)]">No hay mesas libres</p>
          <p className="mt-1 text-[13px] text-[var(--pizarra)]">Todas las mesas del salón están ocupadas en este momento.</p>
        </div>
      ) : (
        <>
          {zonas.length > 1 && (
            <div role="tablist" aria-label="Zonas" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
              {zonas.map((z) => {
                const on = z.id === zona?.id;
                const cantidad = libres.filter((m) => zonaDe(m) === z.id).length;
                return (
                  <button
                    key={z.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setZonaActiva(z.id)}
                    className={[
                      'shrink-0 rounded-full border px-3 py-1 text-[13px] font-semibold whitespace-nowrap transition-colors',
                      on
                        ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white'
                        : 'border-[var(--linea)] bg-white text-[var(--ink)] hover:bg-[var(--piedra)]',
                    ].join(' ')}
                  >
                    {z.nombre}
                    <span className={on ? 'ml-1.5 font-medium text-white/75' : 'ml-1.5 font-medium text-[var(--pizarra)]'}>
                      {cantidad}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {visibles.length === 0 ? (
            <p className="rounded-[10px] border border-[var(--linea)] bg-[#FBFAF7] px-4 py-6 text-center text-[13.5px] text-[var(--pizarra)]">
              No hay mesas libres en {zona?.nombre}.
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-label="Mesas libres"
              className="grid max-h-[42dvh] grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4"
            >
              {visibles.map((m) => {
                const activa = m.id === elegidaId;
                const nombre = etiquetaMesa(m, todas);
                const detalle = m.tipo === 'barra'
                  ? `Nº ${m.numero}`
                  : m.capacidad
                    ? `${m.capacidad} pers.`
                    : 'Libre';
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    disabled={guardando}
                    onClick={() => setElegidaId(m.id)}
                    className={[
                      'flex flex-col items-center justify-center rounded-[10px] border px-2 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)] disabled:opacity-50',
                      activa
                        ? 'border-[var(--tinta)] bg-[var(--tinta)] text-white'
                        : 'border-[#C9CBD6] bg-white text-[var(--ink)] hover:border-[var(--tinta)]/60 hover:bg-[var(--piedra)]/60',
                    ].join(' ')}
                  >
                    <span className="text-[14px] leading-tight font-semibold tabular-nums">{nombre}</span>
                    <span className={['mt-0.5 text-[11.5px] tabular-nums', activa ? 'text-white/75' : 'text-[var(--pizarra)]'].join(' ')}>
                      {detalle}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-[var(--alerta)]/10 px-3 py-2 text-[13px] font-medium text-[var(--alerta)]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={onCerrar}
          disabled={guardando}
          className="h-11 rounded-lg border border-[var(--linea)] bg-white text-[14px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)] disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!mesaElegida || !etiquetaDestino || guardando}
          onClick={() => {
            if (mesaElegida && etiquetaDestino) onConfirmar(mesaElegida.id, etiquetaDestino);
          }}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-[var(--tinta)] px-3 text-[14px] font-semibold text-white hover:bg-[var(--tinta-hover)] disabled:opacity-45"
        >
          {guardando ? (
            'Moviendo…'
          ) : etiquetaDestino ? (
            <>
              <span>Mover a {etiquetaDestino}</span>
              <ArrowRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            </>
          ) : (
            'Elegir mesa'
          )}
        </button>
      </div>
    </div>
  );
}
