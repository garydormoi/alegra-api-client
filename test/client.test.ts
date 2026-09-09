import { describe, it, expect, vi } from "vitest";
import { AlegraClient } from "../src/client.js";
import { AlegraApiError, AlegraRateLimitError } from "../src/errors.js";

const creds = { email: "demo@ejemplo.com", token: "TOKEN_DE_PRUEBA" };

describe("AlegraClient", () => {
  it("envía autenticación Basic y Accept JSON", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toMatch(/^Basic /);
      expect(headers.get("Accept")).toBe("application/json");
      return new Response(JSON.stringify([{ id: "1" }]), { status: 200 });
    });
    const client = new AlegraClient({ ...creds, fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await client.request<{ id: string }[]>("contacts");
    expect(res[0]?.id).toBe("1");
  });

  it("construye la query omitiendo undefined", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const u = new URL(url);
      expect(u.searchParams.get("limit")).toBe("30");
      expect(u.searchParams.has("start")).toBe(false);
      return new Response("[]", { status: 200 });
    });
    const client = new AlegraClient({ ...creds, fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.request("invoices", { query: { limit: 30, start: undefined } });
  });

  it("reintenta ante 429 y respeta Retry-After", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("rate limited", { status: 429, headers: { "Retry-After": "0" } });
      }
      return new Response("[]", { status: 200 });
    });
    const client = new AlegraClient({
      ...creds,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryBaseMs: 1,
    });
    await client.request("items");
    expect(calls).toBe(2);
  });

  it("ante 429 sin Retry-After, usa X-Rate-Limit-Reset para esperar", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "X-Rate-Limit-Reset": "0", "X-Rate-Limit-Limit": "150" },
        });
      }
      return new Response("[]", { status: 200 });
    });
    const client = new AlegraClient({
      ...creds,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.request("items");
    expect(calls).toBe(2);
  });

  it("lanza AlegraRateLimitError al agotar reintentos en 429", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("rate", { status: 429, headers: { "Retry-After": "0" } })
    );
    const client = new AlegraClient({
      ...creds,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxRetries: 1,
      retryBaseMs: 1,
    });
    await expect(client.request("items")).rejects.toBeInstanceOf(AlegraRateLimitError);
  });

  it("lanza AlegraApiError ante 4xx no reintentable", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: "no encontrado" }), { status: 404 })
    );
    const client = new AlegraClient({ ...creds, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.request("contacts/999")).rejects.toBeInstanceOf(AlegraApiError);
  });
});
