import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "../api/http.js";

describe("apiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("conserva el código y los detalles de errores estructurados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "EVENT_CONFIGURATION_INCOMPLETE", details: { missing: ["ACTIVE_RUBRIC"] } },
    }), { status: 409, headers: { "content-type": "application/json" } })));

    await expect(apiRequest("/api/v1/events/e1/open")).rejects.toEqual(expect.objectContaining({
      name: "ApiError",
      status: 409,
      code: "EVENT_CONFIGURATION_INCOMPLETE",
      details: { missing: ["ACTIVE_RUBRIC"] },
    }));
    expect(ApiError).toBeTypeOf("function");
  });

  it("normaliza fallos de red y conserva headers personalizados", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("/health", { headers: { "x-request-id": "r1" } })).rejects.toEqual(expect.objectContaining({
      code: "NETWORK_ERROR",
      status: 0,
    }));
    expect(fetchMock.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      "content-type": "application/json",
      "x-request-id": "r1",
    }));
  });
});
