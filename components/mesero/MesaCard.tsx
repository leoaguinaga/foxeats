'use client';

import { Check, Clock, User } from 'lucide-react';
import { Mesa } from '@/lib/types';
import { duracion, duracionCorta, estadoServicio, iniciales, minutosEnMesa, primerNombre, type EstadoServicio } from './salon/servicio';

interface Props {
  mesa: Mesa;
  onClick: () => void;
  /** Para puestos de barra: «B1» y su número debajo. */
  etiqueta?: string;
  /** La abrió quien está mirando: va en tinta y con avisos de color. */
  mia: boolean;
  ahora: number;
  /** Celdas chicas (teléfono): solo número y minutos. */
  compacto?: boolean;
  ocupado?: boolean;
}

/**
 * Mesa del salón del mesero. Libre en blanco y en calma; ocupada en tinta si
 * es tuya y en tinta clara con iniciales si es de otro mesero. Solo las tuyas
 * llevan color de estado (listos, aviso, alerta).
 */
export function MesaCard({ mesa, onClick, etiqueta, mia, ahora, compacto = false, ocupado = false }: Props) {
  const e = estadoServicio(mesa);
  const libre = mesa.estado === 'libre' || !e;
  const barra = mesa.tipo === 'barra';
  const enMesa = minutosEnMesa(mesa, ahora);
  const quien = mesa.visita?.abiertaPor.nombre ?? '';

  const tono = libre
    ? 'bg-white border border-[#C9CBD6] text-[var(--ink)] hover:border-[var(--tinta)]'
    : mia
      ? 'bg-[var(--tinta)] text-white shadow-[0_6px_14px_-8px_rgba(31,42,77,.6)] hover:bg-[var(--tinta-hover)]'
      : 'bg-[var(--tinta-tint)] border border-[#D5D9E6] text-[var(--tinta)] hover:border-[var(--tinta)]';

  const forma = barra ? 'rounded-full items-center justify-center text-center' : compacto ? 'rounded-[9px] p-1.5' : 'rounded-xl p-2.5';

  return (
    <div className={barra ? 'grid size-full place-items-center' : 'size-full'}>
      <button
        type="button"
        onClick={onClick}
        disabled={ocupado}
        aria-label={descripcion(mesa, etiqueta, libre, mia, quien, enMesa, e)}
        className={[
          'relative flex flex-col justify-between select-none transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aji)] disabled:opacity-50',
          barra ? 'aspect-square w-[74%]' : 'size-full',
          forma,
          tono,
        ].join(' ')}
      >
        {barra ? (
          <>
            <span className={`${compacto ? 'text-[15px]' : 'text-[20px]'} font-semibold leading-none tracking-[-0.02em]`}>{etiqueta}</span>
            {!compacto && (
              <span className={`mt-1 text-[10.5px] tabular-nums ${libre ? 'text-[var(--pizarra)]' : mia ? 'text-white/65' : 'text-[#4E5677]'}`}>
                Nº {mesa.numero}
              </span>
            )}
            {!libre && e && <MarcaBarra e={e} mia={mia} />}
          </>
        ) : (
          <>
            <span className="flex items-start justify-between gap-1">
              <span className={`${compacto ? 'text-[20px]' : 'text-[30px]'} font-semibold leading-none tracking-[-0.02em] tabular-nums`}>
                {etiqueta ?? mesa.numero}
              </span>
              {!libre && !mia && (
                compacto
                  ? <span className="text-[9.5px] font-bold">{iniciales(quien)}</span>
                  : <span className="grid size-[22px] place-items-center rounded-full border border-[#D5D9E6] bg-white text-[10px] font-bold">{iniciales(quien)}</span>
              )}
              {!libre && mia && !compacto && (
                <span className="text-[12px] font-medium whitespace-nowrap text-white/70 tabular-nums">{duracionCorta(enMesa)}</span>
              )}
            </span>

            {libre ? (
              mesa.capacidad ? (
                <span className={`inline-flex items-center gap-0.5 text-[var(--pizarra)] ${compacto ? 'text-[10.5px]' : 'text-[12px]'}`}>
                  <User className={compacto ? 'size-2.5' : 'size-3'} strokeWidth={1.9} aria-hidden />
                  {mesa.capacidad}
                </span>
              ) : <span />
            ) : (
              e && <Estado e={e} mia={mia} compacto={compacto} />
            )}
          </>
        )}
      </button>
    </div>
  );
}

