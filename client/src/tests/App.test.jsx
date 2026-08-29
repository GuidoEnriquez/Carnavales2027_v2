import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App.jsx";

describe("App", () => {
  it("muestra login como ruta pública inicial", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Carnavales 2027" })).toBeInTheDocument();
    expect(screen.getByText("Iniciá sesión para acceder al panel administrativo.")).toBeInTheDocument();
  });
});
