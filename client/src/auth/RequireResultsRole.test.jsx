import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequireResultsRole } from "./RequireResultsRole.jsx";

afterEach(() => cleanup());

describe("RequireResultsRole", () => {
  it("permite la pantalla de escrutinio al ADMIN", () => {
    const { getByText } = render(
      <RequireResultsRole session={{ status: "authenticated", roles: ["ADMIN"] }}>
        <p>Escrutinio privado</p>
      </RequireResultsRole>,
    );
    expect(getByText("Escrutinio privado")).toBeVisible();
  });

  it("permite la pantalla de escrutinio al ESCRIBANO", () => {
    const { getByText } = render(
      <RequireResultsRole session={{ status: "authenticated", roles: ["ESCRIBANO"] }}>
        <p>Escrutinio privado</p>
      </RequireResultsRole>,
    );
    expect(getByText("Escrutinio privado")).toBeVisible();
  });
});
