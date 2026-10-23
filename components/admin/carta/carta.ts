import type { CategoriaCarta, PlatoCarta } from '@/lib/types';

// Reglas y utilidades compartidas por la pantalla Carta.

export type FiltroCarta = 'carta' | 'agotados' | 'retirados';

export function categoriaDe(p: PlatoCarta): string {
  return p.categoriaId || p.categoria?.id;
}

/** Plato de una categoría que descuenta stock, pero sin insumo vinculado: no descuenta nada. */
export function sinVincular(p: PlatoCarta, cat: CategoriaCarta | undefined): boolean {
  return !!cat?.descuentaStock && p.activo && p.stockActual === null;
}

export function pasaFiltro(p: PlatoCarta, filtro: FiltroCarta): boolean {
  if (filtro === 'retirados') return !p.activo;
  if (filtro === 'agotados') return p.activo && !p.disponible;
  return p.activo;
}

export function formatoPrecio(precio: string | number): string {
  const n = typeof precio === 'number' ? precio : parseFloat(precio);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

/** Acepta «12», «12.5», «12,50» o «S/ 12.50». Devuelve null si no es un precio mayor a 0. */
export function leerPrecio(texto: string): number | null {
  const limpio = texto.replace(/s\/\s*/i, '').replace(',', '.').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const n = parseFloat(limpio);
  return n > 0 ? n : null;
}

/**
 * Convierte una lista pegada (Excel, WhatsApp, notas) en filas de nombre y precio.
 * Cada línea: «Nombre<TAB>precio», «Nombre ..... S/ 12.50» o solo «Nombre».
 */
export function leerListaPegada(texto: string): Array<{ nombre: string; precio: string; descripcion: string }> {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      const celdas = linea.split('\t').map((c) => c.trim());
      if (celdas.length >= 2) {
        return { nombre: celdas[0], precio: celdas[1].replace(/s\/\s*/i, ''), descripcion: celdas[2] ?? '' };
      }
      const m = linea.match(/^(.*?)[\s.:\-–]+(?:s\/\s*)?(\d+(?:[.,]\d{1,2})?)$/i);
      if (m) return { nombre: m[1].trim(), precio: m[2].replace(',', '.'), descripcion: '' };
      return { nombre: linea, precio: '', descripcion: '' };
    });
}

export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}
