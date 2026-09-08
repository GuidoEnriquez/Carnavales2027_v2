import { createRef } from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
import { Dialog } from "../components/Dialog.jsx";
import { Button } from "../components/Button.jsx";
import { StatusPill } from "../components/StatusPill.jsx";
import { ProgressBar } from "../components/ProgressBar.jsx";
import { Toast } from "../components/Toast.jsx";

// JSDOM mock for HTMLDialogElement if not implemented
beforeAll(() => {
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal || function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close || function () {
      this.open = false;
    };
  }
});

describe("Componentes Compartidos Atómicos (Spec 020 / RF-178)", () => {
  describe("<Dialog>", () => {
    it("no renderiza cuando isOpen es false", () => {
      render(
        <Dialog isOpen={false} onClose={() => {}} title="Modal Test">
          <p>Contenido</p>
        </Dialog>
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("renderiza con accesibilidad cuando isOpen es true", () => {
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Título de prueba" description="Descripción accesible">
          <p>Cuerpo del diálogo</p>
        </Dialog>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Título de prueba" })).toBeInTheDocument();
      expect(screen.getByText("Descripción accesible")).toBeInTheDocument();
      expect(screen.getByText("Cuerpo del diálogo")).toBeInTheDocument();

      const closeButton = screen.getByRole("button", { name: "Cerrar diálogo" });
      fireEvent.click(closeButton);
      expect(handleClose).toHaveBeenCalledOnce();
    });

    it("restaura el foco a focusReturnRef al cerrarse", () => {
      const triggerRef = createRef();
      const { rerender } = render(
        <div>
          <button ref={triggerRef} type="button">Abrir</button>
          <Dialog isOpen={true} onClose={() => {}} title="Modal" focusReturnRef={triggerRef}>
            <p>Contenido</p>
          </Dialog>
        </div>
      );

      const buttonEl = screen.getByRole("button", { name: "Abrir" });
      const focusSpy = vi.spyOn(buttonEl, "focus");

      rerender(
        <div>
          <button ref={triggerRef} type="button">Abrir</button>
          <Dialog isOpen={false} onClose={() => {}} title="Modal" focusReturnRef={triggerRef}>
            <p>Contenido</p>
          </Dialog>
        </div>
      );

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe("<Button>", () => {
    it("renderiza y responde al evento click", () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" onClick={handleClick}>
          Guardar
        </Button>
      );

      const btn = screen.getByRole("button", { name: "Guardar" });
      expect(btn).toHaveClass("app-button-primary", "app-button-md");
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it("maneja estado busy deshabilitando el botón y activando aria-busy", () => {
      const handleClick = vi.fn();
      render(
        <Button busy={true} busyText="Guardando cambios..." onClick={handleClick}>
          Guardar
        </Button>
      );

      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Guardando cambios...")).toBeInTheDocument();

      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("<StatusPill>", () => {
    it("mapea estados conocidos a etiquetas humanas de alto contraste", () => {
      const { rerender } = render(<StatusPill status="OPEN" />);
      expect(screen.getByText("Abierta")).toHaveClass("status-pill-open");

      rerender(<StatusPill status="SUBMITTED" />);
      expect(screen.getByText("Confirmada")).toHaveClass("status-pill-submitted");

      rerender(<StatusPill status="NOT_PRESENTED" />);
      expect(screen.getByText("No se presentó")).toHaveClass("status-pill-not-presented");
    });

    it("permite sobrescribir la etiqueta explícita", () => {
      render(<StatusPill status="OPEN" label="Personalizada" />);
      expect(screen.getByText("Personalizada")).toBeInTheDocument();
    });
  });

  describe("<ProgressBar>", () => {
    it("renderiza rol progressbar y atributos ARIA correspondientes", () => {
      render(<ProgressBar value={40} max={100} label="Completado" sublabel="4 de 10" />);

      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "40");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
      expect(bar).toHaveAttribute("aria-label", "Completado");
      expect(screen.getByText("Completado")).toBeInTheDocument();
      expect(screen.getByText("4 de 10")).toBeInTheDocument();
    });
  });

  describe("<Toast>", () => {
    it("renderiza con rol status y aria-live polite", () => {
      const handleDismiss = vi.fn();
      const handleAction = vi.fn();

      render(
        <Toast
          message="Puntaje guardado"
          type="success"
          actionLabel="Deshacer"
          onAction={handleAction}
          onDismiss={handleDismiss}
        />
      );

      const toast = screen.getByRole("status");
      expect(toast).toHaveAttribute("aria-live", "polite");
      expect(toast).toHaveClass("app-toast-success");
      expect(screen.getByText("Puntaje guardado")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
      expect(handleAction).toHaveBeenCalledOnce();

      fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
      expect(handleDismiss).toHaveBeenCalledOnce();
    });
  });
});
