/**
 * Ejemplo: listar y paginar contactos.
 *
 * Ejecuta con credenciales de PRUEBA en variables de entorno:
 *   ALEGRA_EMAIL=demo@ejemplo.com ALEGRA_TOKEN=token_de_prueba npx tsx examples/listar-contactos.ts
 *
 * Los valores de ejemplo son ficticios. Nunca escribas tu token real en el código.
 */
import { Alegra } from "../src/index.js";

const email = process.env.ALEGRA_EMAIL ?? "demo@ejemplo.com";
const token = process.env.ALEGRA_TOKEN ?? "TOKEN_DE_PRUEBA";

async function main(): Promise<void> {
  const alegra = new Alegra({
    email,
    token,
    // Espaciado preventivo entre solicitudes y reintentos ante rate limit.
    minRequestIntervalMs: 120,
    maxRetries: 3,
  });

  // Una sola página (máximo 30 por la API).
  const primeraPagina = await alegra.contactos.listar({ type: "client", limit: 30 });
  console.log(`Primera página: ${primeraPagina.length} contactos`);

  // Recorrer todo sin cargar todo en memoria de golpe.
  let total = 0;
  for await (const pagina of alegra.contactos.paginar({ type: "client" })) {
    total += pagina.length;
  }
  console.log(`Total de contactos recorridos: ${total}`);
}

main().catch((err) => {
  console.error("Error al listar contactos:", err);
  process.exit(1);
});
