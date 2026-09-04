import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequireVotingObserverRole } from "./RequireVotingObserverRole.jsx";

afterEach(() => cleanup());

describe("RequireVotingObserverRole", () => {
  it("permite ADMIN y VEEDOR", () => {
    render(<RequireVotingObserverRole session={{ status: "authenticated", roles: ["VEEDOR"] }}><p>Monitor</p></RequireVotingObserverRole>);
    expect(screen.getByText("Monitor")).toBeInTheDocument();
  });

  it("rechaza roles sin permiso", () => {
    render(<RequireVotingObserverRole session={{ status: "authenticated", roles: ["JUDGE"] }}><p>Monitor</p></RequireVotingObserverRole>);
    expect(screen.getByText("No tenés permisos para acceder a la supervisión.")).toBeInTheDocument();
    expect(screen.queryByText("Monitor")).not.toBeInTheDocument();
  });
});
