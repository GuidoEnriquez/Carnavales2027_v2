import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { uxErrorHint, uxFieldLabel, uxStatusLabel } from "./admin-ux-labels.js";
import { EventStatusBanner } from "./EventStatusBanner.jsx";
import { PageHeader } from "./PageHeader.jsx";

describe("Spec 027/A1 — fundaciones admin", () => {
  it("uxStatusLabel traduce sin cambiar el valor interno", () => {
    expect(uxStatusLabel("CONFIGURING")).toBe("En configuración");
    expect(uxStatusLabel("OPEN")).toBe("Competencia abierta");
    expect(uxStatusLabel("CLOSED")).toBe("Evento cerrado");
    expect(uxStatusLabel("WEIRD", "WEIRD")).toBe("WEIRD");
  });

  it("uxFieldLabel y uxErrorHint exponen microcopy humano", () => {
    expect(uxFieldLabel("displayOrder")).toBe("Orden de visualización");
    expect(uxFieldLabel("standbyForAssignmentId")).toBe("Suplente de");
    expect(uxErrorHint("RESOURCE_CONFLICT")).toMatch(/ya está en uso/);
  });

  it("ConfirmDialog confirma y cancela sin window.confirm", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Abrir evento"
        description="Bloqueará la configuración."
        confirmLabel="Abrir evento"
      />,
    );
    expect(screen.getByText("Bloqueará la configuración.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir evento" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("PageHeader muestra estado humano y EventStatusBanner explica OPEN", () => {
    render(<PageHeader eyebrow="Evento" title="Goya 2027" status="OPEN" />);
    expect(screen.getByText("Competencia abierta")).toBeInTheDocument();
    render(<EventStatusBanner status="OPEN" />);
    expect(screen.getByText(/ya no puede modificarse/)).toBeInTheDocument();
  });
});
