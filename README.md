# alegra-api-client

[![CI](https://github.com/garydormoi/alegra-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/garydormoi/alegra-api-client/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![npm version](https://img.shields.io/npm/v/alegra-api-client.svg)](https://www.npmjs.com/package/alegra-api-client)

Cliente ligero y **tipado** (TypeScript) para la [API de Alegra](https://developer.alegra.com/).
Cubre lo esencial de la capa de integración: **autenticación**, **paginación** y
**manejo de rate limits** con reintentos, sobre `contactos`, `ítems` y `facturas`.

> Proyecto **no oficial** y sin afiliación con Alegra. Alegra® es marca de sus
> respectivos dueños. Documentación en español porque hay poca disponible.

## Características

- Autenticación HTTP Basic (`correo:token`), portable (Node, Deno, edge).
- Paginación por `start`/`limit` (máx. 30 por página) con generador asíncrono
  para no cargar todo en memoria.
- Manejo de **rate limit (HTTP 429)** respetando `Retry-After`, con reintentos
  y retroceso exponencial con jitter.
- Reintentos también ante errores de red y `5xx`; los `4xx` no se reintentan.
- Throttle preventivo opcional entre solicitudes.
- Timeout por solicitud con `AbortController`.
- Cero dependencias en tiempo de ejecución (usa `fetch` nativo de Node ≥ 18).

## Instalación

```bash
npm install alegra-api-client
```

Requiere Node.js 18 o superior (por `fetch` nativo).

## Autenticación

La API de Alegra usa autenticación **HTTP Basic** con tu **correo** y un **token**
de API (no tu contraseña). El token se genera en Alegra, en la sección de
integraciones / API de tu cuenta.

Guarda las credenciales en variables de entorno, nunca en el código:

```bash
cp .env.example .env
# edita .env con tus valores reales
```

## Uso rápido

```ts
import { Alegra } from "alegra-api-client";

const alegra = new Alegra({
  email: process.env.ALEGRA_EMAIL!,
  token: process.env.ALEGRA_TOKEN!,
});

// Una página (máx. 30)
const clientes = await alegra.contactos.listar({ type: "client", limit: 30 });

// Descargar todo (paginando internamente)
const todos = await alegra.contactos.listarTodos({ type: "client" });

// Un recurso por id
const factura = await alegra.facturas.obtener("123");
```

## Paginación

La API devuelve como máximo 30 registros por página. Usa el generador para
procesar página por página sin agotar memoria:

```ts
for await (const pagina of alegra.facturas.paginar({
  date_afterOrNow: "2026-01-01",
  date_beforeOrNow: "2026-01-31",
})) {
  for (const factura of pagina) {
    // procesar
  }
}
```

O junta todo de una vez con `listarTodas` / `listarTodos` / `collectAll`.

## Manejo de rate limits y reintentos

La API de Alegra permite **150 solicitudes por minuto por usuario** (≈ 2.5/seg).
Al excederlo responde **HTTP 429** e informa el estado en cabeceras
`X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining` y `X-Rate-Limit-Reset` (segundos
que faltan para reiniciar la ventana). Alegra **no** envía `Retry-After`.

El cliente reintenta automáticamente ante `429` y `5xx`. Ante `429` espera lo que
indique `X-Rate-Limit-Reset` (o `Retry-After` si estuviera presente) y, si no hay
ninguno, aplica retroceso exponencial con jitter.

```ts
const alegra = new Alegra({
  email,
  token,
  minRequestIntervalMs: 400, // ≈150/min: espaciado preventivo para no llegar al límite
  maxRetries: 3,             // reintentos ante 429 / 5xx
  retryBaseMs: 500,          // backoff base
  timeoutMs: 30000,          // timeout por solicitud
});
```

Si se agotan los reintentos ante `429`, se lanza `AlegraRateLimitError` (con
`retryAfterSeconds` cuando la respuesta lo permite calcular).

## Manejo de errores

```ts
import { AlegraApiError, AlegraRateLimitError } from "alegra-api-client";

try {
  await alegra.facturas.obtener("no-existe");
} catch (err) {
  if (err instanceof AlegraRateLimitError) {
    // esperar y reintentar más tarde
  } else if (err instanceof AlegraApiError) {
    console.error(err.status, err.endpoint, err.body);
  }
}
```

## Recursos disponibles

| Recurso     | Métodos                                             |
| ----------- | --------------------------------------------------- |
| `contactos` | `listar`, `obtener`, `paginar`, `listarTodos`       |
| `items`     | `listar`, `obtener`, `paginar`, `listarTodos`       |
| `facturas`  | `listar`, `obtener`, `paginar`, `listarTodas`       |

Para endpoints no cubiertos por los recursos, usa el cliente directo:

```ts
const data = await alegra.client.request<MiTipo>("otro-endpoint", {
  query: { limit: 30 },
});
```

## Referencia rápida de la API de Alegra

Resumen de los hechos de la API en que se basa este cliente (fuente:
documentación oficial de Alegra para desarrolladores).

| Tema | Detalle |
| --- | --- |
| URL base | `https://api.alegra.com/api/v1` |
| Autenticación | HTTP **Basic**: `Authorization: Basic base64(correo:token)` |
| Token | Alegra → Configuración → *API - Integraciones con otros sistemas* |
| Error de autenticación | HTTP **401** |
| Límite de uso | **150 solicitudes/minuto por usuario** |
| Límite excedido | HTTP **429** + cabeceras `X-Rate-Limit-Limit` / `X-Rate-Limit-Remaining` / `X-Rate-Limit-Reset` |
| Paginación | Parámetros `start` (offset) y `limit`; **máximo 30** por página |

Referencias:
[Autenticación](https://developer.alegra.com/reference/autenticaci%C3%B3n) ·
[Límite de request](https://developer.alegra.com/reference/l%C3%ADmite-de-request) ·
[Documentación general](https://developer.alegra.com/docs)

> Este resumen existe porque la documentación en español de la API de Alegra es
> escasa. Si algo cambia en la API oficial, esta tabla debe actualizarse.

## Desarrollo

```bash
npm install
npm run build      # compila a dist/
npm test           # pruebas con vitest (fetch simulado, datos ficticios)
npm run lint:types # verificación de tipos sin emitir
```

Los ejemplos en `examples/` usan datos **ficticios** y credenciales por variables
de entorno.

## Contribuir

Los issues y PRs son bienvenidos. Al reportar un problema, incluye el endpoint,
los parámetros usados (sin credenciales) y el comportamiento esperado.

## Licencia

[MIT](./LICENSE)

## Changelog
- 0.1.0 - primera version publica
