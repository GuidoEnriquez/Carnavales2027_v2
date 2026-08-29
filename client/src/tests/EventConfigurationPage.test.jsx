import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EventConfigurationPage } from "../pages/EventConfigurationPage.jsx";

describe("EventConfigurationPage", () => {
  afterEach(cleanup);
  it("usa selector de categoría y deja el rubro sin selector directo de especialidad", () => {
    render(<EventConfigurationPage event={{ id: "event-1", status: "CONFIGURING" }} categories={[{ id: "cat-1", name: "Primera" }]} />);
    expect(screen.getByLabelText("Categoría de comparsa").tagName).toBe("SELECT");
    expect(screen.getByRole("heading", { name: "Rubros e ítems" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Especialidad del rubro")).not.toBeInTheDocument();
  });

  it("deja la configuración en solo lectura cuando el evento está OPEN", () => {
    render(<EventConfigurationPage event={{ id: "event-1", status: "OPEN" }} categories={[]} />);
    expect(screen.getByLabelText("Nombre de categoría")).toBeDisabled();
  });
});
