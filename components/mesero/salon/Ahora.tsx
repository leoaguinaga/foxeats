'use client';

import { useState } from 'react';
import { ArrowRight, ChevronDown, LoaderCircle } from 'lucide-react';
import type { Mesa } from '@/lib/types';
import {
  MINUTOS_ALERTA, contarPlatos, duracion, estadoServicio, listaPlatos, minutosEnMesa, prioridad,
} from './servicio';

interface Props {
  /** Mesas abiertas por quien mira, de todas las zonas. */
  mias: Mesa[];
  ahora: number;
  actualizado: number | null;
  sinConexion: boolean;
  nombre: (m: Mesa) => string;
  onIr: (m: Mesa) => void;
  onEntregar: (m: Mesa) => Promise<void>;
}

interface Tarea {
  mesa: Mesa;
  nivel: 'listo' | 'alerta';
  titulo: string;
  detalle: string;
}

function tareas(mias: Mesa[], nombre: Props['nombre']): Tarea[] {
  const listos: Tarea[] = [];
  const demoras: Array<Tarea & { espera: number }> = [];
  for (const m of mias) {
    const e = estadoServicio(m);
    if (!e) continue;
    if (e.rondasListas.length) {
      listos.push({
        mesa: m,
        nivel: 'listo',
        titulo: `${nombre(m)} · ${e.platosListos} plato${e.platosListos !== 1 ? 's' : ''} listo${e.platosListos !== 1 ? 's' : ''}`,
        detalle: listaPlatos(e.rondasListas),
      });
    }
    const demorada = e.rondasEnCocina.filter((r) => r.minutos >= MINUTOS_ALERTA);
    if (demorada.length) {
      const n = contarPlatos(demorada);
      const preparando = demorada.some((r) => r.estado === 'en_preparacion');
      demoras.push({
        mesa: m,
        nivel: 'alerta',
        espera: e.espera,
        titulo: `${nombre(m)} espera hace ${e.espera} min`,
        detalle: `${n} plato${n !== 1 ? 's' : ''} · ${preparando ? 'en preparación' : 'sin empezar'}`,
      });
    }
  }
  return [...listos, ...demoras.sort((a, b) => b.espera - a.espera)];
}

/** Lo que pide acción ahora: platos listos primero, luego rondas que esperan 15 min o más. */
export function AhoraPanel({ mias, ahora, actualizado, sinConexion, nombre, onIr, onEntregar }: Props) {
  const lista = tareas(mias, nombre);
  const ordenadas = [...mias].sort((a, b) => prioridad(b, ahora) - prioridad(a, ahora));

  return (
    <section aria-label="Ahora" className="space-y-2">
      <Cabecera actualizado={actualizado} sinConexion={sinConexion} ahora={ahora} />

      {lista.length === 0 ? (
        <div className="rounded-[10px] border border-[var(--linea)] bg-white px-4 py-4">
          <p className="text-[13.5px] font-semibold text-[var(--ink)]">Todo en orden</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--pizarra)]">Los platos listos y las rondas que se demoran aparecerán aquí.</p>
        </div>
      ) : (
        lista.map((t) => <TareaFila key={`${t.nivel}-${t.mesa.id}`} t={t} onIr={onIr} onEntregar={onEntregar} />)
      )}

      {ordenadas.length > 0 && (
        <div className="pt-3">
          <ul className="overflow-hidden rounded-[10px] border border-[var(--linea)] bg-white">
            {ordenadas.map((m) => (
              <li key={m.id} className="border-t border-[#EEECE6] first:border-t-0">
                <MiMesa mesa={m} ahora={ahora} nombre={nombre} onIr={onIr} />
              </li>
            ))}
          </ul>
          <p className="mt-2 px-0.5 text-[12px] text-[var(--pizarra)]">
            {ordenadas.length === 1 ? 'Tu mesa abierta.' : `Tus ${ordenadas.length} mesas, de la que más espera a la que menos.`}
          </p>
        </div>
      )}
    </section>
  );
}

