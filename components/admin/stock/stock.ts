import type { InsumoStock, TipoMovimientoStock } from '@/lib/api';

type Ins = Pick<InsumoStock, 'nombreUnidadMinima' | 'nombreUnidadCompra' | 'unidadesPorUnidadDeCompra'>;

const FR: Record<number, string> = { 1: '⅛', 2: '¼', 3: '⅜', 4: '½', 5: '⅝', 6: '¾', 7: '⅞' };

export const MOTIVOS_MERMA = ['Se malogró', 'Se cayó o rompió', 'Cortesía', 'Consumo del personal', 'Otro'];
export const MOTIVOS_DIFERENCIA = ['Merma no registrada', 'Venta sin registrar', 'Error del conteo anterior', 'Compra no registrada', 'Otro'];

export const TIPO_LABEL: Record<TipoMovimientoStock, string> = {
  venta: 'Venta',
  anulacion: 'Anulación',
  compra: 'Compra',
  merma: 'Merma',
  conteo: 'Conteo',
  correccion: 'Corrección',
};

export const plural = (nombre: string, n: number) =>
  Math.abs(n) === 1 ? nombre : `${nombre}${/[aeiouáéíóú]$/i.test(nombre) ? 's' : 'es'}`;

/** Los insumos que se venden en octavos (pollo) se muestran en pollos y fracciones. */
export const esFraccion = (i: Ins) => i.unidadesPorUnidadDeCompra === 8;

/** «3 ⅜ pollos», «⅞ de pollo», «12 botellas». */
export function cantidadTexto(i: Ins, n: number): string {
  if (esFraccion(i)) {
    const a = Math.abs(n), w = Math.floor(a / 8), r = a % 8, sg = n < 0 ? '−' : '';
    if (!w && !r) return `0 ${plural(i.nombreUnidadCompra, 0)}`;
    if (!w) return `${sg}${FR[r]} de ${i.nombreUnidadCompra}`;
    return `${sg}${w}${r ? ' ' + FR[r] : ''} ${plural(i.nombreUnidadCompra, w === 1 && !r ? 1 : 2)}`;
  }
  return `${n < 0 ? '−' : ''}${Math.abs(n)} ${plural(i.nombreUnidadMinima, n)}`;
}

/** Segunda línea: la misma cantidad en la otra unidad (octavos, o paquetes + sueltas). */
export function cantidadAlterna(i: Ins, n: number): string {
  if (n <= 0) return '';
  if (esFraccion(i)) return `${n} ${plural(i.nombreUnidadMinima, n)}`;
  const u = i.unidadesPorUnidadDeCompra;
  if (u > 1 && n >= u) {
    const p = Math.floor(n / u), r = n % u;
    return `${p} ${plural(i.nombreUnidadCompra, p)}${r ? ` + ${r}` : ''}`;
  }
  return '';
}

export type EstadoStock = { k: 'neg' | 'agot' | 'rep' | 'ok'; texto: string; tono: 'alerta' | 'aviso' | ''; orden: number };

export function estadoStock(i: Pick<InsumoStock, 'stockActual' | 'minimo'>): EstadoStock {
  if (i.stockActual < 0) return { k: 'neg', texto: 'Vendido sin stock', tono: 'alerta', orden: 0 };
  if (i.stockActual === 0) return { k: 'agot', texto: 'Agotado', tono: 'alerta', orden: 1 };
  if (i.minimo > 0 && i.stockActual <= i.minimo) return { k: 'rep', texto: 'Por reponer', tono: 'aviso', orden: 2 };
  return { k: 'ok', texto: '', tono: '', orden: 4 };
}

const hora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }); // yyyy-mm-dd
const diaCorto = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' });

export const horaLima = (d: Date | string) => hora.format(new Date(d));

/** «19:31» si es de hoy, «ayer 23:10», «20 oct 18:00». */
export function fechaCorta(d: Date | string) {
  const f = new Date(d), ahora = new Date();
  const hoy = dia.format(ahora), ayer = dia.format(new Date(ahora.getTime() - 86_400_000));
  const ds = dia.format(f);
  if (ds === hoy) return horaLima(f);
  if (ds === ayer) return `ayer ${horaLima(f)}`;
  return `${diaCorto.format(f)} ${horaLima(f)}`;
}

/** «hoy 19:40» / «ayer 23:10» para el encabezado del último conteo. */
export function fechaConDia(d: Date | string) {
  const t = fechaCorta(d);
  return /^\d/.test(t) && !t.includes(' ') ? `hoy ${t}` : t;
}

/** A qué hora se acaba al ritmo de la última hora; vacío si no aplica. */
export function etaAgota(i: InsumoStock): string {
  if (i.stockActual <= 0 || !i.ritmoHora || (i.minimo > 0 && i.stockActual > i.minimo)) return '';
  const min = Math.round((i.stockActual / i.ritmoHora) * 60);
  if (min > 240) return '';
  return `se acaba ~${horaLima(new Date(Date.now() + min * 60_000))}`;
}

/** Cantidad sugerida a pedir (en unidades de compra) para dejar el doble del mínimo. */
export function sugeridoCompra(i: InsumoStock): number {
  if (i.minimo <= 0 || i.stockActual > i.minimo) return 0;
  return Math.max(1, Math.ceil((i.minimo * 2 - i.stockActual) / i.unidadesPorUnidadDeCompra));
}
