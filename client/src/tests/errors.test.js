import { describe, it, expect } from "vitest";
import { formatErrorMessage, ERROR_MESSAGES } from "../i18n/errors.js";

describe("Diccionario i18n de Errores (Spec 020 / RF-180)", () => {
  it("traduce códigos estándar de error de planilla y votación", () => {
    expect(formatErrorMessage({ code: "BALLOT_INCOMPLETE" })).toBe(ERROR_MESSAGES.BALLOT_INCOMPLETE);
    expect(formatErrorMessage({ code: "SCORE_IMMUTABLE" })).toBe(ERROR_MESSAGES.SCORE_IMMUTABLE);
    expect(formatErrorMessage("BALLOT_ALREADY_SUBMITTED")).toBe(ERROR_MESSAGES.BALLOT_ALREADY_SUBMITTED);
  });

  it("traduce errores de autenticación y bloqueo de usuario", () => {
    expect(formatErrorMessage({ code: "INVALID_CREDENTIALS" })).toBe(ERROR_MESSAGES.INVALID_CREDENTIALS);
    expect(formatErrorMessage({ code: "USER_LOCKED" })).toBe(ERROR_MESSAGES.USER_LOCKED);
    expect(formatErrorMessage({ code: "OTP_INVALID" })).toBe(ERROR_MESSAGES.OTP_INVALID);
  });

  it("traduce errores de red y HTTP", () => {
    expect(formatErrorMessage({ code: "NETWORK_ERROR" })).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(formatErrorMessage(new Error("Failed to fetch"))).toBe(ERROR_MESSAGES.NETWORK_ERROR);
    expect(formatErrorMessage({ code: "RATE_LIMIT_EXCEEDED" })).toBe(ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
  });

  it("utiliza mensaje personalizado del objeto de error si no hay código conocido", () => {
    expect(formatErrorMessage(new Error("Validación fallida en el formulario"))).toBe("Validación fallida en el formulario");
  });

  it("retorna fallback si el error es null, undefined o vacío", () => {
    expect(formatErrorMessage(null, "Error por defecto")).toBe("Error por defecto");
    expect(formatErrorMessage({}, "Error por defecto")).toBe("Error por defecto");
  });
});
