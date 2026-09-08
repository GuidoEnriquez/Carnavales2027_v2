import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomePage } from "../pages/HomePage.jsx";

afterEach(() => cleanup());

describe("HomePage (Spec 023)", () => {
  it("aplica data-layer='brand' en el contenedor principal", () => {
    const { container } = render(<HomePage session={{ roles: ["ADMIN"] }} />);
    const main = container.querySelector("main");
    expect(main).toHaveAttribute("data-layer", "brand");
  });

  it("ofrece el área de escrutinio al SCRUTINEER", () => {
    render(<HomePage session={{ roles: ["SCRUTINEER"] }} />);

    expect(screen.getByRole("link", { name: "Abrir escrutinio" })).toHaveAttribute(
      "href",
      "#/admin/results",
    );
  });

  it("ofrece supervisión al VEEDOR", () => {
    render(<HomePage session={{ roles: ["VEEDOR"] }} />);
    expect(screen.getByRole("link", { name: "Abrir supervisión" })).toHaveAttribute("href", "#/veedor");
  });

  it("ofrece comisariato y penalizaciones al COMISARIO", () => {
    render(<HomePage session={{ roles: ["COMISARIO"] }} />);
    expect(screen.getByRole("link", { name: "Gestionar penalizaciones" })).toHaveAttribute("href", "#/admin/penalties");
  });

  it("ofrece panel de jurado al JUDGE", () => {
    render(<HomePage session={{ roles: ["JUDGE"] }} />);
    expect(screen.getByRole("link", { name: "Mi panel de jurado" })).toHaveAttribute("href", "#/judge");
  });

  it("ofrece las cuatro áreas administrativas al ADMIN", () => {
    render(<HomePage session={{ roles: ["ADMIN"] }} />);
    expect(screen.getByRole("link", { name: "Administrar eventos" })).toHaveAttribute("href", "#/admin/events");
    expect(screen.getByRole("link", { name: "Administrar personas" })).toHaveAttribute("href", "#/admin/judges");
    expect(screen.getByRole("link", { name: "Ver asignaciones" })).toHaveAttribute("href", "#/admin/assignments");
    expect(screen.getByRole("link", { name: "Controlar votación" })).toHaveAttribute("href", "#/admin/voting");
  });

  it("muestra aviso amigable si el usuario no tiene roles asignados", () => {
    render(<HomePage session={{ roles: [] }} />);
    expect(screen.getByText(/Tu cuenta no tiene un rol operativo activo/)).toBeInTheDocument();
  });
});
