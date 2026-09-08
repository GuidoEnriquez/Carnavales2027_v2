import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { goToRoleHome } from "../pages/LoginPage.jsx";

describe("LoginPage - goToRoleHome (Spec 023)", () => {
  let originalHash;

  beforeEach(() => {
    originalHash = window.location.hash;
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it("no redirige si la sesión no está autenticada", () => {
    const redirected = goToRoleHome({ status: "unauthenticated" });
    expect(redirected).toBe(false);
  });

  it("redirige a #/admin/events a usuario con rol único ADMIN", () => {
    goToRoleHome({ status: "authenticated", roles: ["ADMIN"] });
    expect(window.location.hash).toBe("#/admin/events");
  });

  it("redirige a #/judge a usuario con rol único JUDGE", () => {
    goToRoleHome({ status: "authenticated", roles: ["JUDGE"] });
    expect(window.location.hash).toBe("#/judge");
  });

  it("redirige a #/admin/penalties a usuario con rol único COMISARIO", () => {
    goToRoleHome({ status: "authenticated", roles: ["COMISARIO"] });
    expect(window.location.hash).toBe("#/admin/penalties");
  });

  it("redirige a #/admin/results a usuario con rol único SCRUTINEER", () => {
    goToRoleHome({ status: "authenticated", roles: ["SCRUTINEER"] });
    expect(window.location.hash).toBe("#/admin/results");
  });

  it("redirige a #/admin/results a usuario con rol único ESCRIBANO", () => {
    goToRoleHome({ status: "authenticated", roles: ["ESCRIBANO"] });
    expect(window.location.hash).toBe("#/admin/results");
  });

  it("redirige a #/veedor a usuario con rol único VEEDOR", () => {
    goToRoleHome({ status: "authenticated", roles: ["VEEDOR"] });
    expect(window.location.hash).toBe("#/veedor");
  });

  it("redirige a #/home a usuario con múltiples roles operativos", () => {
    goToRoleHome({ status: "authenticated", roles: ["ADMIN", "VEEDOR"] });
    expect(window.location.hash).toBe("#/home");
  });

  it("redirige a #/home a usuario autenticado sin roles específicos", () => {
    goToRoleHome({ status: "authenticated", roles: [] });
    expect(window.location.hash).toBe("#/home");
  });
});
