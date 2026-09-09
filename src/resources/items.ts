import type { AlegraClient } from "../client.js";
import { collectAll, paginate, type PaginateOptions } from "../pagination.js";
import type { Item, ParametrosItems } from "../types.js";

/**
 * Recurso de ítems (productos y servicios).
 *
 * @example
 * const items = new Items(alegra);
 * const todos = await items.listarTodos({ status: "active" });
 */
export class Items {
  constructor(private readonly client: AlegraClient) {}

  /** Lista una sola página de ítems. */
  listar(params: ParametrosItems = {}): Promise<Item[]> {
    return this.client.request<Item[]>("items", { query: { ...params } });
  }

  /** Obtiene un ítem por su id. */
  obtener(id: string): Promise<Item> {
    return this.client.request<Item>(`items/${encodeURIComponent(id)}`);
  }

  /** Recorre todos los ítems página por página. */
  paginar(params: ParametrosItems = {}): AsyncGenerator<Item[], void, unknown> {
    const { start, limit, ...query } = params;
    return paginate<Item>(this.client, "items", {
      start,
      limit,
      query: query as PaginateOptions["query"],
    });
  }

  /** Descarga todos los ítems que cumplan el filtro. */
  listarTodos(params: ParametrosItems = {}): Promise<Item[]> {
    const { start, limit, ...query } = params;
    return collectAll<Item>(this.client, "items", {
      start,
      limit,
      query: query as PaginateOptions["query"],
    });
  }
}
