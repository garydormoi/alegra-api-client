/**
 * alegra-api-client
 *
 * Cliente ligero y tipado para la API de Alegra.
 * Punto de entrada: exporta el cliente HTTP, los recursos, los helpers de
 * paginación, los tipos y los errores.
 */

export { AlegraClient } from "./client.js";
export type { AlegraClientOptions, RequestOptions } from "./client.js";

export { paginate, collectAll, MAX_LIMIT } from "./pagination.js";
export type { PaginateOptions } from "./pagination.js";

export { Contactos } from "./resources/contacts.js";
export { Items } from "./resources/items.js";
export { Facturas } from "./resources/invoices.js";

export { AlegraApiError, AlegraRateLimitError } from "./errors.js";

export type * from "./types.js";

import { AlegraClient, type AlegraClientOptions } from "./client.js";
import { Contactos } from "./resources/contacts.js";
import { Items } from "./resources/items.js";
import { Facturas } from "./resources/invoices.js";

/**
 * Fachada de conveniencia: crea el cliente y expone los recursos ya cableados.
 *
 * @example
 * const alegra = new Alegra({ email: "demo@ejemplo.com", token: "TU_TOKEN" });
 * const clientes = await alegra.contactos.listarTodos({ type: "client" });
 * const facturas = await alegra.facturas.listar({ limit: 30 });
 */
export class Alegra {
  /** Cliente HTTP subyacente (por si necesitas endpoints no cubiertos por los recursos). */
  readonly client: AlegraClient;
  readonly contactos: Contactos;
  readonly items: Items;
  readonly facturas: Facturas;

  constructor(options: AlegraClientOptions) {
    this.client = new AlegraClient(options);
    this.contactos = new Contactos(this.client);
    this.items = new Items(this.client);
    this.facturas = new Facturas(this.client);
  }
}
