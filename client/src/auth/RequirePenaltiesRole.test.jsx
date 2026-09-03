import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequirePenaltiesRole } from "./RequirePenaltiesRole.jsx";

afterEach(() => cleanup());

describe("RequirePenaltiesRole", () => {
  it("permite la pantalla de penalizaciones al ADMIN", () => {
    const { getByText } = render(
      <RequirePenaltiesRole session={{ status: "authenticated", roles: ["ADMIN"] }}>
        <p>Panel de Comisariato</p>
      </RequirePenaltiesRole>,
    );
    expect(getByText("Panel de Comisariato")).toBeVisible();
  });

  it("permite la pantalla de penalizaciones al COMISARIO", () => {
    const { getByText } = render(
      <RequirePenaltiesRole session={{ status: "authenticated", roles: ["COMISARIO"] }}>
        <p>Panel de Comisariato</p>
      </RequirePenaltiesRole>,
    );
    expect(getByText("Panel de Comisariato")).toBeVisible();
  });

  it("rechaza a usuarios sin rol COMISARIO ni ADMIN", () => {
    const { getByText, queryByText } = render(
      <RequirePenaltiesRole session={{ status: "authenticated", roles: ["JUDGE"] }}>
        <p>Panel de Comisariato</p>
      </RequirePenaltiesRole>,
    );
    expect(getByText("No tenés permisos para acceder a esta sección.")).toBeVisible();
    expect(queryByText("Panel de Comisariato")).not.toBeInTheDocument();
  });

  it("exige 2FA si la sesión está en second-factor-required", () => {
    const { getByText, queryByText } = render(
      <RequirePenaltiesRole session={{ status: "second-factor-required", roles: ["COMISARIO"] }}>
        <p>Panel de Comisariato</p>
      </RequirePenaltiesRole>,
    );
    expect(getByText(/Completá la verificación en dos pasos/i)).toBeVisible();
    expect(queryByText("Panel de Comisariato")).not.toBeInTheDocument();
  });
});
