import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App.jsx";

describe("App", () => {
  it("muestra la identidad inicial del panel administrativo", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Carnavales 2027" })).toBeInTheDocument();
    expect(screen.getByText("Panel administrativo en preparación")).toBeInTheDocument();
  });
});
