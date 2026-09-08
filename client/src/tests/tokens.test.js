import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

describe("Design System Tokens (Spec 020 / RF-176, RF-177)", () => {
  const tokensPath = resolve(__dirname, "../styles/tokens.css");
  const css = readFileSync(tokensPath, "utf8");

  it("define superficies, textos, bordes y acentos en :root", () => {
    expect(css).toContain("--surface-base: #090d16;");
    expect(css).toContain("--surface-card: #111827;");
    expect(css).toContain("--text-primary: #f8fafc;");
    expect(css).toContain("--text-secondary: #cbd5e1;");
    expect(css).toContain("--border-subtle: #1e293b;");
    expect(css).toContain("--touch-target-min: 48px;");
  });

  it("define estados operativos con fondo, borde y texto de alto contraste", () => {
    expect(css).toContain("--success:");
    expect(css).toContain("--success-bg:");
    expect(css).toContain("--warning:");
    expect(css).toContain("--danger:");
    expect(css).toContain("--info:");
  });

  it("soporta capas visuales data-layer='brand' e 'instrument'", () => {
    expect(css).toContain('[data-layer="brand"]');
    expect(css).toContain("--accent-primary: #e11d74;"); // Magenta carnaval
    expect(css).toContain("--accent-secondary: #f5b301;"); // Dorado
    expect(css).toContain("--accent-tertiary: #14b8a6;"); // Turquesa

    expect(css).toContain('[data-layer="instrument"]');
    expect(css).toContain("--accent-primary: #2563eb;"); // Azul operativo
  });

  it("incluye reglas para accesibilidad: prefers-reduced-motion y prefers-contrast", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important;");
    expect(css).toContain("@media (prefers-contrast: more)");
  });

  it("conserva compatibilidad con variables heredadas", () => {
    expect(css).toContain("--bg-color: var(--surface-base);");
    expect(css).toContain("--card-bg: var(--surface-card);");
    expect(css).toContain("--text-color: var(--text-primary);");
    expect(css).toContain("--primary-color: var(--accent-primary);");
  });
});
