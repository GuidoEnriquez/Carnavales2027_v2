import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EventCard } from "./EventCard.jsx";

describe("EventCard (Spec 026/T07)", () => {
  const event = { id: "event-1", name: "Carnaval 2027", status: "OPEN" };

  it("muestra el nombre y el estado del evento", () => {
    const { unmount } = render(<EventCard event={event} onSelect={() => {}} />);
    expect(screen.getByText("Carnaval 2027")).toBeVisible();
    expect(screen.getByText("Abierta")).toBeVisible();
    unmount();
  });

  it("notifica la selección con click y con teclado", () => {
    const onSelect = vi.fn();
    render(<EventCard event={event} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /Carnaval 2027/i });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(event);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(card, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });
});
