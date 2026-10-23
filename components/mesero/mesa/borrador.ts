/** Ronda que el mesero está armando y todavía no envía a cocina. */
export interface BorradorRonda {
  lineas: Array<{ platoId: string; cantidad: number; notas: string }>;
  paraLlevar: boolean;
  nombre: string;
}

export const RONDA_VACIA: BorradorRonda = { lineas: [], paraLlevar: false, nombre: '' };

const clave = (visitaId: string) => `foxeats:ronda:${visitaId}`;

/**
 * La ronda se guarda por mesa en este navegador mientras no se envía: si el
 * mesero sale a otra mesa y vuelve, la encuentra como la dejó.
 */
export function leerBorrador(visitaId: string): BorradorRonda {
  try {
    const crudo = localStorage.getItem(clave(visitaId));
    if (!crudo) return RONDA_VACIA;
    const b = JSON.parse(crudo) as Partial<BorradorRonda>;
    return {
      lineas: Array.isArray(b.lineas) ? b.lineas.filter((l) => l && typeof l.platoId === 'string' && l.cantidad > 0) : [],
      paraLlevar: !!b.paraLlevar,
      nombre: typeof b.nombre === 'string' ? b.nombre : '',
    };
  } catch {
    return RONDA_VACIA;
  }
}

export function guardarBorrador(visitaId: string, b: BorradorRonda) {
  try {
    if (b.lineas.length === 0 && !b.paraLlevar) localStorage.removeItem(clave(visitaId));
    else localStorage.setItem(clave(visitaId), JSON.stringify(b));
  } catch {
    // Sin almacenamiento (ventana privada): la ronda vive solo en esta pantalla.
  }
}