/** Versión para teléfono y tablet vertical: una línea con lo más urgente que se despliega. */
export function AhoraLinea({ mias, nombre, onIr, onEntregar }: Props) {
  const [abierta, setAbierta] = useState(false);
  const lista = tareas(mias, nombre);
  if (lista.length === 0) return null;
  const [primera, ...resto] = lista;

  return (
    <section aria-label="Ahora" className="rounded-[10px] border border-[var(--linea)] bg-white">
      <button
        type="button"
        onClick={() => setAbierta((x) => !x)}
        aria-expanded={abierta}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--tinta)]"
      >
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${primera.nivel === 'listo' ? 'bg-[var(--ok)]' : 'bg-[var(--alerta)]'}`} />
        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--ink)]">{primera.titulo}</span>
        {resto.length > 0 && !abierta && <span className="shrink-0 font-semibold text-[var(--tinta)]">+{resto.length} más</span>}
        <ChevronDown className={`size-4 shrink-0 text-[var(--pizarra)] transition-transform ${abierta ? 'rotate-180' : ''}`} strokeWidth={1.9} aria-hidden />
      </button>
      {abierta && (
        <div className="space-y-2 border-t border-[var(--linea)] p-2">
          {lista.map((t) => <TareaFila key={`${t.nivel}-${t.mesa.id}`} t={t} onIr={onIr} onEntregar={onEntregar} />)}
        </div>
      )}
    </section>
  );
}

function Cabecera({ actualizado, sinConexion, ahora }: { actualizado: number | null; sinConexion: boolean; ahora: number }) {
  return (
    <h2 className="flex items-center gap-2 px-0.5 pb-1 text-[13px] font-semibold text-[var(--ink)]">
      <span aria-hidden className={`size-[7px] rounded-full ${sinConexion ? 'bg-[var(--alerta)]' : 'bg-[var(--aji)] shadow-[0_0_0_3px_var(--aji-tint)]'}`} />
      Ahora
      <span className={`ml-auto text-[12px] font-medium ${sinConexion ? 'text-[var(--alerta)]' : 'text-[var(--pizarra)]'}`}>
        {sinConexion ? 'Sin conexión · reintentando' : actualizado ? `hace ${Math.max(0, Math.round((ahora - actualizado) / 1000))} s` : ''}
      </span>
    </h2>
  );
}

function TareaFila({ t, onIr, onEntregar }: { t: Tarea; onIr: Props['onIr']; onEntregar: Props['onEntregar'] }) {
  const [enviando, setEnviando] = useState(false);
  const listo = t.nivel === 'listo';

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-[10px] border border-[var(--linea)] bg-white px-3 py-3">
      <span
        className={`row-span-2 grid size-9 place-items-center rounded-[9px] text-[15px] font-bold tabular-nums ${
          listo ? 'bg-[var(--ok-tint)] text-[var(--ok)]' : 'bg-[var(--alerta-tint)] text-[var(--alerta)]'
        }`}
      >
        {t.mesa.numero}
      </span>
      <b className="text-[13.5px] leading-snug font-semibold text-[var(--ink)]">{t.titulo}</b>
      <span className="truncate text-[12.5px] leading-snug text-[var(--pizarra)]">{t.detalle}</span>
      <div className="col-start-2 mt-1.5 flex gap-4">
        {listo ? (
          <>
            <button
              type="button"
              disabled={enviando}
              onClick={async () => {
                setEnviando(true);
                try { await onEntregar(t.mesa); } finally { setEnviando(false); }
              }}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ok)] hover:underline disabled:opacity-60"
            >
              {enviando && <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2} aria-hidden />}
              {enviando ? 'Marcando…' : 'Marcar entregados'}
            </button>
            <IrA onClick={() => onIr(t.mesa)} />
          </>
        ) : (
          <IrA onClick={() => onIr(t.mesa)} />
        )}
      </div>
    </div>
  );
}

function IrA({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--tinta)] hover:underline">
      Ver la mesa
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
    </button>
  );
}

function MiMesa({ mesa, ahora, nombre, onIr }: { mesa: Mesa; ahora: number; nombre: Props['nombre']; onIr: Props['onIr'] }) {
  const e = estadoServicio(mesa);
  if (!e) return null;
  const punto = { listo: 'bg-[var(--ok)]', alerta: 'bg-[var(--alerta)]', aviso: 'bg-[var(--aviso)]' }[e.nivel as 'listo'];
  const texto =
    e.nivel === 'listo' ? `${e.platosListos} listo${e.platosListos !== 1 ? 's' : ''}`
    : e.nivel === 'servida' ? 'Servida'
    : e.nivel === 'sin_pedir' ? 'Sin pedir'
    : `En cocina ${e.espera} min`;
  const etiqueta = nombre(mesa);
  return (
    <button
      type="button"
      onClick={() => onIr(mesa)}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--piedra)]/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--tinta)]"
    >
      <span className="grid h-6 min-w-7 place-items-center rounded-md bg-[var(--tinta)] px-1 text-[12px] font-semibold text-white tabular-nums" title={etiqueta}>
        {etiqueta.startsWith('Barra') ? `B${etiqueta.slice(6)}` : mesa.numero}
      </span>
      {punto && <span aria-hidden className={`size-[7px] shrink-0 rounded-full ${punto}`} />}
      <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{texto}</span>
      <span className="shrink-0 text-[12px] text-[var(--pizarra)] tabular-nums">{duracion(minutosEnMesa(mesa, ahora))}</span>
    </button>
  );
}
