import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntityDrawer } from "./EntityDrawer.jsx";
import { ConfigurationProgress } from "./ConfigurationProgress.jsx";
import { RubricTree } from "../features/RubricTree.jsx";
import { JudgeAssignmentDialog } from "../features/JudgeAssignmentDialog.jsx";

describe("Spec 027/G — interacción y accesibilidad", () => {
  afterEach(() => {
    cleanup();
  });
  it("EntityDrawer cierra con Escape y expone título accesible", () => {
    const onClose = vi.fn();
    render(
      <EntityDrawer isOpen onClose={onClose} title="Editar jornada" description="Modificá los datos.">
        <p>Contenido</p>
      </EntityDrawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "Editar jornada" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("EntityDrawer cerrado no deja rastros en el DOM", () => {
    render(
      <EntityDrawer isOpen={false} onClose={() => {}} title="Oculto">
        <p>Contenido</p>
      </EntityDrawer>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ConfigurationProgress expone progreso y pasos navegables", () => {
    render(
      <ConfigurationProgress
        value={43}
        steps={[
          { key: "a", label: "Jornadas", detail: "1 de competencia", state: "done", href: "#/admin/events" },
          { key: "b", label: "Comparsas", detail: "0 activas", state: "current", href: "#/admin/competencia" },
        ]}
      />,
    );
    const bar = screen.getByRole("progressbar", { name: "Preparación" });
    expect(bar).toHaveAttribute("aria-valuenow", "43");
    expect(screen.getByRole("link", { name: /Comparsas\. Paso actual/ })).toHaveAttribute("href", "#/admin/competencia");
  });

  it("RubricTree ordena por displayOrder y avisa especialidades vacías", () => {
    render(
      <RubricTree
        specialties={[
          { id: "s1", name: "Baile", active: true },
          { id: "s2", name: "Vestuario", active: true },
        ]}
        rubrics={[
          {
            id: "r1",
            name: "Coreografía",
            active: true,
            items: [
              { id: "i2", name: "Zeta", specialtyId: "s1", displayOrder: 2, active: true },
              { id: "i1", name: "Alfa", specialtyId: "s1", displayOrder: 1, active: true },
            ],
            criteria: [],
          },
        ]}
      />,
    );
    const tree = screen.getByLabelText("Árbol de evaluación por especialidad");
    const items = Array.from(tree.querySelectorAll(".rubric-tree-items > li > span")).map((el) => el.textContent);
    expect(items).toEqual(["Alfa", "Zeta"]);
    expect(tree).toHaveTextContent("Sin rubros asignados a esta especialidad.");
  });

  it("JudgeAssignmentDialog revela Suplente de solo con teclado", () => {
    const onClose = vi.fn();
    render(
      <JudgeAssignmentDialog
        isOpen
        onClose={onClose}
        onSubmit={() => {}}
        nightName="Noche 1"
        specialtyName="Baile"
        judges={[{ id: "j1", name: "Jurado Uno" }]}
        primaryOptions={[{ id: "p1", judgeName: "Titular", nightName: "Noche 1", specialtyName: "Baile" }]}
      />,
    );
    expect(screen.queryByLabelText("Suplente de")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Suplente" }));
    expect(screen.getByLabelText("Suplente de")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Titular" }));
    expect(screen.queryByLabelText("Suplente de")).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: "Asignar jurado" });
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
