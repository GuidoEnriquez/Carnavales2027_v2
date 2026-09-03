import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevokePenaltyModal } from "./RevokePenaltyModal.jsx";

const apiRequestMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/http.js", () => ({ apiRequest: apiRequestMock }));

const mockPenalty = {
  id: "penalty-1",
  eventId: "event-1",
  nightId: "night-1",
  nightName: "Noche 1",
  eventTroupeId: "troupe-1",
  troupeName: "Comparsa Porambá",
  reason: "Demora en ingreso",
  penaltyPoints: 2,
  status: "APPLIED",
  appliedByName: "Comisario General",
  createdAt: "2026-02-14T22:00:00.000Z",
};

describe("RevokePenaltyModal", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("renderiza datos de la penalización a revocar y enfoca el campo de motivo", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };

    const { getByRole, getByLabelText, getByText } = render(
      <RevokePenaltyModal
        penalty={mockPenalty}
        eventId="event-1"
        triggerRef={triggerRef}
        onClose={vi.fn()}
        onRevoked={vi.fn()}
      />,
    );

    expect(getByRole("heading", { name: "Revocar sanción" })).toBeVisible();
    expect(getByText(/Estás por anular la sanción de/i)).toBeVisible();
    expect(getByText(/Comparsa Porambá/i)).toBeVisible();
    expect(getByText(/"Demora en ingreso"/i)).toBeVisible();

    const reasonInput = getByLabelText(/motivo reglamentario de la revocación/i);
    expect(document.activeElement).toBe(reasonInput);

    trigger.remove();
  });

  it("cierra el modal y devuelve el foco al disparador al presionar Escape", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };
    const onClose = vi.fn();

    render(
      <RevokePenaltyModal
        penalty={mockPenalty}
        eventId="event-1"
        triggerRef={triggerRef}
        onClose={onClose}
        onRevoked={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it("cierra el modal y devuelve el foco al disparador al hacer clic en Cancelar", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };
    const onClose = vi.fn();

    const { getByRole } = render(
      <RevokePenaltyModal
        penalty={mockPenalty}
        eventId="event-1"
        triggerRef={triggerRef}
        onClose={onClose}
        onRevoked={vi.fn()}
      />,
    );

    fireEvent.click(getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });

  it("atrapa el foco navegando con Tab y Shift+Tab dentro del diálogo", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };

    const { getByRole, getByLabelText } = render(
      <RevokePenaltyModal
        penalty={mockPenalty}
        eventId="event-1"
        triggerRef={triggerRef}
        onClose={vi.fn()}
        onRevoked={vi.fn()}
      />,
    );

    const reasonInput = getByLabelText(/motivo reglamentario de la revocación/i);
    const cancelBtn = getByRole("button", { name: "Cancelar" });

    // Rellenamos el textarea para que el botón de submit esté activo
    fireEvent.change(reasonInput, { target: { value: "Descargo formal" } });

    // Con el foco en el último elemento (Cancelar), presionar Tab debe ciclar al primero (textarea)
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(reasonInput);

    // Con el foco en el primer elemento (textarea), presionar Shift+Tab debe ciclar al último (Cancelar)
    reasonInput.focus();
    expect(document.activeElement).toBe(reasonInput);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancelBtn);

    trigger.remove();
  });

  it("ejecuta la revocación exitosamente y llama onRevoked con la respuesta", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };
    const onRevoked = vi.fn();
    const onClose = vi.fn();

    const revokedData = { ...mockPenalty, status: "REVOKED", revocationReason: "Descargo probado" };
    apiRequestMock.mockResolvedValueOnce(revokedData);

    const { getByRole, getByLabelText } = render(
      <RevokePenaltyModal
        penalty={mockPenalty}
        eventId="event-1"
        triggerRef={triggerRef}
        onClose={onClose}
        onRevoked={onRevoked}
      />,
    );

    const reasonInput = getByLabelText(/motivo reglamentario de la revocación/i);
    fireEvent.change(reasonInput, { target: { value: "Descargo probado" } });

    const submitBtn = getByRole("button", { name: "Confirmar revocación" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/v1/events/event-1/penalties/penalty-1/revoke",
        {
          method: "POST",
          body: JSON.stringify({ revocationReason: "Descargo probado" }),
        },
      );
      expect(onRevoked).toHaveBeenCalledWith(revokedData);
      expect(onClose).toHaveBeenCalled();
    });

    trigger.remove();
  });

  it("muestra mensajes de error traducidos ante respuestas de error de la API", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    const triggerRef = { current: trigger };

    const apiError = Object.assign(new Error("RESULTS_ALREADY_RELEASED"), {
      code: "RESULTS_ALREADY_RELEASED",
    });
    apiRequestMock.mockRejectedValueOnce(apiError);

    const { getByRole, getByLabelText, getByText } = render(
      <RevokePenaltyModal
        penalty={mockPenalty}
        eventId="event-1"
        triggerRef={triggerRef}
        onClose={vi.fn()}
        onRevoked={vi.fn()}
      />,
    );

    const reasonInput = getByLabelText(/motivo reglamentario de la revocación/i);
    fireEvent.change(reasonInput, { target: { value: "Descargo tardío" } });

    const submitBtn = getByRole("button", { name: "Confirmar revocación" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        getByText("Los resultados ya fueron liberados. No se puede revocar la penalización."),
      ).toBeVisible();
    });

    trigger.remove();
  });
});
