import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequireRole } from "../auth/RequireRole.jsx";

describe("RequireRole", () => {
  afterEach(cleanup);

  it("solo muestra contenido con el rol requerido", () => {
    const { rerender } = render(<RequireRole session={{ status: "authenticated", roles: [] }} role="JUDGE"><p>Panel</p></RequireRole>);
    expect(screen.getByText(/No tenés permisos/)).toBeInTheDocument();
    rerender(<RequireRole session={{ status: "authenticated", roles: ["JUDGE"] }} role="JUDGE"><p>Panel</p></RequireRole>);
    expect(screen.getByText("Panel")).toBeInTheDocument();
  });
});
