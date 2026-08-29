import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App.jsx";

describe("App", () => {
  it("muestra login como ruta pública inicial", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Carnavales 2027" })).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });
});
