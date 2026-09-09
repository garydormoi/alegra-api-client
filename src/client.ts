import { AlegraApiError, AlegraRateLimitError } from "./errors.js";

/** Opciones de construcción del cliente. */
export interface AlegraClientOptions {
  /** Correo de la cuenta de Alegra (usuario en la autenticación Basic). */
  email: string;
  /** Token de la API de Alegra. */
  token: string;
  /** URL base de la API. Por defecto: https://api.alegra.com/api/v1 */
  baseUrl?: string;
  /**
   * Milisegundos mínimos entre solicitudes (throttle preventivo del lado cliente).
   * Útil para no acercarse al límite de la API. Por defecto: 0 (sin throttle).
   */
  minRequestIntervalMs?: number;
  /** Número máximo de reintentos ante 429 y errores 5xx. Por defecto: 3. */
  maxRetries?: number;
  /** Backoff base (ms) para el retroceso exponencial. Por defecto: 500. */
  retryBaseMs?: number;
  /** Tiempo máximo por solicitud (ms) antes de abortar. Por defecto: 30000. */
  timeoutMs?: number;
  /** Implementación de fetch a usar (inyectable para pruebas). Por defecto: globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** Cadena User-Agent enviada en cada solicitud. */
  userAgent?: string;
}

/** Opciones por solicitud individual. */
export interface RequestOptions {
  method?: string;
  /** Parámetros de query. Los `undefined` se omiten. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Cuerpo a serializar como JSON (para POST/PUT). */
  body?: unknown;
  /** Señal externa de cancelación. */
  signal?: AbortSignal;
}

const DEFAULT_BASE_URL = "https://api.alegra.com/api/v1";

/** Codifica `usuario:token` en base64, de forma portable (Node, Deno, edge). */
function toBase64(input: string): string {
  if (typeof btoa === "function") return btoa(input);
  // eslint-disable-next-line no-undef
  return Buffer.from(input, "utf-8").toString("base64");
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Cliente HTTP para la API de Alegra.
 *
 * Responsabilidades:
 *  - Autenticación HTTP Basic (`email:token`).
 *  - Serialización de query y cuerpo JSON.
 *  - Manejo de rate limit (HTTP 429) respetando `Retry-After`.
 *  - Reintentos con retroceso exponencial ante 429 y 5xx.
 *  - Throttle preventivo opcional entre solicitudes.
 *  - Timeout por solicitud.
 *
 * @example
 * const client = new AlegraClient({ email: "demo@ejemplo.com", token: "TU_TOKEN" });
 * const contactos = await client.request<Contacto[]>("contacts", { query: { limit: 30 } });
 */
export class AlegraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly minRequestIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;
  private lastRequestAt = 0;

  constructor(options: AlegraClientOptions) {
    if (!options.email || !options.token) {
      throw new Error("AlegraClient requiere `email` y `token`.");
    }
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.authHeader = `Basic ${toBase64(`${options.email}:${options.token}`)}`;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 0;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    const injected = options.fetchImpl ?? globalThis.fetch;
    if (typeof injected !== "function") {
      throw new Error(
        "No se encontró `fetch`. Usa Node >=18, o pasa `fetchImpl` en las opciones."
      );
    }
    this.fetchImpl = injected;
    this.userAgent = options.userAgent ?? "alegra-api-client";
  }

  /** Construye la URL completa a partir del endpoint relativo y la query. */
  private buildUrl(endpoint: string, query?: RequestOptions["query"]): string {
    const path = endpoint.replace(/^\/+/, "");
    const url = new URL(`${this.baseUrl}/${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  /** Lee `Retry-After` (segundos o fecha HTTP) y lo convierte a milisegundos. */
  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;
    const asSeconds = Number(header);
    if (!Number.isNaN(asSeconds)) return Math.max(0, asSeconds * 1000);
    const asDate = Date.parse(header);
    if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
    return undefined;
  }

  /**
   * Lee `X-Rate-Limit-Reset` (segundos que faltan para reiniciar la ventana) y lo
   * convierte a milisegundos. Alegra devuelve este header en cada respuesta y NO
   * envía `Retry-After`, por lo que es la señal de espera fiable ante un 429.
   * Ref.: https://developer.alegra.com/reference/límite-de-request
   */
  private parseResetSeconds(header: string | null): number | undefined {
    if (!header) return undefined;
    const asSeconds = Number(header);
    if (Number.isNaN(asSeconds)) return undefined;
    return Math.max(0, asSeconds * 1000);
  }

  /**
   * Realiza una solicitud a la API y devuelve el JSON tipado.
   *
   * @typeParam T - Forma esperada de la respuesta.
   * @throws {AlegraRateLimitError} si se agotan los reintentos ante 429.
   * @throws {AlegraApiError} ante cualquier otra respuesta no 2xx.
   */
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options.query);
    const method = options.method ?? "GET";

    let attempt = 0;
    // Reintentos: 429 y 5xx. 4xx (salvo 429) no se reintentan.
    for (;;) {
      await this.throttle();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      if (options.signal) {
        options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            Accept: "application/json",
            Authorization: this.authHeader,
            "User-Agent": this.userAgent,
            ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeout);
        // Errores de red / abort: reintentar con backoff si quedan intentos.
        if (attempt < this.maxRetries) {
          await sleep(this.backoffMs(attempt));
          attempt += 1;
          continue;
        }
        throw new AlegraApiError(
          `Fallo de red al llamar a Alegra (${endpoint}): ${(err as Error).message}`,
          { status: 0, body: null, endpoint }
        );
      } finally {
        clearTimeout(timeout);
      }

      if (response.ok) {
        return (await this.parseBody(response)) as T;
      }

      const body = await this.parseBody(response);

      if (response.status === 429) {
        // Alegra: 150 req/min por usuario. No envía Retry-After; usa X-Rate-Limit-Reset
        // (segundos que faltan para reiniciar la ventana de 1 minuto).
        const retryAfterMs = this.parseRetryAfter(response.headers.get("Retry-After"));
        const resetMs = this.parseResetSeconds(response.headers.get("X-Rate-Limit-Reset"));
        const waitMs = retryAfterMs ?? resetMs;
        if (attempt < this.maxRetries) {
          await sleep(waitMs ?? this.backoffMs(attempt));
          attempt += 1;
          continue;
        }
        throw new AlegraRateLimitError(
          `Rate limit de Alegra (429) tras ${this.maxRetries} reintentos en ${endpoint}.`,
          {
            status: 429,
            body,
            endpoint,
            retryAfterSeconds: waitMs !== undefined ? waitMs / 1000 : undefined,
          }
        );
      }

      if (response.status >= 500 && attempt < this.maxRetries) {
        await sleep(this.backoffMs(attempt));
        attempt += 1;
        continue;
      }

      throw new AlegraApiError(
        `Alegra respondió ${response.status} en ${endpoint}.`,
        { status: response.status, body, endpoint }
      );
    }
  }

  /** Espera lo necesario para respetar `minRequestIntervalMs`. */
  private async throttle(): Promise<void> {
    if (this.minRequestIntervalMs <= 0) return;
    const elapsed = Date.now() - this.lastRequestAt;
    const wait = this.minRequestIntervalMs - elapsed;
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  /** Backoff exponencial con jitter. */
  private backoffMs(attempt: number): number {
    const base = this.retryBaseMs * 2 ** attempt;
    const jitter = Math.random() * this.retryBaseMs;
    return base + jitter;
  }

  /** Intenta parsear JSON; si no es JSON, devuelve el texto. */
  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
