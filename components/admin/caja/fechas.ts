import type { TurnoResumen, MetodoPago } from '@/lib/api';

const ZONA = 'America/Lima';
const DIA_MS = 86_400_000;

export const CANALES: Array<{ key: MetodoPago; label: string; corto: string }> = [
  { key: 'efectivo',      label: 'Efectivo',      corto: 'Efectivo' },
  { key: 'tarjeta',       label: 'Tarjeta',       corto: 'Tarjeta' },
  { key: 'yape_plin',     label: 'Yape / Plin',   corto: 'Yape / Plin' },
  { key: 'transferencia', label: 'Transferencia', corto: 'Transf.' },
];

export const hoyLima = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());

export function sumarDias(fecha: string, dias: number) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export type TipoPeriodo = 'hoy' | 'ayer' | '7d' | 'mes' | 'rango';

export function rangoDe(tipo: Exclude<TipoPeriodo, 'rango'>, hoy = hoyLima()) {
  if (tipo === 'ayer') { const a = sumarDias(hoy, -1); return { desde: a, hasta: a }; }
  if (tipo === '7d') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (tipo === 'mes') return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  return { desde: hoy, hasta: hoy };
}

const fechaDate = (f: string) => new Date(`${f}T12:00:00-05:00`);

export function etiquetaDia(f: string) {
  const s = fechaDate(f).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', timeZone: ZONA });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function etiquetaRango(desde: string, hasta: string) {
  if (desde === hasta) {
    return fechaDate(desde).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA });
  }
  const f = (x: string, conMes: boolean) =>
    fechaDate(x).toLocaleDateString('es-PE', { day: 'numeric', ...(conMes ? { month: 'long' } : {}), timeZone: ZONA });
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  return `${f(desde, !mismoMes)} – ${f(hasta, true)}`;
}

export const diaLima = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(iso));

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA });

export function duracion(desde: string, hasta: string | null, ahora: string) {
  const min = Math.max(0, Math.round(((hasta ? new Date(hasta) : new Date(ahora)).getTime() - new Date(desde).getTime()) / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** Hora decimal dentro del día pedido (acotada a 0–24) para ubicar un turno en el eje. */
export function horaDecimal(iso: string, dia: string) {
  const min = (new Date(iso).getTime() - new Date(`${dia}T00:00:00-05:00`).getTime()) / 60000;
  return Math.min(24, Math.max(0, min / 60));
}

export const soles = (v: string | number) =>
  Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const solesEnteros = (v: number) =>
  v.toLocaleString('es-PE', { maximumFractionDigits: 0 });

export type EstadoArqueo =
  | { tipo: 'curso' }
  | { tipo: 'ok' }
  | { tipo: 'falta'; monto: number }
  | { tipo: 'sobra'; monto: number };

export function estadoArqueo(t: Pick<TurnoResumen, 'estado' | 'diferencia'>): EstadoArqueo {
  if (t.estado === 'abierto') return { tipo: 'curso' };
  const d = parseFloat(t.diferencia ?? '0');
  if (Math.abs(d) < 0.005) return { tipo: 'ok' };
  return d < 0 ? { tipo: 'falta', monto: -d } : { tipo: 'sobra', monto: d };
}

export const periodoEnCurso = (desde: string, hasta: string, hoy = hoyLima()) => desde <= hoy && hoy <= hasta;
export { DIA_MS };
