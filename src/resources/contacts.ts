import type { AlegraClient } from "../client.js";
import { collectAll, paginate, type PaginateOptions } from "../pagination.js";
import type { Contacto, ParametrosContactos } from "../types.js";

/**
 * Recurso de contactos (clientes y proveedores).
 *
 * @example
 * const alegra = new AlegraClient({ email, token });
 * const contactos = new Contactos(alegra);
 * const primeros = await contactos.listar({ type: "client", limit: 30 });
 */
export class Contactos {
  constructor(private readonly client: AlegraClient) {}

  /** Lista una sola página de contactos según los parámetros dados. */
  listar(params: ParametrosContactos = {}): Promise<Contacto[]> {
    return this.client.request<Contacto[]>("contacts", { query: { ...params } });
  }

  /** Obtiene un contacto por su id. */
  obtener(id: string): Promise<Contacto> {
    return this.client.request<Contacto>(`contacts/${encodeURIComponent(id)}`);
  }

  /** Recorre todos los contactos página por página (generador asíncrono). */
  paginar(params: ParametrosContactos = {}): AsyncGenerator<Contacto[], void, unknown> {
    const { start, limit, ...query } = params;
    const opts: PaginateOptions = { start, limit, query: query as PaginateOptions["query"] };
    return paginate<Contacto>(this.client, "contacts", opts);
  }

  /** Descarga todos los contactos que cumplan el filtro. */
  listarTodos(params: ParametrosContactos = {}): Promise<Contacto[]> {
    const { start, limit, ...query } = params;
    return collectAll<Contacto>(this.client, "contacts", {
      start,
      limit,
      query: query as PaginateOptions["query"],
    });
  }
}
