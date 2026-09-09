import type { AlegraClient, RequestOptions } from "./client.js";

/** Tamaño de página máximo admitido por la API de Alegra. */
export const MAX_LIMIT = 30;

/** Opciones para recorrer páginas de un recurso listable. */
export interface PaginateOptions {
  /** Tamaño de página (1..30). Por defecto 30. */
  limit?: number;
  /** Offset inicial. Por defecto 0. */
  start?: number;
  /** Query adicional a repetir en cada página (filtros, orden, etc.). */
  query?: RequestOptions["query"];
  /**
   * Tope de páginas a recorrer (salvaguarda ante bucles). Por defecto sin tope.
   * Útil para no agotar cuota si un filtro trae demasiados resultados.
   */
  maxPages?: number;
}

/**
 * Itera página por página un endpoint de lista de Alegra (paginación por `start`/`limit`).
 *
 * La API devuelve arreglos; la paginación termina cuando una página trae menos
 * elementos que `limit`. Se usa un generador asíncrono para no cargar todo en memoria.
 *
 * @typeParam T - Tipo de cada elemento.
 * @example
 * for await (const pagina of paginate<Factura>(client, "invoices", { limit: 30 })) {
 *   procesar(pagina);
 * }
 */
export async function* paginate<T>(
  client: AlegraClient,
  endpoint: string,
  options: PaginateOptions = {}
): AsyncGenerator<T[], void, unknown> {
  const limit = Math.min(Math.max(options.limit ?? MAX_LIMIT, 1), MAX_LIMIT);
  let start = options.start ?? 0;
  let pages = 0;

  for (;;) {
    if (options.maxPages !== undefined && pages >= options.maxPages) return;

    const page = await client.request<T[]>(endpoint, {
      query: { ...options.query, start, limit },
    });

    const items = Array.isArray(page) ? page : [];
    if (items.length === 0) return;

    yield items;
    pages += 1;

    if (items.length < limit) return;
    start += limit;
  }
}

/**
 * Recorre todas las páginas y devuelve el arreglo completo.
 *
 * Cómodo para conjuntos moderados. Para volúmenes grandes prefiere {@link paginate}
 * y procesa página por página.
 */
export async function collectAll<T>(
  client: AlegraClient,
  endpoint: string,
  options: PaginateOptions = {}
): Promise<T[]> {
  const out: T[] = [];
  for await (const page of paginate<T>(client, endpoint, options)) {
    out.push(...page);
  }
  return out;
}
