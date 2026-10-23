import type { Mesa } from './types';

/**
 * Nombre visible de una mesa. Los puestos de barra se numeran «Barra 1, 2…»
 * dentro de su zona, en orden de número; el número único sigue siendo el que
 * usan comandas, caja y precuenta.
 */
export function etiquetaMesa(mesa: Mesa, todas: Mesa[]): string {
  if (mesa.tipo !== 'barra') return `Mesa ${mesa.numero}`;
  return `Barra ${ordinalBarra(mesa, todas)}`;
}

/** Versión corta para espacios chicos: «B1» o el número. */
export function etiquetaCorta(mesa: Mesa, todas: Mesa[]): string {
  return mesa.tipo === 'barra' ? `B${ordinalBarra(mesa, todas)}` : String(mesa.numero);
}

function ordinalBarra(mesa: Mesa, todas: Mesa[]) {
  const puestos = todas
    .filter((m) => m.tipo === 'barra' && m.zonaId === mesa.zonaId)
    .sort((a, b) => a.numero - b.numero);
  return puestos.findIndex((m) => m.id === mesa.id) + 1 || 1;
}
