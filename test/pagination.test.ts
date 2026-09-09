import { describe, it, expect, vi } from "vitest";
import { AlegraClient } from "../src/client.js";
import { collectAll, paginate } from "../src/pagination.js";

/**
 * Datos 100% ficticios para las pruebas. No representan clientes ni facturas reales.
 */
function fakeContact(id: number) {
  return { id: String(id), name: `Cliente Ficticio ${id}`, status: "active" as const };
}

/** Construye un fetch simulado que devuelve páginas de tamaño `pageSize`. */
function mockPagedFetch(totalItems: number, pageSize: number) {
  return vi.fn(async (url: string) => {
    const u = new URL(url);
    const start = Number(u.searchParams.get("start") ?? "0");
    const limit = Number(u.searchParams.get("limit") ?? String(pageSize));
    const page = [];
    for (let i = start; i < Math.min(start + limit, totalItems); i++) {
      page.push(fakeContact(i));
    }
    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("paginación", () => {
  it("recorre todas las páginas y se detiene en una página parcial", async () => {
    const fetchImpl = mockPagedFetch(70, 30) as unknown as typeof fetch;
    const client = new AlegraClient({ email: "demo@ejemplo.com", token: "x", fetchImpl });

    const paginas: number[] = [];
    for await (const p of paginate<{ id: string }>(client, "contacts", { limit: 30 })) {
      paginas.push(p.length);
    }
    // 30 + 30 + 10 => se detiene cuando la última página trae menos que el límite.
    expect(paginas).toEqual([30, 30, 10]);
  });

  it("collectAll junta el total correcto", async () => {
    const fetchImpl = mockPagedFetch(45, 30) as unknown as typeof fetch;
    const client = new AlegraClient({ email: "demo@ejemplo.com", token: "x", fetchImpl });

    const todos = await collectAll<{ id: string }>(client, "contacts", { limit: 30 });
    expect(todos).toHaveLength(45);
    expect(todos[0]?.id).toBe("0");
  });

  it("respeta maxPages", async () => {
    const fetchImpl = mockPagedFetch(1000, 30) as unknown as typeof fetch;
    const client = new AlegraClient({ email: "demo@ejemplo.com", token: "x", fetchImpl });

    const todos = await collectAll<{ id: string }>(client, "contacts", { limit: 30, maxPages: 2 });
    expect(todos).toHaveLength(60);
  });
});
