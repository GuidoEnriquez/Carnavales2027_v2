import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCeremonialDraw } from "./useCeremonialDraw.js";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/http.js", () => ({ apiRequest: apiRequestMock }));

function HookHarness({ onReady }) {
  const hook = useCeremonialDraw();
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  readyRef.current(hook);
  return <output data-testid="loading">{String(hook.loading)}</output>;
}

describe("useCeremonialDraw", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("ejecuta el POST y expone el resultado", async () => {
    const result = {
      eventId: "event-1",
      winnerTroupeId: "troupe-a",
      auditEventId: "audit-1",
      method: "CRYPTO_RANDOM_INT",
    };
    apiRequestMock.mockResolvedValue(result);
    let hook;
    render(<HookHarness onReady={(value) => { hook = value; }} />);

    let promise;
    await act(async () => {
      promise = hook.execute({
        eventId: "event-1",
        remainingTroupeIds: ["troupe-a", "troupe-b"],
      });
      await promise;
    });

    expect(await promise).toEqual(result);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/v1/events/event-1/tie-breaker/ceremonial-draw",
      {
        method: "POST",
        body: JSON.stringify({ remainingTroupeIds: ["troupe-a", "troupe-b"] }),
      },
    );
    expect(hook.draw).toEqual(result);
    expect(hook.loading).toBe(false);
    expect(hook.error).toBe(null);
  });

  it("expone el error y vuelve a loading=false si el POST falla", async () => {
    const error = new Error("falló el sorteo");
    apiRequestMock.mockRejectedValue(error);
    let hook;
    render(<HookHarness onReady={(value) => { hook = value; }} />);

    await act(async () => {
      await expect(hook.execute({
        eventId: "event-1",
        remainingTroupeIds: ["a", "b"],
        appliedCriteria: [],
      })).rejects.toBe(error);
    });

    expect(hook.draw).toBe(null);
    expect(hook.error).toBe(error);
    expect(hook.loading).toBe(false);
  });

  it("recupera el resultado ceremonial auditado", async () => {
    const result = { eventId: "event-1", winnerTroupeId: "troupe-a", auditEventId: "audit-1" };
    apiRequestMock.mockResolvedValue(result);
    let hook;
    render(<HookHarness onReady={(value) => { hook = value; }} />);

    await expect(hook.loadRecorded("event-1")).resolves.toEqual(result);
    expect(apiRequestMock).toHaveBeenCalledWith("/api/v1/events/event-1/tie-breaker/ceremonial-draw");
  });
});