function Estado({ e, mia, compacto }: { e: EstadoServicio; mia: boolean; compacto: boolean }) {
  const texto = textoEstado(e, compacto);

  // De otro mesero: el mismo dato, sin color.
  if (!mia) return <span className={`truncate text-left font-medium text-[#4E5677] ${compacto ? 'text-[10px]' : 'text-[12px]'}`}>{texto}</span>;

  const base = `inline-flex max-w-full items-center gap-1 self-start rounded-full font-semibold whitespace-nowrap ${
    compacto ? 'px-1.5 text-[10px] leading-[15px]' : 'py-0.5 pr-2 pl-1.5 text-[11.5px] leading-[17px]'
  }`;
  const icono = compacto ? 'hidden' : 'size-3 shrink-0';

  switch (e.nivel) {
    case 'listo':
      return <span className={`${base} bg-[var(--ok-tint)] text-[var(--ok)]`}><Check className="size-3 shrink-0" strokeWidth={2.4} aria-hidden />{texto}</span>;
    case 'alerta':
      return <span className={`${base} bg-[var(--alerta)] text-white`}><Clock className={icono} strokeWidth={2.4} aria-hidden />{texto}</span>;
    case 'aviso':
      return <span className={`${base} bg-[var(--aviso-tint)] text-[var(--aviso)]`}><Clock className={icono} strokeWidth={2.4} aria-hidden />{texto}</span>;
    default:
      return <span className={`${base} bg-white/12 font-medium text-white/85`}>{texto}</span>;
  }
}

/** En puestos de barra no hay espacio: un punto de color, o el texto corto. */
function MarcaBarra({ e, mia }: { e: EstadoServicio; mia: boolean }) {
  if (!mia || e.nivel === 'servida' || e.nivel === 'sin_pedir' || e.nivel === 'cocina') return null;
  const color = e.nivel === 'listo' ? 'bg-[var(--ok)]' : e.nivel === 'alerta' ? 'bg-[var(--alerta)]' : 'bg-[var(--aviso)]';
  return <span aria-hidden className={`absolute top-[6%] right-[6%] size-3 rounded-full ring-2 ring-white ${color}`} />;
}

function textoEstado(e: EstadoServicio, compacto: boolean): string {
  switch (e.nivel) {
    case 'listo':
      return compacto ? String(e.platosListos) : `${e.platosListos} listo${e.platosListos !== 1 ? 's' : ''}`;
    case 'alerta':
    case 'aviso':
    case 'cocina':
      return compacto ? `${e.espera}′` : `Cocina ${e.espera}′`;
    case 'servida':
      return 'Servida';
    case 'sin_pedir':
      return 'Sin pedir';
  }
}

function descripcion(
  mesa: Mesa, etiqueta: string | undefined, libre: boolean, mia: boolean, quien: string, enMesa: number, e: EstadoServicio | null,
) {
  const nombre = mesa.tipo === 'barra' ? `Barra ${etiqueta?.slice(1) ?? ''}, número ${mesa.numero}` : `Mesa ${mesa.numero}`;
  if (libre) return `${nombre}, libre${mesa.capacidad ? `, para ${mesa.capacidad}` : ''}`;
  const dueño = mia ? 'tuya' : `de ${primerNombre(quien)}`;
  const estado = !e ? '' : e.nivel === 'listo' ? `, ${e.platosListos} platos listos`
    : e.rondasEnCocina.length ? `, ronda en cocina hace ${e.espera} min`
    : e.nivel === 'servida' ? ', servida' : ', sin pedir';
  return `${nombre}, ${dueño}, abierta hace ${duracion(enMesa)}${estado}`;
}
