import type { Mesa, ReferenciaPlano, Zona } from '@/lib/types';

// Lógica pura del plano: borrador editable, ocupación de celdas y acomodos.

export interface PosMesa { fila: number | null; col: number | null; ancho: number }

export interface BorradorPlano {
  filas: number;
  columnas: number;
  referencias: ReferenciaPlano[];
  pos: Record<string, PosMesa>;
}

export type Seleccion = { tipo: 'mesa' | 'ref'; id: string } | null;

export const MAX_DIM = 30;

export const REFERENCIAS_SUGERIDAS = ['Entrada', 'Barra', 'Caja', 'Cocina', 'Ventana', 'Baños', 'Escalera'];

export function borradorDesde(zona: Zona, mesas: Mesa[]): BorradorPlano {
  const pos: Record<string, PosMesa> = {};
  for (const m of mesas) pos[m.id] = { fila: m.filaPosicion, col: m.colPosicion, ancho: m.ancho === 2 && m.tipo !== 'barra' ? 2 : 1 };
  return {
    filas: zona.filas,
    columnas: zona.columnas,
    referencias: zona.referencias.map((r) => ({ ...r, alto: r.alto ?? 1 })),
    pos,
  };
}

export function mismoBorrador(a: BorradorPlano, b: BorradorPlano) {
  return JSON.stringify(normalizar(a)) === JSON.stringify(normalizar(b));
}

function normalizar(b: BorradorPlano) {
  return {
    f: b.filas,
    c: b.columnas,
    r: [...b.referencias].sort((x, y) => x.id.localeCompare(y.id)),
    p: Object.keys(b.pos).sort().map((k) => [k, b.pos[k].fila, b.pos[k].col, b.pos[k].ancho]),
  };
}

export function contarCambios(a: BorradorPlano, base: BorradorPlano) {
  let n = 0;
  if (a.filas !== base.filas || a.columnas !== base.columnas) n++;
  for (const [id, p] of Object.entries(a.pos)) {
    const q = base.pos[id];
    if (!q || q.fila !== p.fila || q.col !== p.col || q.ancho !== p.ancho) n++;
  }
  const refsA = new Map(a.referencias.map((r) => [r.id, r]));
  const refsB = new Map(base.referencias.map((r) => [r.id, r]));
  for (const [id, r] of refsA) {
    const q = refsB.get(id);
    if (!q || JSON.stringify(q) !== JSON.stringify(r)) n++;
  }
  for (const id of refsB.keys()) if (!refsA.has(id)) n++;
  return n;
}

/** Mapa celda → elemento que la ocupa. */
export function ocupacion(b: BorradorPlano, excluir?: Seleccion) {
  const m = new Map<string, Exclude<Seleccion, null>>();
  for (const r of b.referencias) {
    if (excluir?.tipo === 'ref' && excluir.id === r.id) continue;
    for (let f = r.fila; f < r.fila + (r.alto ?? 1); f++) {
      for (let c = r.col; c < r.col + r.ancho; c++) m.set(`${f},${c}`, { tipo: 'ref', id: r.id });
    }
  }
  for (const [id, p] of Object.entries(b.pos)) {
    if (p.fila === null || p.col === null) continue;
    if (excluir?.tipo === 'mesa' && excluir.id === id) continue;
    for (let c = p.col; c < p.col + p.ancho; c++) m.set(`${p.fila},${c}`, { tipo: 'mesa', id });
  }
  return m;
}

export function cabe(b: BorradorPlano, fila: number, col: number, ancho: number, excluir?: Seleccion, alto = 1) {
  if (fila < 0 || col < 0 || fila + alto > b.filas || col + ancho > b.columnas) return false;
  const occ = ocupacion(b, excluir);
  for (let f = fila; f < fila + alto; f++) {
    for (let c = col; c < col + ancho; c++) if (occ.has(`${f},${c}`)) return false;
  }
  return true;
}

export function primeraLibre(b: BorradorPlano, ancho: number, excluir?: Seleccion, alto = 1) {
  for (let f = 0; f + alto <= b.filas; f++) {
    for (let c = 0; c + ancho <= b.columnas; c++) {
      if (cabe(b, f, c, ancho, excluir, alto)) return { fila: f, col: c };
    }
  }
  return null;
}

/** Posición y ancho actuales del elemento seleccionado. */
export function posicionDe(b: BorradorPlano, sel: Exclude<Seleccion, null>) {
  if (sel.tipo === 'ref') {
    const r = b.referencias.find((x) => x.id === sel.id);
    return r ? { fila: r.fila, col: r.col, ancho: r.ancho, alto: r.alto ?? 1 } : null;
  }
  const p = b.pos[sel.id];
  return p ? { fila: p.fila, col: p.col, ancho: p.ancho, alto: 1 } : null;
}

