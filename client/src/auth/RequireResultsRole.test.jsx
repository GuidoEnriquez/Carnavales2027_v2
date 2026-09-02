import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequireResultsRole } from "./RequireResultsRole.jsx";

afterEach(() => cleanup());

describe("RequireResultsRole", () => {
  it("deniega la pantalla de escrutinio al ADMIN", () => {
    const { getByText, queryByText } = render(
      <RequireResultsRole session={{ status: "authenticated", roles: ["ADMIN"] }}>
        <p>Escrutinio privado</p>
      </RequireResultsRole>,
    );
    expect(getByText(/no tenés permisos/i)).toBeVisible();
    expect(queryByText("Escrutinio privado")).not.toBeInTheDocument();
  });

  it("permite la pantalla de escrutinio al SCRUTINEER (Escrutador / Escribano)", () => {
    const { getByText } = render(
      <RequireResultsRole session={{ status: "authenticated", roles: ["SCRUTINEER"] }}>
        <p>Escrutinio privado</p>
      </RequireResultsRole>,
    );
    expect(getByText("Escrutinio privado")).toBeVisible();
  });
});
