const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(err.message ?? `Error ${res.status}`);
  }
  // Nest responde 200 con cuerpo vacío cuando un endpoint devuelve null.
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export const api = {
  mesas: {
    list: () => apiFetch<import('./types').Mesa[]>('/tables'),
    abrir: (mesaId: string) =>
      apiFetch<{ id: string }>(`/tables/${mesaId}/open`, { method: 'POST' }),
    visitaActiva: (mesaId: string) =>
      apiFetch<{ id: string }>(`/tables/${mesaId}/active-visit`),
    actualizarLayout: (
      posiciones: Array<{ id: string; filaPosicion: number | null; colPosicion: number | null }>,
    ) =>
      apiFetch<{ ok: boolean; actualizadas: number }>('/tables/layout', {
        method: 'POST',
        body: JSON.stringify({ posiciones }),
      }),
    actualizar: (id: string, data: Partial<{ numero: number; capacidad: number; zonaId: string; ancho: number; tipo: import('./types').TipoMesa }>) =>
      apiFetch<import('./types').Mesa>(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    crearRango: (data: { desde: number; hasta: number; capacidad: number; zonaId: string; tipo?: import('./types').TipoMesa }) =>
      apiFetch<{ creadas: import('./types').Mesa[]; omitidos: number[] }>('/tables/bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  zonas: {
    list: () => apiFetch<import('./types').Zona[]>('/zones'),
    crear: (data: { nombre: string; modo?: import('./types').ModoZona }) =>
      apiFetch<import('./types').Zona>('/zones', { method: 'POST', body: JSON.stringify(data) }),
    actualizar: (id: string, data: Partial<{ nombre: string; modo: import('./types').ModoZona; filas: number; columnas: number }>) =>
      apiFetch<import('./types').Zona>(`/zones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    reordenar: (ids: string[]) =>
      apiFetch<import('./types').Zona[]>('/zones/order', { method: 'POST', body: JSON.stringify({ ids }) }),
    eliminar: (id: string) => apiFetch<{ ok: boolean }>(`/zones/${id}`, { method: 'DELETE' }),
    guardarPlano: (id: string, data: {
      filas: number;
      columnas: number;
      referencias: import('./types').ReferenciaPlano[];
      mesas: Array<{ id: string; filaPosicion: number | null; colPosicion: number | null; ancho: number }>;
    }) => apiFetch<{ ok: boolean }>(`/zones/${id}/layout`, { method: 'POST', body: JSON.stringify(data) }),
  },
  menu: {
    list: () => apiFetch<import('./types').PlatoCarta[]>('/menu'),
    /** Lo más vendido en salón (30 días), para «Más pedidos» del mesero. */
    masPedidosSalon: () => apiFetch<string[]>('/menu/mas-pedidos?tipo=mesa'),
    toggleDisponible: (platoId: string, disponible: boolean) =>
      apiFetch(`/platos/${platoId}`, {
        method: 'PATCH',
        body: JSON.stringify({ disponible }),
      }),
  },
  promociones: {
    vigentes: () => apiFetch<import('./types').PromocionVigente[]>('/promociones/vigentes'),
  },
  categorias: {
    list: () => apiFetch<import('./types').CategoriaCarta[]>('/categorias'),
    create: (data: { nombre: string; slug?: string; descuentaStock?: boolean; esParaCocina?: boolean; orden?: number }) =>
      apiFetch<import('./types').CategoriaCarta>('/categorias', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<import('./types').CategoriaCarta>) =>
      apiFetch<import('./types').CategoriaCarta>(`/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    eliminar: (id: string) => apiFetch<{ ok: boolean }>(`/categorias/${id}`, { method: 'DELETE' }),
  },
  platos: {
    /** Incluye los retirados de la carta; solo para administración. */
    listAdmin: () => apiFetch<import('./types').PlatoCarta[]>('/platos?retirados=1'),
    recetas: (platoId: string) => apiFetch<import('./types').RecetaPlato[]>(`/platos/${platoId}/recetas`),
    crearReceta: (platoId: string, data: { insumoId: string; cantidadConsumida: number }) =>
      apiFetch<import('./types').RecetaPlato>(`/platos/${platoId}/recetas`, { method: 'POST', body: JSON.stringify(data) }),
    borrarReceta: (recetaId: string) =>
      apiFetch<import('./types').RecetaPlato>(`/recetas/${recetaId}`, { method: 'DELETE' }),
  },
  insumos: {
    list: () => apiFetch<InsumoStock[]>('/insumos'),
    create: (data: { nombre: string; unidadesPorUnidadDeCompra?: number; nombreUnidadMinima?: string; nombreUnidadCompra?: string; minimo?: number; stockActual?: number }) =>
      apiFetch<InsumoStock>('/insumos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ nombre: string; unidadesPorUnidadDeCompra: number; nombreUnidadMinima: string; nombreUnidadCompra: string; minimo: number; activo: boolean }>) =>
      apiFetch<InsumoStock>(`/insumos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  visitas: {
    get: (visitaId: string) => apiFetch<import('./types').Visita>(`/visits/${visitaId}`),
    crearPedido: (
      visitaId: string,
      items: Array<{ platoCartaId: string; cantidad: number; notas?: string }>,
      opciones: { paraLlevar?: boolean; nombreClienteLlevar?: string } = {},
    ) =>
      apiFetch<import('./types').Pedido>(`/visits/${visitaId}/orders`, {
        method: 'POST',
        body: JSON.stringify({ items, ...opciones }),
      }),
    cerrar: (visitaId: string) =>
      apiFetch(`/visits/${visitaId}/close`, { method: 'POST' }),
    imprimirCuenta: (visitaId: string) =>
      apiFetch<{ ok: boolean }>(`/visits/${visitaId}/print-bill`, { method: 'POST' }),
    abrirParaLlevar: (data?: { nombreCliente?: string }) =>
      apiFetch<{ id: string }>('/visits/llevar', {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }),
    activeLlevarDelivery: () =>
      apiFetch<Array<{
        id: string;
        tipo: 'llevar' | 'delivery';
        nombreCliente: string | null;
        telefonoCliente: string | null;
        direccionDelivery: string | null;
        costoEnvio: string | null;
        fechaApertura: string;
        total: string;
        cantidadItems: number;
      }>>('/visits/active-llevar-delivery'),
  },
  pedidos: {
    cambiarEstado: (pedidoId: string, estado: string, opciones: { motivoCancelacion?: string } = {}) =>
      apiFetch<import('./types').Pedido>(`/orders/${pedidoId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ estado, ...opciones }),
      }),
    cancelarItem: (itemId: string) =>
      apiFetch<any>(`/orders/items/${itemId}/cancel`, { method: 'PATCH' }),
  },
  monitor: {
    get: () => apiFetch<MonitorItem[]>('/monitor'),
  },
  ticketeras: {
    list:      () => apiFetch<PrinterInfo[]>('/admin/ticketeras'),
    update:    (tipo: 'cocina' | 'recibos', data: { modo: ModoTicketera; ip: string | null; puerto: number }) =>
      apiFetch<PrinterInfo[]>(`/admin/ticketeras/${tipo}`, { method: 'PATCH', body: JSON.stringify(data) }),
    testPrint: (tipo: 'cocina' | 'recibos') =>
      apiFetch<{ ok: boolean }>(`/admin/ticketeras/${tipo}/test`, { method: 'POST' }),
  },
  admin: {
    settings: () => apiFetch<LocalConfig>('/admin/settings'),
    brand: () => apiFetch<Pick<LocalConfig, 'nombre' | 'logo'>>('/admin/settings/brand'),
    updateSettings: (data: LocalConfig) => apiFetch<LocalConfig>('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    caja:               (f: { desde?: string; hasta?: string; cajero?: string } = {}) =>
      apiFetch<CajaPeriodo>(`/cash/shifts${queryCaja(f)}`),
    turnoDetalle:       (id: string) => apiFetch<TurnoDetalle>(`/cash/shifts/${id}`),
    exportarCaja:       async (f: { desde: string; hasta: string; cajero?: string }) => {
      const res = await fetch(`${BASE}/cash/export.csv${queryCaja(f)}`, { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo exportar');
      return res.blob();
    },
    listUsuarios:       () => apiFetch<UsuarioAdmin[]>('/admin/users'),
    crearUsuario:       (data: { name: string; email: string; password: string; role: string }) =>
      apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUsuario:      (id: string, data: { name?: string; activo?: boolean; role?: string }) =>
      apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    restablecerPassword: (id: string, password: string) =>
      apiFetch(`/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
    crearMesa:          (numero: number, capacidad: number, zonaId?: string) =>
      apiFetch<import('./types').Mesa>('/tables', { method: 'POST', body: JSON.stringify({ numero, capacidad, zonaId }) }),
    eliminarMesa:       (id: string) =>
      apiFetch(`/tables/${id}`, { method: 'DELETE' }),
    crearPlato:         (data: { nombre: string; precio: string; categoriaId: string; descripcion?: string }) =>
      apiFetch<import('./types').PlatoCarta>('/platos', { method: 'POST', body: JSON.stringify(data) }),
    crearPlatosBulk:    (data: {
      categoriaId: string;
      platos: Array<{ nombre: string; precio: string; descripcion?: string }>;
    }) =>
      apiFetch<import('./types').PlatoCarta[]>('/platos/bulk', { method: 'POST', body: JSON.stringify(data) }),
    editarPlato:        (id: string, data: { nombre?: string; precio?: string; categoriaId?: string; descripcion?: string | null }) =>
      apiFetch<import('./types').PlatoCarta>(`/platos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    toggleActivoPlato:  (id: string, activo: boolean) =>
      apiFetch(`/platos/${id}`, { method: 'PATCH', body: JSON.stringify({ activo }) }),
    getStock:           () => apiFetch<InsumoStock[]>('/admin/stock'),
    ultimoConteo:       () => apiFetch<UltimoConteo | null>('/admin/stock/ultimo-conteo'),
    movimientosStock:   (insumoId: string, limite = 60) =>
      apiFetch<MovimientoStock[]>(`/admin/stock/${insumoId}/movimientos?limite=${limite}`),
    registrarMerma:     (insumoId: string, data: { cantidad: number; motivo: string; nota?: string }) =>
      apiFetch<{ stockActual: number }>(`/admin/stock/${insumoId}/merma`, { method: 'POST', body: JSON.stringify(data) }),
    corregirStock:      (insumoId: string, data: { stockReal: number; motivo: string }) =>
      apiFetch<{ stockActual: number }>(`/admin/stock/${insumoId}/correccion`, { method: 'POST', body: JSON.stringify(data) }),
    registrarCompra:    (data: { proveedor?: string; items: Array<{ insumoId: string; cantidad: number }> }) =>
      apiFetch<{ compraId: string; insumos: number }>('/admin/stock/compra', { method: 'POST', body: JSON.stringify(data) }),
    registrarConteo:    (items: Array<{ insumoId: string; contado: number; motivo?: string }>) =>
      apiFetch<{ conteoId: string; contados: number; diferencias: number }>('/admin/stock/conteo', { method: 'POST', body: JSON.stringify({ items }) }),
    promociones: {
      list:      () => apiFetch<import('./types').Promocion[]>('/admin/promociones'),
      get:       (id: string) => apiFetch<import('./types').Promocion>(`/admin/promociones/${id}`),
      create:    (data: import('./types').UpsertPromocion) =>
        apiFetch<import('./types').Promocion>('/admin/promociones', { method: 'POST', body: JSON.stringify(data) }),
      update:    (id: string, data: import('./types').UpsertPromocion) =>
        apiFetch<import('./types').Promocion>(`/admin/promociones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      setActivo: (id: string, activo: boolean) =>
        apiFetch(`/admin/promociones/${id}/activo`, { method: 'PATCH', body: JSON.stringify({ activo }) }),
      remove:    (id: string) =>
        apiFetch(`/admin/promociones/${id}`, { method: 'DELETE' }),
    },
  },
  caja: {
    turnoActual: () => apiFetch<TurnoCaja | null>('/cash/shift/current'),
    abrirTurno: (montoApertura: number) =>
      apiFetch<TurnoCaja>('/cash/shift/open', { method: 'POST', body: JSON.stringify({ montoApertura }) }),
    cerrarTurno: (montoCierreReal: number) =>
      apiFetch<TurnoCaja>('/cash/shift/close', { method: 'POST', body: JSON.stringify({ montoCierreReal }) }),
    registrarGasto: (monto: number, motivo: string) =>
      apiFetch<any>('/cash/shift/expense', { method: 'POST', body: JSON.stringify({ monto, motivo }) }),
    editarGasto: (id: string, monto: number, motivo: string) =>
      apiFetch<any>(`/cash/shift/expense/${id}`, { method: 'PATCH', body: JSON.stringify({ monto, motivo }) }),
    eliminarGasto: (id: string) =>
      apiFetch<any>(`/cash/shift/expense/${id}`, { method: 'DELETE' }),
    visitasParaCobrar: () => apiFetch<VisitaResumen[]>('/cash/visits-to-collect'),
    masPedidos: () => apiFetch<string[]>('/cash/mas-pedidos'),
    detalleVisita: (visitaId: string) => apiFetch<DetalleVisitaCaja>(`/cash/visits/${visitaId}`),
    registrarPago: (
      visitaId: string,
      pagos: Array<{ metodoPago: string; monto: number }>,
      ajuste?: { monto: number; motivo: string },
    ) =>
      apiFetch(`/cash/visits/${visitaId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ pagos, ...(ajuste ? { ajuste } : {}) }),
      }),
    imprimirPrecuenta: (visitaId: string) =>
      apiFetch<{ ok: boolean; total: string }>(`/cash/visits/${visitaId}/print-precuenta`, {
        method: 'POST',
      }),
    crearPedidoLlevar: (data: {
      nombreCliente?: string;
      items: Array<{ platoCartaId: string; cantidad: number; notas?: string }>;
    }) =>
      apiFetch<{ ok: boolean; visitaId: string; nombreCliente: string }>('/cash/pedidos/llevar', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    crearPedidoDelivery: (data: {
      nombreCliente: string;
      telefonoCliente?: string;
      direccionDelivery: string;
      costoEnvio: number;
      items: Array<{ platoCartaId: string; cantidad: number; notas?: string }>;
    }) =>
      apiFetch<{ ok: boolean; visitaId: string }>('/cash/pedidos/delivery', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    cancelarVisita: (visitaId: string, motivo: string) =>
      apiFetch<{ ok: boolean }>(`/cash/visits/${visitaId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      }),
  },
};

export interface TurnoCaja {
  id: string;
  estado: 'abierto' | 'cerrado';
  montoApertura: string;
  montoCierreTeorico?: string;
  montoCierreReal?: string;
  diferencia?: string;
  fechaApertura: string;
  fechaCierre?: string;
  totalEfectivo?: string;
  totalTurno?: string;
  totalGastos?: string;
  porCanal?: { efectivo: string; tarjeta: string; yape_plin: string; transferencia: string };
  pagos?: PagoCaja[];
  gastos?: GastoCaja[];
}

export interface GastoCaja {
  id: string;
  turnoCajaId: string;
  cajeroUsuarioId: string;
  monto: string;
  motivo: string;
  createdAt: string;
}

export interface PagoCaja {
  id: string;
  visitaMesaId: string;
  metodoPago: string;
  montoTotal: string;
  fechaPago: string;
  mesaNumero?: number | null;
  visitaTipo?: 'mesa' | 'llevar' | 'delivery' | null;
  nombreCliente?: string | null;
}

export interface VisitaResumen {
  visitaId: string;
  mesaNumero: number | null;
  tipo: 'mesa' | 'llevar' | 'delivery';
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  direccionDelivery?: string | null;
  costoEnvio?: string | null;
  paraLlevar?: boolean;
  fechaApertura: string;
  total: string;
  pedidos: number;
  /** Para llevar o delivery con todo lo de cocina listo para entregar. */
  listo?: boolean;
}

export interface DetalleVisitaCaja {
  visitaId: string;
  mesaNumero: number | null;
  tipo: 'mesa' | 'llevar' | 'delivery';
  nombreCliente?: string | null;
  telefonoCliente?: string | null;
  direccionDelivery?: string | null;
  costoEnvio?: string | null;
  fechaApertura: string;
  resumen: Array<{ nombre: string; cantidad: number; precioUnitario: string; descuentoUnitario?: string; itemIds: string[] }>;
  total: string;
  descuentoTotal?: string;
}

export interface UsuarioAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  activo: boolean | null;
  createdAt: string;
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'yape_plin' | 'transferencia';
export type PorCanal = Record<MetodoPago, string>;

export interface TurnoResumen {
  id: string;
  cajeroUsuarioId: string;
  cajeroNombre: string;
  estado: 'abierto' | 'cerrado';
  montoApertura: string;
  montoCierreTeorico: string;
  montoCierreReal: string | null;
  diferencia: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  porCanal: PorCanal;
  totalTurno: string;
  totalGastos: string;
  cobros: number;
}

export interface CajaPeriodo {
  desde: string;
  hasta: string;
  ahora: string;
  cajeros: Array<{ id: string; nombre: string }>;
  turnos: TurnoResumen[];
  resumen: {
    ingresos: string;
    gastos: string;
    cantidadGastos: number;
    neto: string;
    cuentas: number;
    ticketPromedio: string;
    porCanal: PorCanal;
    porTipo: Array<{ tipo: 'mesa' | 'llevar' | 'delivery'; monto: string; cuentas: number }>;
    serie: Array<{ clave: string; monto: string }>;
    serieTipo: 'hora' | 'dia';
    mejorDia: { clave: string; monto: string } | null;
    gavetaAhora: { monto: string; cajero: string; turnoId: string } | null;
    arqueo: { diferencia: string; turnosCerrados: number; turnosConDiferencia: number };
    ajustes: Array<{ pagoId: string; turnoId: string; monto: string; motivo: string | null; fecha: string; cuenta: string }>;
  };
}

export interface TurnoDetalle extends TurnoResumen {
  arqueo: {
    apertura: string;
    efectivo: string;
    gastos: string;
    esperado: string;
    contado: string | null;
    diferencia: string | null;
  };
  cuentas: Array<{
    visitaId: string;
    fecha: string;
    etiqueta: string;
    metodos: Array<{ metodo: MetodoPago; monto: string }>;
    monto: string;
    ajusteMonto: string | null;
    motivoAjuste: string | null;
  }>;
  gastos: GastoCaja[];
}

function queryCaja(f: { desde?: string; hasta?: string; cajero?: string }) {
  const q = new URLSearchParams();
  if (f.desde) q.set('desde', f.desde);
  if (f.hasta) q.set('hasta', f.hasta);
  if (f.cajero) q.set('cajero', f.cajero);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export interface MonitorItem {
  pedidoId: string;
  visitaId: string;
  /** null en para llevar y delivery. */
  mesaNumero: number | null;
  /** «Mesa 6» o «Barra 1»; null en para llevar y delivery. */
  mesaEtiqueta: string | null;
  tipoVisita: 'mesa' | 'llevar' | 'delivery';
  nombreCliente: string | null;
  abiertaPor: { id: string; nombre: string };
  /** Número de la ronda dentro de su visita (1, 2, 3…). */
  numeroRonda: number;
  estado: 'pendiente' | 'en_preparacion' | 'listo';
  fechaCreacion: string;
  fechaListo: string | null;
  minutosEspera: number;
  items: Array<{ platoCartaId: string; nombre: string; cantidad: number; notas: string | null }>;
}

export type ModoTicketera = 'simulada' | 'red';

export interface PrinterInfo {
  tipo: 'cocina' | 'recibos';
  label: string;
  modo: ModoTicketera;
  ip: string | null;
  port: number;
  online: boolean;
  latencyMs?: number;
}

export interface InsumoStock {
  id: string;
  nombre: string;
  stockActual: number;
  nombreUnidadMinima: string;
  nombreUnidadCompra: string;
  unidadesPorUnidadDeCompra: number;
  minimo: number;
  ordenConteo: number;
  activo: boolean;
  grupo: string;
  /** Unidades mínimas vendidas hoy (neto de anulaciones) y compradas hoy. */
  vendidoHoy: number;
  compradoHoy: number;
  /** Vendido en la última hora, para estimar a qué hora se acaba. */
  ritmoHora: number;
  platosAsociados: Array<{
    id: string;
    recetaId: string;
    nombre: string;
    disponible: boolean;
    cantidadConsumida: number;
    quedan: number;
  }>;
}

export type TipoMovimientoStock = 'venta' | 'anulacion' | 'compra' | 'merma' | 'conteo' | 'correccion';

export interface MovimientoStock {
  id: string;
  tipo: TipoMovimientoStock;
  cantidad: number;
  saldo: number;
  motivo: string | null;
  nota: string | null;
  usuario: string | null;
  createdAt: string;
}

export interface UltimoConteo {
  id: string;
  createdAt: string;
  contados: number;
  diferencias: number;
  usuario: string | null;
}

export interface LocalConfig { nombre: string; logo: string | null; direccion: string; telefono: string }
