export type EstadoMesa = 'libre' | 'ocupada';
export type EstadoPedido = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';

export interface CategoriaCarta {
  id: string;
  nombre: string;
  slug: string;
  descuentaStock: boolean;
  esParaCocina: boolean;
  orden: number;
  activo: boolean;
}

export interface Mesa {
  id: string;
  numero: number;
  estado: EstadoMesa;
  capacidad: number | null;
  filaPosicion: number | null;
  colPosicion: number | null;
  zonaId: string | null;
  ancho: number;
  tipo: TipoMesa;
  /** Visita abierta de la mesa ocupada (null si está libre). */
  visita?: VisitaEnMesa | null;
}

export interface RondaActiva {
  id: string;
  estado: 'pendiente' | 'en_preparacion' | 'listo';
  /** Minutos desde que se envió a cocina. */
  minutos: number;
  platos: Array<{ nombre: string; cantidad: number }>;
}

export interface VisitaEnMesa {
  id: string;
  abiertaDesde: string;
  abiertaPor: { id: string; nombre: string };
  /** Rondas en cocina o listas, de la más antigua a la más nueva. */
  rondas: RondaActiva[];
  rondasEntregadas: number;
}

export type TipoMesa = 'mesa' | 'barra';

export type ModoZona = 'plano' | 'numeros';

export interface ReferenciaPlano {
  id: string;
  etiqueta: string;
  fila: number;
  col: number;
  ancho: number;
  alto: number;
}

export interface Zona {
  id: string;
  nombre: string;
  orden: number;
  modo: ModoZona;
  filas: number;
  columnas: number;
  referencias: ReferenciaPlano[];
}

export interface PlatoCarta {
  id: string;
  nombre: string;
  precio: string;
  categoriaId: string;
  categoria: CategoriaCarta;
  disponible: boolean;
  activo: boolean;
  descripcion: string | null;
  stockActual: number | null;
  nombreUnidadMinima: string | null;
  /** Cuántos de este plato alcanzan con el stock del insumo (null = sin receta). */
  quedan: number | null;
  stockMinimo: number | null;
  insumoId: string | null;
  cantidadConsumida: number | null;
}

export interface RecetaPlato {
  id: string;
  platoCartaId: string;
  insumoId: string;
  cantidadConsumida: number;
}

export interface ItemPedido {
  id: string;
  pedidoId: string;
  platoCartaId: string;
  cantidad: number;
  precioUnitarioCongelado: string;
  descuentoUnitario: string;
  promocionAplicadaId: string | null;
  notas: string | null;
  estado: EstadoPedido;
}

export type TipoDescuento = 'porcentaje' | 'monto_fijo';

export interface Promocion {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipoDescuento: TipoDescuento;
  valorDescuento: string;
  diasSemana: number[]; // 1=lunes ... 7=domingo
  horaInicio: string | null;
  horaFin: string | null;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  activo: boolean;
  platoCartaIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Promo que rige ahora, tal como la ve el salón (GET /promociones/vigentes). */
export interface PromocionVigente {
  id: string;
  nombre: string;
  tipoDescuento: TipoDescuento;
  valorDescuento: string;
  horaFin: string | null;
  platoCartaIds: string[];
}

export interface UpsertPromocion {
  nombre: string;
  descripcion?: string | null;
  tipoDescuento: TipoDescuento;
  valorDescuento: string;
  diasSemana: number[];
  horaInicio?: string | null;
  horaFin?: string | null;
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
  activo?: boolean;
  platoCartaIds: string[];
}

export interface Pedido {
  id: string;
  visitaMesaId: string;
  numeroCorto: number;
  estado: EstadoPedido;
  paraLlevar: boolean;
  nombreClienteLlevar: string | null;
  motivoCancelacion: string | null;
  fechaCreacion: string;
  fechaListo: string | null;
  fechaEntregado: string | null;
  items: ItemPedido[];
}

export interface Visita {
  id: string;
  mesaId: string | null;
  estado: 'abierta' | 'cerrada';
  tipo: 'mesa' | 'llevar' | 'delivery';
  paraLlevar: boolean;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  direccionDelivery: string | null;
  costoEnvio: string | null;
  fechaApertura: string;
  fechaCierre: string | null;
  /** Mesa de la visita (null en para llevar y delivery). */
  mesa: { numero: number; etiqueta: string; zona: string | null } | null;
  abiertaPor: { id: string; nombre: string } | null;
  pedidos: Pedido[];
  total: string;
}

