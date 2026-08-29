import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequireAdmin } from "../auth/RequireAdmin.jsx";

const renderGuard = (session) => render(<RequireAdmin session={session}><p>Admin content</p></RequireAdmin>);

describe("RequireAdmin", () => {
  it("muestra login para anónimo y acceso denegado para no ADMIN", () => {
    const { rerender } = renderGuard({ status: "anonymous" });
    expect(screen.getByText("Iniciá sesión para continuar")).toBeInTheDocument();
    rerender(<RequireAdmin session={{ status: "authenticated", roles: [] }}><p>Admin content</p></RequireAdmin>);
    expect(screen.getByText("No tenés permisos de administración")).toBeInTheDocument();
  });

  it("muestra contenido a ADMIN autenticado", () => {
    renderGuard({ status: "authenticated", roles: ["ADMIN"] });
    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });
});
