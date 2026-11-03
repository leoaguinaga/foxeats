'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Bike, ShoppingBag } from 'lucide-react';
import { api, type MonitorItem } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { hora } from '@/components/admin/caja/fechas';
import { EstadoRonda } from '@/components/mesero/EstadoRonda';
import { duracionCorta, iniciales } from '@/components/mesero/salon/servicio';

type Alcance = 'mias' | 'todas';

/**
 * Monitor del mesero, partido en sus dos preguntas: qué platos están listos para
 * llevar y qué rondas siguen en cocina. Por defecto solo sus mesas.
 */
export default function MonitorPage() {
  const { data: sesion } = useSession();
  const yo = sesion?.user?.id;
  const [rondas, setRondas] = useState<MonitorItem[] | null>(null);
  const [alcance, setAlcance] = useState<Alcance>('mias');
  const [marcando, setMarcando] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const fetchData = useCallback(async () => {
    try {
      setRondas(await api.monitor.get());
    } catch {
      // silencioso en el sondeo
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial + sondeo
    fetchData();
    const id = setInterval(fetchData, 10_000);
    const reloj = setInterval(() => setAhora(Date.now()), 30_000);
    return () => { clearInterval(id); clearInterval(reloj); };
  }, [fetchData]);

  async function entregada(pedidoId: string) {
    setMarcando(pedidoId);
    try {
      await api.pedidos.cambiarEstado(pedidoId, 'entregado');
      setRondas((rs) => rs?.filter((r) => r.pedidoId !== pedidoId) ?? null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo marcar la ronda');
    } finally {
      setMarcando(null);
    }
  }

  if (!rondas) {
    return <div className="flex h-64 items-center justify-center text-[14px] text-[var(--pizarra)]">Cargando monitor…</div>;
  }

  const visibles = alcance === 'mias' ? rondas.filter((r) => r.abiertaPor.id === yo) : rondas;
  const desde = (iso: string | null) => (iso ? Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000)) : 0);
  const paraServir = visibles
    .filter((r) => r.estado === 'listo')
    .sort((a, b) => new Date(a.fechaListo ?? a.fechaCreacion).getTime() - new Date(b.fechaListo ?? b.fechaCreacion).getTime());
  const enCocina = visibles
    .filter((r) => r.estado !== 'listo')
    .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 md:px-6 md:py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-[var(--ink)]">Monitor</h1>
          <p className="text-[13.5px] text-[var(--pizarra)] tabular-nums">
            {paraServir.length} para servir · {enCocina.length} en cocina
          </p>
        </div>
        <div role="radiogroup" aria-label="Qué rondas ver" className="inline-flex rounded-lg bg-[#ECEBE6] p-0.5 text-[13.5px]">
          {([['mias', 'Mis mesas'], ['todas', 'Todas']] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={alcance === k}
              onClick={() => setAlcance(k)}
              className={[
                'rounded-md px-3.5 py-1.5 font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--tinta)]',
                alcance === k ? 'bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(22,25,34,0.12)]' : 'text-[var(--pizarra)] hover:text-[var(--ink)]',
              ].join(' ')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {paraServir.length === 0 && enCocina.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--linea)] bg-white px-6 py-14 text-center">
          <p className="text-[15px] font-semibold text-[var(--ink)]">No hay nada en cocina.</p>
          <p className="mt-1 text-[14px] text-[var(--pizarra)]">
            {alcance === 'mias' && rondas.length > 0
              ? 'Tus mesas están al día. En «Todas» ves las de tus compañeros.'
              : 'Las rondas que envíes aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Columna titulo="Para servir" cantidad={paraServir.length} vacio="Nada listo por ahora.">
            {paraServir.map((r) => (
              <Tarjeta key={r.pedidoId} ronda={r} mia={r.abiertaPor.id === yo} conDueno={alcance === 'todas'}
                detalle={`Ronda ${r.numeroRonda} · lista hace ${duracionCorta(desde(r.fechaListo ?? r.fechaCreacion))}`}
                estado={<EstadoRonda estado="listo" minutos={0} />}
              >
                <div className="flex gap-2 border-t border-[var(--linea)] px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => entregada(r.pedidoId)}
                    disabled={marcando === r.pedidoId}
                    className="h-9 flex-1 rounded-lg bg-[var(--tinta)] px-3 text-[13.5px] font-semibold text-white hover:bg-[var(--tinta-hover)] disabled:opacity-50"
                  >
                    {marcando === r.pedidoId ? 'Guardando…' : 'Marcar entregada'}
                  </button>
                  <Link href={`/mesero/mesa/${r.visitaId}`} className="inline-flex h-9 items-center rounded-lg border border-[var(--linea)] px-3 text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--piedra)]">
                    {r.tipoVisita === 'mesa' ? 'Ver la mesa' : 'Ver pedido'}
                  </Link>
                </div>
              </Tarjeta>
            ))}
          </Columna>

          <Columna titulo="En cocina" cantidad={enCocina.length} nota="la que más espera primero" vacio="Cocina no tiene rondas pendientes.">
            {enCocina.map((r) => (
              <Link key={r.pedidoId} href={`/mesero/mesa/${r.visitaId}`} className="block rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tinta)]">
                <Tarjeta ronda={r} mia={r.abiertaPor.id === yo} conDueno={alcance === 'todas'}
                  detalle={`Ronda ${r.numeroRonda} · pedida ${hora(r.fechaCreacion)}`}
                  estado={<EstadoRonda estado={r.estado} minutos={desde(r.fechaCreacion)} />}
                  enlace
                />
              </Link>
            ))}
          </Columna>
        </div>
      )}
    </div>
  );
}

