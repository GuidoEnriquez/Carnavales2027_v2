import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CeremonialDrawModal } from "./CeremonialDrawModal.jsx";

const executeMock = vi.hoisted(() => vi.fn());
vi.mock("./useCeremonialDraw.js", () => ({
  useCeremonialDraw: () => ({
    draw: null,
    loading: false,
    error: null,
    execute: executeMock,
  }),
}));

const props = {
  eventId: "event-1",
  remainingTroupeIds: ["troupe-a", "troupe-b"],
  appliedCriteria: ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"],
  tiedTroupeNames: [
    { id: "troupe-a", name: "Comparsa A" },
    { id: "troupe-b", name: "Comparsa B" },
  ],
  onClose: vi.fn(),
  onResolved: vi.fn(),
};

describe("CeremonialDrawModal", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("muestra las comparsas empatadas y enfoca iniciar", () => {
    const { getByRole, getByText } = render(<CeremonialDrawModal {...props} />);
    expect(getByRole("dialog")).toBeVisible();
    expect(getByText("Comparsa A")).toBeVisible();
    expect(getByText("Comparsa B")).toBeVisible();
    expect(document.activeElement).toBe(getByRole("button", { name: /iniciar sorteo/i }));
  });

  it("inicia el countdown 5→0 y ejecuta el sorteo al llegar a cero", async () => {
    vi.useFakeTimers();
    const draw = { eventId: "event-1", winnerTroupeId: "troupe-b", auditEventId: "audit-1" };
    executeMock.mockResolvedValue(draw);
    const { getByRole, getByTestId, getByText } = render(<CeremonialDrawModal {...props} />);

    act(() => getByRole("button", { name: /iniciar sorteo/i }).click());
    expect(getByTestId("countdown-value")).toHaveTextContent("5");
    expect(getByRole("button", { name: /cancelar/i })).toBeVisible();

    act(() => vi.advanceTimersByTime(5000));
    expect(getByTestId("countdown-value")).toHaveTextContent("0");
    await act(async () => {
      await Promise.resolve();
    });

    expect(executeMock).toHaveBeenCalledWith({
      eventId: "event-1",
      remainingTroupeIds: ["troupe-a", "troupe-b"],
      appliedCriteria: ["WON_NOMINATIVE_RUBRICS_COUNT", "BATTERY_RUBRIC_WINNER"],
    });
    expect(getByText(/Comparsa B/)).toBeVisible();
    expect(props.onResolved).toHaveBeenCalledWith(draw);
  });

  it("cancela durante el countdown y devuelve el foco al disparador", () => {
    vi.useFakeTimers();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { getByRole, queryByTestId } = render(
      <CeremonialDrawModal {...props} triggerRef={{ current: trigger }} />,
    );

    act(() => getByRole("button", { name: /iniciar sorteo/i }).click());
    act(() => vi.advanceTimersByTime(1000));
    act(() => getByRole("button", { name: /cancelar/i }).click());

    expect(queryByTestId("countdown-value")).not.toBeInTheDocument();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("cierra con Escape y llama onClose", () => {
    const { getByRole } = render(<CeremonialDrawModal {...props} />);
    act(() => getByRole("dialog").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