export function mover(b: BorradorPlano, sel: Exclude<Seleccion, null>, fila: number, col: number): BorradorPlano {
  if (sel.tipo === 'ref') {
    return { ...b, referencias: b.referencias.map((r) => (r.id === sel.id ? { ...r, fila, col } : r)) };
  }
  return { ...b, pos: { ...b.pos, [sel.id]: { ...b.pos[sel.id], fila, col } } };
}

const esBarra = (etiqueta: string) =>
  etiqueta.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith('barra');

export function tieneBarra(b: BorradorPlano) {
  return b.referencias.some((r) => esBarra(r.etiqueta));
}

/**
 * Celdas pegadas a las referencias «Barra», en el orden en que se sientan
 * los clientes: la fila de abajo, luego la de arriba, luego los costados.
 */
function celdasJuntoABarra(b: BorradorPlano) {
  const celdas: Array<{ fila: number; col: number }> = [];
  for (const r of b.referencias.filter((x) => esBarra(x.etiqueta))) {
    const alto = r.alto ?? 1;
    for (let c = r.col; c < r.col + r.ancho; c++) celdas.push({ fila: r.fila + alto, col: c });
    for (let c = r.col; c < r.col + r.ancho; c++) celdas.push({ fila: r.fila - 1, col: c });
    for (let f = r.fila; f < r.fila + alto; f++) {
      celdas.push({ fila: f, col: r.col - 1 });
      celdas.push({ fila: f, col: r.col + r.ancho });
    }
  }
  return celdas;
}

/** Coloca los puestos de barra sin ubicar en las celdas libres junto a la Barra. */
export function colocarJuntoABarra(b: BorradorPlano, mesas: Mesa[]) {
  const pendientes = mesas
    .filter((m) => m.tipo === 'barra')
    .filter((m) => { const p = b.pos[m.id]; return !p || p.fila === null || p.col === null; })
    .sort((x, y) => x.numero - y.numero);
  let base = b;
  let colocados = 0;
  const candidatas = celdasJuntoABarra(b);
  for (const m of pendientes) {
    const lugar = candidatas.find((c) => cabe(base, c.fila, c.col, 1));
    if (!lugar) break;
    base = { ...base, pos: { ...base.pos, [m.id]: { ...base.pos[m.id], ancho: 1, fila: lugar.fila, col: lugar.col } } };
    colocados++;
  }
  return { borrador: base, colocados, faltan: pendientes.length - colocados };
}

/**
 * Vuelve a colocar todas las mesas: primero los puestos de barra junto a la
 * Barra, luego el resto en orden de número, de izquierda a derecha y de
 * arriba abajo, respetando las referencias. Agrega filas si hace falta.
 */
export function ordenarPorNumero(b: BorradorPlano, mesas: Mesa[]): BorradorPlano {
  const ordenadas = [...mesas].sort((x, y) => x.numero - y.numero);
  let filas = b.filas;
  const pos: Record<string, PosMesa> = {};
  for (const m of ordenadas) pos[m.id] = { ...b.pos[m.id], fila: null, col: null };
  let base: BorradorPlano = colocarJuntoABarra({ ...b, pos }, ordenadas).borrador;
  for (const m of ordenadas) {
    if (base.pos[m.id].fila !== null) continue;
    const ancho = base.pos[m.id].ancho;
    let lugar = primeraLibre(base, ancho);
    while (!lugar && filas < MAX_DIM) {
      filas++;
      base = { ...base, filas };
      lugar = primeraLibre(base, ancho);
    }
    if (!lugar) break;
    base = { ...base, pos: { ...base.pos, [m.id]: { ...base.pos[m.id], fila: lugar.fila, col: lugar.col } } };
  }
  return base;
}

/** Extensión mínima (filas, columnas) que ocupan los elementos colocados. */
export function extensionUsada(b: BorradorPlano) {
  let filas = 0;
  let columnas = 0;
  for (const r of b.referencias) {
    filas = Math.max(filas, r.fila + (r.alto ?? 1));
    columnas = Math.max(columnas, r.col + r.ancho);
  }
  for (const p of Object.values(b.pos)) {
    if (p.fila === null || p.col === null) continue;
    filas = Math.max(filas, p.fila + 1);
    columnas = Math.max(columnas, p.col + p.ancho);
  }
  return { filas, columnas };
}
