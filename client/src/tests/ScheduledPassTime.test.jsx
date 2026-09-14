import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScheduledPassTime } from "../components/ScheduledPassTime.jsx";

describe("horario programado", () => {
  it("muestra la fecha siguiente a medianoche en la zona recibida de API", () => {
    render(<ScheduledPassTime scheduledAt="2027-02-07T04:00:00.000Z" scheduledTimezone="America/Argentina/Cordoba" />);
    const time = screen.getByText(/Programada:/);
    expect(time).toHaveTextContent("07/02/2027");
    expect(time).toHaveTextContent("01:00");
    expect(time).toHaveTextContent("GMT-3");
    expect(time).toHaveAttribute("datetime", "2027-02-07T04:00:00.000Z");
  });
  it("no inventa horarios para programación histórica", () => {
    const { container } = render(<ScheduledPassTime scheduledAt={null} scheduledTimezone={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("un dato inválido no rompe la lista de comparsas", () => {
    render(<ScheduledPassTime scheduledAt="invalid" scheduledTimezone="invalid" />);
    expect(screen.getByText("Horario no disponible")).toBeInTheDocument();
  });
});
