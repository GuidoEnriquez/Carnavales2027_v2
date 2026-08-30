import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JudgeHomePage } from "../pages/JudgeHomePage.jsx";

describe("JudgeHomePage", () => {
  afterEach(cleanup);

  it("aclara que un jurado registrado todavía no tiene planillas habilitadas", () => {
    render(<JudgeHomePage session={{ judgeProfile: { registrationStatus: "REGISTERED" } }} />);
    expect(screen.getByText(/no tenés planillas habilitadas/)).toBeInTheDocument();
    expect(screen.queryByText(/puntuar comparsa/i)).not.toBeInTheDocument();
  });

  it("muestra suspensión sin capacidades operativas", () => {
    render(<JudgeHomePage session={{ judgeProfile: { registrationStatus: "SUSPENDED" } }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Acceso suspendido");
  });
});
