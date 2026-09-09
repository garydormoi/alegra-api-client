/**
 * Errores del cliente de Alegra.
 *
 * Todas las respuestas no exitosas de la API se envuelven en {@link AlegraApiError}.
 * Cuando el servidor responde 429 (demasiadas solicitudes) se usa la subclase
 * {@link AlegraRateLimitError}, que expone el tiempo de espera sugerido.
 */

/** Error genérico de la API de Alegra (respuesta HTTP no 2xx). */
export class AlegraApiError extends Error {
  /** Código de estado HTTP devuelto por la API. */
  readonly status: number;
  /** Cuerpo de la respuesta, ya parseado si era JSON; si no, el texto crudo. */
  readonly body: unknown;
  /** Endpoint (ruta relativa) que originó el error. */
  readonly endpoint: string;

  constructor(message: string, params: { status: number; body: unknown; endpoint: string }) {
    super(message);
    this.name = "AlegraApiError";
    this.status = params.status;
    this.body = params.body;
    this.endpoint = params.endpoint;
  }
}

/** Error específico de rate limit (HTTP 429). */
export class AlegraRateLimitError extends AlegraApiError {
  /** Segundos sugeridos de espera antes de reintentar (cabecera Retry-After), si vino. */
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    params: { status: number; body: unknown; endpoint: string; retryAfterSeconds?: number }
  ) {
    super(message, params);
    this.name = "AlegraRateLimitError";
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}
