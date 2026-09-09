/**
 * Ejemplo: paginar facturas por rango de fechas y sumar totales.
 *
 *   ALEGRA_EMAIL=demo@ejemplo.com ALEGRA_TOKEN=token_de_prueba npx tsx examples/paginar-facturas.ts
 *
 * Valores ficticios. Usa siempre variables de entorno para las credenciales.
 */
import { Alegra, type Factura } from "../src/index.js";

const alegra = new Alegra({
  email: process.env.ALEGRA_EMAIL ?? "demo@ejemplo.com",
  token: process.env.ALEGRA_TOKEN ?? "TOKEN_DE_PRUEBA",
  minRequestIntervalMs: 120,
});

async function main(): Promise<void> {
  let total = 0;
  let count = 0;

  for await (const pagina of alegra.facturas.paginar({
    date_afterOrNow: "2026-01-01",
    date_beforeOrNow: "2026-01-31",
    order_field: "date",
    order_direction: "ASC",
  })) {
    for (const factura of pagina as Factura[]) {
      total += factura.total ?? 0;
      count += 1;
    }
  }

  console.log(`Facturas en el rango: ${count}`);
  console.log(`Total facturado: ${total.toFixed(2)}`);
}

main().catch((err) => {
  console.error("Error al paginar facturas:", err);
  process.exit(1);
});
