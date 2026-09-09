/**
 * Tipos de los objetos de la API de Alegra usados por este cliente.
 *
 * Los tipos reflejan los campos que la API devuelve con más frecuencia. No pretenden
 * ser exhaustivos: la API puede incluir campos adicionales según el plan y la
 * configuración de cada cuenta, por eso las interfaces admiten propiedades extra.
 */

/** Estado activo/inactivo común a varios recursos. */
export type EstadoRecurso = "active" | "inactive";

/** Moneda tal como la expone Alegra. */
export interface Moneda {
  code: string;
  symbol?: string;
}

/** Precio de un ítem dentro de una lista de precios. */
export interface PrecioItem {
  idPriceList?: string;
  name?: string;
  type?: string;
  price: number;
  currency?: Moneda;
  main?: boolean;
  edited?: boolean;
}

/** Contacto (cliente o proveedor). */
export interface Contacto {
  id: string;
  name: string;
  identification?: string | null;
  email?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  mobile?: string | null;
  status?: EstadoRecurso;
  type?: string[];
  observations?: string | null;
  address?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  /** Campos adicionales devueltos por la API. */
  [extra: string]: unknown;
}

/** Ítem / producto o servicio. */
export interface Item {
  id: string;
  name: string;
  description?: string | null;
  reference?: string | null;
  status?: EstadoRecurso;
  price?: PrecioItem[];
  type?: string;
  [extra: string]: unknown;
}

/** Numeración/plantilla de una factura. */
export interface NumeracionFactura {
  id?: string;
  prefix?: string;
  number?: string;
  fullNumber?: string;
  documentType?: string;
  isElectronic?: boolean;
}

/** Referencia mínima al cliente dentro de una factura. */
export interface ClienteFactura {
  id: string;
  name?: string;
  identification?: string;
}

/** Factura de venta. */
export interface Factura {
  id: string;
  date: string;
  dueDate?: string;
  status?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  totalPaid?: number;
  balance?: number;
  numberTemplate?: NumeracionFactura;
  client?: ClienteFactura;
  [extra: string]: unknown;
}

/** Parámetros de listado con paginación (comunes a los recursos). */
export interface ParametrosListado {
  /** Desplazamiento (offset). Por defecto 0. */
  start?: number;
  /** Tamaño de página. Máximo permitido por Alegra: 30. */
  limit?: number;
  /** Campo por el cual ordenar. */
  order_field?: string;
  /** Dirección del orden. */
  order_direction?: "ASC" | "DESC";
}

/** Parámetros específicos para listar contactos. */
export interface ParametrosContactos extends ParametrosListado {
  type?: "client" | "provider";
  identification?: string;
  query?: string;
}

/** Parámetros específicos para listar facturas. */
export interface ParametrosFacturas extends ParametrosListado {
  /** Fecha exacta de creación (YYYY-MM-DD). */
  date?: string;
  /** Creadas en o después de (YYYY-MM-DD). */
  date_afterOrNow?: string;
  /** Creadas en o antes de (YYYY-MM-DD). */
  date_beforeOrNow?: string;
  /** Estado: open, closed, draft, void (admite lista separada por comas). */
  status?: string;
  client_id?: string;
}

/** Parámetros específicos para listar ítems. */
export interface ParametrosItems extends ParametrosListado {
  name?: string;
  reference?: string;
  query?: string;
  status?: EstadoRecurso;
}
