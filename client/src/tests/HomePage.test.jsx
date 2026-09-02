import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomePage } from "../pages/HomePage.jsx";

afterEach(() => cleanup());

describe("HomePage", () => {
  it("ofrece el área de escrutinio al SCRUTINEER", () => {
    render(<HomePage session={{ roles: ["SCRUTINEER"] }} />);

    expect(screen.getByRole("link", { name: "Abrir escrutinio" })).toHaveAttribute(
      "href",
      "#/admin/results",
    );
  });
});
