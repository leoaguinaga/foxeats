import type { Mesa, RondaActiva } from '@/lib/types';

/** Mismos umbrales que Inicio de administración. */
export const MINUTOS_AVISO = 10;
export const MINUTOS_ALERTA = 15;

export type NivelServicio = 'listo' | 'alerta' | 'aviso' | 'cocina' | 'servida' | 'sin_pedir';

export interface EstadoServicio {
  nivel: NivelServicio;
  /** Platos listos para llevar a la mesa (nivel «listo»). */
  platosListos: number;
  /** Minutos de la ronda en cocina que más espera. */
  espera: number;
  rondasListas: RondaActiva[];
  rondasEnCocina: RondaActiva[];
}

/** Lo más urgente de una mesa ocupada: platos listos, luego la ronda que más espera. */
export function estadoServicio(mesa: Mesa): EstadoServicio | null {
  const v = mesa.visita;
  if (!v) return null;
  const rondasListas = v.rondas.filter((r) => r.estado === 'listo');
  const rondasEnCocina = v.rondas.filter((r) => r.estado !== 'listo');
  const platosListos = rondasListas.reduce((s, r) => s + r.platos.reduce((t, p) => t + p.cantidad, 0), 0);
  const espera = rondasEnCocina.reduce((m, r) => Math.max(m, r.minutos), 0);

  let nivel: NivelServicio;
  if (rondasListas.length > 0) nivel = 'listo';
  else if (rondasEnCocina.length > 0) nivel = espera >= MINUTOS_ALERTA ? 'alerta' : espera >= MINUTOS_AVISO ? 'aviso' : 'cocina';
  else nivel = v.rondasEntregadas > 0 ? 'servida' : 'sin_pedir';

  return { nivel, platosListos, espera, rondasListas, rondasEnCocina };
}

/** Orden de urgencia para «Tus mesas»: listos, luego la que más espera, luego la más antigua. */
export function prioridad(mesa: Mesa, ahora: number): number {
  const e = estadoServicio(mesa);
  if (!e) return -1;
  const base = { listo: 4, alerta: 3, aviso: 2, cocina: 1, servida: 0, sin_pedir: 0 }[e.nivel];
  return base * 100_000 + e.espera * 1_000 + minutosEnMesa(mesa, ahora) / 1_000;
}

export function minutosEnMesa(mesa: Mesa, ahora: number): number {
  if (!mesa.visita) return 0;
  return Math.max(0, Math.floor((ahora - new Date(mesa.visita.abiertaDesde).getTime()) / 60000));
}

/** «52 min» o «1 h 05». */
export function duracion(min: number): string {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** Para la esquina de la mesa, sin saltos de línea: «52′» o «1h05». */
export function duracionCorta(min: number): string {
  if (min < 60) return `${min}′`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

export function listaPlatos(rondas: RondaActiva[]): string {
  return rondas
    .flatMap((r) => r.platos)
    .map((p) => (p.cantidad > 1 ? `${p.nombre} ×${p.cantidad}` : p.nombre))
    .join(', ');
}

export function contarPlatos(rondas: RondaActiva[]): number {
  return rondas.reduce((s, r) => s + r.platos.reduce((t, p) => t + p.cantidad, 0), 0);
}
