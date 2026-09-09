import type { AlegraClient } from "../client.js";
import { collectAll, paginate, type PaginateOptions } from "../pagination.js";
import type { Factura, ParametrosFacturas } from "../types.js";

/**
 * Recurso de facturas de venta.
 *
 * @example
 * const facturas = new Facturas(alegra);
 * for await (const pagina of facturas.paginar({ date_afterOrNow: "2026-01-01" })) {
 *   // procesar cada página sin cargar todo en memoria
 * }
 */
export class Facturas {
  constructor(private readonly client: AlegraClient) {}

  /** Lista una sola página de facturas. */
  listar(params: ParametrosFacturas = {}): Promise<Factura[]> {
    return this.client.request<Factura[]>("invoices", { query: { ...params } });
  }

  /** Obtiene una factura por su id. */
  obtener(id: string): Promise<Factura> {
    return this.client.request<Factura>(`invoices/${encodeURIComponent(id)}`);
  }

  /** Recorre todas las facturas página por página. */
  paginar(params: ParametrosFacturas = {}): AsyncGenerator<Factura[], void, unknown> {
    const { start, limit, ...query } = params;
    return paginate<Factura>(this.client, "invoices", {
      start,
      limit,
      query: query as PaginateOptions["query"],
    });
  }

  /**
   * Descarga todas las facturas que cumplan el filtro.
   *
   * Nota: para rangos de fechas muy amplios conviene usar {@link paginar} y procesar
   * por página, o acotar con `date_afterOrNow` / `date_beforeOrNow`.
   */
  listarTodas(params: ParametrosFacturas = {}): Promise<Factura[]> {
    const { start, limit, ...query } = params;
    return collectAll<Factura>(this.client, "invoices", {
      start,
      limit,
      query: query as PaginateOptions["query"],
    });
  }
}
