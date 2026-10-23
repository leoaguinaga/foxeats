import type { Promocion, TipoDescuento } from './types';

// Lectura de promociones compartida por administración y salón. El cálculo del
// descuento replica PromocionesService.calcularDescuentoUnitario del backend.

export const DIAS = [
  { iso: 1, corto: 'Lun', largo: 'lunes', plural: 'lunes' },
  { iso: 2, corto: 'Mar', largo: 'martes', plural: 'martes' },
  { iso: 3, corto: 'Mié', largo: 'miércoles', plural: 'miércoles' },
  { iso: 4, corto: 'Jue', largo: 'jueves', plural: 'jueves' },
  { iso: 5, corto: 'Vie', largo: 'viernes', plural: 'viernes' },
  { iso: 6, corto: 'Sáb', largo: 'sábado', plural: 'sábados' },
  { iso: 7, corto: 'Dom', largo: 'domingo', plural: 'domingos' },
] as const;

export const PRESETS_DIAS = [
  { label: 'Todos los días', dias: [1, 2, 3, 4, 5, 6, 7] },
  { label: 'Lunes a viernes', dias: [1, 2, 3, 4, 5] },
  { label: 'Fin de semana', dias: [6, 7] },
];

type Descuento = { tipoDescuento: TipoDescuento; valorDescuento: string };

export function descuentoUnitario(precio: number, promo: Descuento): number {
  const valor = parseFloat(promo.valorDescuento);
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  const d = promo.tipoDescuento === 'porcentaje' ? (precio * valor) / 100 : valor;
  return Math.round(Math.min(Math.max(d, 0), precio) * 100) / 100;
}

export function precioConPromo(precio: number, promo: Descuento | null | undefined): number {
  return promo ? Math.round((precio - descuentoUnitario(precio, promo)) * 100) / 100 : precio;
}

export function etiquetaDescuento(promo: Descuento): string {
  const v = parseFloat(promo.valorDescuento);
  if (!Number.isFinite(v)) return '—';
  return promo.tipoDescuento === 'porcentaje'
    ? `−${Number.isInteger(v) ? v : v.toFixed(1)} %`
    : `−S/ ${v.toFixed(2)}`;
}

export const soles = (n: number) => `S/ ${n.toFixed(2)}`;

export function resumenDias(dias: number[]): string {
  const orden = [...dias].sort((a, b) => a - b);
  const preset = PRESETS_DIAS.find((p) => p.dias.join() === orden.join());
  if (preset) return preset.label;
  if (orden.length === 0) return 'Ningún día';
  const nombres = orden.map((d) => DIAS[d - 1].plural);
  if (nombres.length === 1) return `Solo los ${nombres[0]}`;
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`.replace(/^./, (c) => c.toUpperCase());
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

export function resumenHorario(p: { horaInicio?: string | null; horaFin?: string | null }): string {
  const ini = hhmm(p.horaInicio);
  const fin = hhmm(p.horaFin);
  if (!ini && !fin) return 'Todo el día';
  if (ini && fin) return `${ini} a ${fin}`;
  return ini ? `Desde las ${ini}` : `Hasta las ${fin}`;
}

const fechaCorta = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
export function fechaLegible(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return fechaCorta.format(new Date(y, m - 1, d)).replace('.', '');
}

export type EstadoPromo =
  | { tipo: 'ahora'; texto: string }
  | { tipo: 'hoy'; texto: string }
  | { tipo: 'proxima'; texto: string }
  | { tipo: 'programada'; texto: string }
  | { tipo: 'pausada'; texto: string }
  | { tipo: 'vencida'; texto: string }
  | { tipo: 'sin_platos'; texto: string };

function partesLocales(ahora: Date) {
  const iso = ahora.getDay() === 0 ? 7 : ahora.getDay();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    iso,
    hora: `${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`,
    fecha: `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`,
  };
}

/** Qué le pasa a la promo respecto de este momento, en palabras del local. */
export function estadoPromo(p: Promocion, ahora: Date): EstadoPromo {
  if (!p.activo) return { tipo: 'pausada', texto: 'Pausada' };
  const { iso, hora, fecha } = partesLocales(ahora);
  if (p.vigenteHasta && p.vigenteHasta < fecha) return { tipo: 'vencida', texto: `Terminó el ${fechaLegible(p.vigenteHasta)}` };
  if (p.platoCartaIds.length === 0) return { tipo: 'sin_platos', texto: 'Sin platos' };
  if (p.vigenteDesde && p.vigenteDesde > fecha) return { tipo: 'programada', texto: `Empieza el ${fechaLegible(p.vigenteDesde)}` };

  if (p.diasSemana.includes(iso)) {
    const despuesInicio = !p.horaInicio || p.horaInicio <= hora;
    const antesFin = !p.horaFin || p.horaFin >= hora;
    if (despuesInicio && antesFin) {
      return { tipo: 'ahora', texto: p.horaFin ? `Rige hasta las ${hhmm(p.horaFin)}` : 'Rige ahora' };
    }
    if (!despuesInicio) return { tipo: 'hoy', texto: `Hoy desde las ${hhmm(p.horaInicio)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const d = ((iso - 1 + i) % 7) + 1;
    if (p.diasSemana.includes(d)) {
      const cuando = i === 1 ? 'Mañana' : `El ${DIAS[d - 1].largo}`;
      return { tipo: 'proxima', texto: p.horaInicio ? `${cuando} desde las ${hhmm(p.horaInicio)}` : cuando };
    }
  }
  return { tipo: 'proxima', texto: 'Sin días' };
}

/** ISO del día de hoy (1 = lunes … 7 = domingo) en la hora del navegador. */
export const diaIsoHoy = (ahora: Date) => partesLocales(ahora).iso;
