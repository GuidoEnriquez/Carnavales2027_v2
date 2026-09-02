import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown.js";

function CountdownHarness({ seconds = 5, onComplete }) {
  const hook = useCountdown(seconds, { onComplete });
  const startRef = useRef(hook.start);
  const cancelRef = useRef(hook.cancel);
  startRef.current = hook.start;
  cancelRef.current = hook.cancel;

  return (
    <div>
      <output data-testid="value">{hook.value}</output>
      <output data-testid="running">{String(hook.isRunning)}</output>
      <button type="button" onClick={() => startRef.current()}>start</button>
      <button type="button" onClick={() => cancelRef.current()}>cancel</button>
    </div>
  );
}

describe("useCountdown", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("arranca mostrando el valor inicial y no está corriendo", () => {
    const { getByTestId } = render(<CountdownHarness seconds={5} />);
    expect(getByTestId("value")).toHaveTextContent("5");
    expect(getByTestId("running")).toHaveTextContent("false");
  });

  it("inicia en seconds y decrementa una vez por segundo", () => {
    vi.useFakeTimers();
    const { getByRole, getByTestId } = render(<CountdownHarness seconds={5} />);

    act(() => getByRole("button", { name: "start" }).click());
    expect(getByTestId("value")).toHaveTextContent("5");
    expect(getByTestId("running")).toHaveTextContent("true");

    act(() => vi.advanceTimersByTime(1000));
    expect(getByTestId("value")).toHaveTextContent("4");
    act(() => vi.advanceTimersByTime(3000));
    expect(getByTestId("value")).toHaveTextContent("1");
  });

  it("llega a cero, detiene el contador e invoca onComplete", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { getByRole, getByTestId } = render(
      <CountdownHarness seconds={3} onComplete={onComplete} />,
    );

    act(() => getByRole("button", { name: "start" }).click());
    act(() => vi.advanceTimersByTime(3000));

    expect(getByTestId("value")).toHaveTextContent("0");
    expect(getByTestId("running")).toHaveTextContent("false");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("cancela el contador y no completa después de cancelar", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { getByRole, getByTestId } = render(
      <CountdownHarness seconds={3} onComplete={onComplete} />,
    );

    act(() => getByRole("button", { name: "start" }).click());
    act(() => vi.advanceTimersByTime(1000));
    act(() => getByRole("button", { name: "cancel" }).click());
    act(() => vi.advanceTimersByTime(5000));

    expect(getByTestId("running")).toHaveTextContent("false");
    expect(getByTestId("value")).toHaveTextContent("3");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
