import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EventCard } from "./EventCard.jsx";

describe("EventCard (Spec 026/T07)", () => {
  const event = { id: "event-1", name: "Carnaval 2027", status: "OPEN" };

  it("muestra el nombre y el estado del evento", () => {
    const { unmount } = render(<EventCard event={event} onSelect={() => {}} />);
    expect(screen.getByText("Carnaval 2027")).toBeVisible();
    expect(screen.getByText("Competencia abierta")).toBeVisible();
    unmount();
  });

  it("notifica la selección con click y es un botón nativo", () => {
    const onSelect = vi.fn();
    render(<EventCard event={event} onSelect={onSelect} />);
    const card = screen.getByRole("button", { name: /Carnaval 2027/i });
    expect(card.tagName).toBe("BUTTON");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(event);
  });
});