function Columna({ titulo, cantidad, nota, vacio, children }: {
  titulo: string;
  cantidad: number;
  nota?: string;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={titulo} className="space-y-2.5">
      <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-[var(--ink)]">
        {titulo}
        <span className="tabular-nums text-[var(--pizarra)]">{cantidad}</span>
        {nota && cantidad > 1 && <span className="text-[13px] font-normal text-[var(--pizarra)]">· {nota}</span>}
      </h2>
      {cantidad === 0
        ? <p className="rounded-[10px] border border-dashed border-[var(--linea)] px-4 py-6 text-center text-[13.5px] text-[var(--pizarra)]">{vacio}</p>
        : <div className="space-y-2.5">{children}</div>}
    </section>
  );
}

function Tarjeta({ ronda, mia, conDueno, detalle, estado, enlace, children }: {
  ronda: MonitorItem;
  mia: boolean;
  conDueno: boolean;
  detalle: string;
  estado: React.ReactNode;
  enlace?: boolean;
  children?: React.ReactNode;
}) {
  const titulo = ronda.tipoVisita === 'mesa'
    ? ronda.mesaEtiqueta ?? 'Mesa'
    : `${ronda.tipoVisita === 'delivery' ? 'Delivery' : 'Para llevar'}${ronda.nombreCliente ? ` · ${ronda.nombreCliente}` : ''}`;

  return (
    <article className={['rounded-[10px] border border-[var(--linea)] bg-white', enlace ? 'transition-colors hover:border-[#C9CBD6]' : ''].join(' ')}>
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <Insignia ronda={ronda} mia={mia} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--ink)]">
            <span className="truncate">{titulo}</span>
            {conDueno && !mia && (
              <span title={ronda.abiertaPor.nombre} className="grid size-[22px] shrink-0 place-items-center rounded-full border border-[#D5D9E6] bg-white text-[10px] font-bold text-[var(--tinta)]">
                {iniciales(ronda.abiertaPor.nombre)}
              </span>
            )}
          </p>
          <p className="text-[12.5px] text-[var(--pizarra)] tabular-nums">{detalle}</p>
        </div>
        {estado}
      </div>
      <ul className="space-y-1 px-4 pb-3">
        {ronda.items.map((i, n) => (
          <li key={n} className="flex gap-2.5 text-[14px] text-[var(--ink)]">
            <span className="w-5 shrink-0 text-right font-semibold tabular-nums">{i.cantidad}</span>
            <span className="min-w-0">
              {i.nombre}
              {i.elecciones && <span className="block text-[13px] text-[var(--pizarra)]">{i.elecciones.join(' + ')}</span>}
              {i.notas && <span className="ml-1.5 text-[13px] text-[var(--pizarra)]">{i.notas}</span>}
            </span>
          </li>
        ))}
      </ul>
      {children}
    </article>
  );
}

/** Número de mesa (o bolsa / moto) en tinta si es tuya, en tinta clara si es de otro. */
function Insignia({ ronda, mia }: { ronda: MonitorItem; mia: boolean }) {
  const color = mia ? 'bg-[var(--tinta)] text-white' : 'bg-[var(--tinta-tint)] text-[var(--tinta)] border border-[#D5D9E6]';
  const corta = ronda.mesaEtiqueta?.startsWith('Barra') ? `B${ronda.mesaEtiqueta.slice(6)}` : ronda.mesaNumero;
  return (
    <span aria-hidden className={`grid h-9 min-w-9 shrink-0 place-items-center rounded-lg px-1.5 text-[15px] font-semibold tabular-nums ${color}`}>
      {ronda.tipoVisita === 'delivery'
        ? <Bike className="size-[18px]" strokeWidth={1.9} />
        : ronda.tipoVisita === 'llevar'
          ? <ShoppingBag className="size-[18px]" strokeWidth={1.9} />
          : corta}
    </span>
  );
}
