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

  it.each([
    ["--surface-input", "#0d1523"],
    ["--surface-login-input", "#304258"],
    ["--border-input", "rgba(148, 163, 184, 0.34)"],
    ["--surface-hover-subtle", "rgba(148, 163, 184, 0.1)"],
    ["--text-on-primary", "#082b61"],
    ["--text-on-accent", "#ffffff"],
  ])("define %s globalmente una sola vez con el valor existente", (name, value) => {
    const root = css.match(/:root\s*\{([^{}]*)\}/)?.[1] ?? "";
    const declaration = new RegExp(`${name}:\\s*([^;]+);`, "g");
    expect([...root.matchAll(declaration)].map((match) => match[1])).toEqual([value]);
    expect([...css.matchAll(declaration)].map((match) => match[1])).toEqual([value]);
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

  it("centraliza el bloque operativo sin cambiar sus valores efectivos", () => {
    // Legacy tokens are now mapped through semantic tokens in the main :root block.
    expect(css).toContain("--primary-color: var(--accent-primary);");
    expect(css).toContain("--primary-dark: var(--accent-hover);");
    expect(css).toContain("--accent-color: var(--warning);");
    expect(css).toContain("--danger-color: var(--danger);");
    expect(css).toContain("--success-color: var(--success);");
    expect(css).toContain("--bg-color: var(--surface-base);");
    expect(css).toContain("--surface: var(--surface-card);");
    expect(css).toContain("--text-color: var(--text-primary);");
    expect(css).toContain("--muted-color: var(--text-muted);");
    expect(css).toContain("--line-color: var(--border-subtle);");
    expect(css).toContain("--card-bg: var(--surface-card);");
    expect(css).toContain("--focus-color: var(--brand-gold);");
    expect(css).toContain("--mono-font: var(--font-mono);");
    expect(css).toContain("--border-radius: var(--radius-lg);");
    expect(css).toContain("--text-inverse: #0f172a;");
  });

  it("mantiene el orden de imports y evita overrides globales fuera de tokens", () => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const components = readFileSync(resolve(__dirname, "../styles/components.css"), "utf8");
    const ceremony = readFileSync(resolve(__dirname, "../styles/ceremony.css"), "utf8");
    const penalties = readFileSync(resolve(__dirname, "../styles/penalties.css"), "utf8");
    const scrutiny = readFileSync(resolve(__dirname, "../styles/scrutiny.css"), "utf8");
    const admin = readFileSync(resolve(__dirname, "../styles/admin.css"), "utf8");
    const competencia = readFileSync(resolve(__dirname, "../styles/competencia.css"), "utf8");
    const utilities = readFileSync(resolve(__dirname, "../styles/utilities.css"), "utf8");
    expect(index).toMatch(
      /^@import "\.\/styles\/tokens\.css";\s*@import "\.\/styles\/components\.css";\s*@import "\.\/styles\/ceremony\.css";\s*@import "\.\/styles\/penalties\.css";\s*@import "\.\/styles\/scrutiny\.css";\s*@import "\.\/styles\/admin\.css";\s*@import "\.\/styles\/competencia\.css";\s*@import "\.\/styles\/utilities\.css";/
    );
    expect(/:root\s*\{/.test(index)).toBe(false);
    expect(/:root\s*\{/.test(components)).toBe(false);
    expect(/:root\s*\{/.test(ceremony)).toBe(false);
    expect(/:root\s*\{/.test(penalties)).toBe(false);
    expect(/:root\s*\{/.test(scrutiny)).toBe(false);
    expect(/:root\s*\{/.test(admin)).toBe(false);
    expect(/:root\s*\{/.test(competencia)).toBe(false);
    expect(/:root\s*\{/.test(utilities)).toBe(false);
    expect(utilities).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("centraliza .ballot-status-* en styles/judge.css sin duplicados en index.css (Spec 026/T03)", () => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const judge = readFileSync(resolve(__dirname, "../styles/judge.css"), "utf8");
    for (const modifier of ["open", "submitted", "reopened"]) {
      expect(index).not.toMatch(new RegExp(`\\.ballot-status-${modifier}\\s*\\{`));
      expect(judge).toMatch(new RegExp(`\\.ballot-status-${modifier}\\s*\\{`));
    }
  });

  it("usa tokens oscuros en badges de monitor y workflow sin fondos claros legacy (Spec 026/T04)", () => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const monitorOpen = index.match(/\.monitor-status-open\s*\{([^{}]*)\}/)?.[1] ?? "";
    expect(monitorOpen).toMatch(/color:\s*var\(--success-text\)/);
    expect(monitorOpen).toMatch(/background:\s*var\(--success-bg\)/);
    const monitorClosed = index.match(/\.monitor-status-closed\s*\{([^{}]*)\}/)?.[1] ?? "";
    expect(monitorClosed).toMatch(/color:\s*var\(--text-muted\)/);
    const monitorWaiting = index.match(/\.monitor-status-not_open\s*\{([^{}]*)\}/)?.[1] ?? "";
    expect(monitorWaiting).toMatch(/color:\s*var\(--warning-text\)/);
    expect(monitorWaiting).toMatch(/background:\s*var\(--warning-bg\)/);
    const stepDone = index.match(/\.workflow-step-done\s*\{([^{}]*)\}/)?.[1] ?? "";
    expect(stepDone).toMatch(/border-color:\s*var\(--success\)/);
    for (const block of [monitorOpen, monitorClosed, monitorWaiting, stepDone]) {
      expect(block).not.toMatch(/#(dcfce7|e2e8f0|fef3c7|166534|334155|92400e|16a34a)/i);
    }
  });

  it("usa tokens en resultados/portal de components.css sin hex literales (Spec 026/T05)", () => {
    const components = readFileSync(resolve(__dirname, "../styles/components.css"), "utf8");
    expect(components).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(components).toContain(".app-button-danger:hover:not(:disabled) {");
    expect(components).toContain("background: var(--danger-border);");
    expect(components).toContain(".col-penalty { color: var(--danger-text);");
  });


  it.each([
    ["login", /\.login-card input\s*\{([^{}]*)\}/],
    ["OTP", /\.otp-input-group input\s*\{([^{}]*)\}/],
  ])("usa tokens de fondo y borde en los campos de %s", (_name, rule) => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const block = index.match(rule)?.[1] ?? "";
    expect(block).toMatch(/background:\s*var\(--surface-login-input\);/);
    expect(block).toMatch(/border:\s*2px solid var\(--border-input\);/);
    expect(block).not.toContain("#304258");
    expect(block).not.toMatch(/rgba\(148,\s*163,\s*184,\s*0?\.34\)/);
  });

  it.each([
    ["campos generales", "../index.css", /(?:^|\n)input,\s*\n\s*select,\s*\n\s*textarea\s*\{\s*\n\s*min-block-size:\s*3rem;([^{}]*)\}/],
    ["formulario de penalizaciones", "../styles/penalties.css", /\.penalty-form input,\s*\n\s*\.penalty-form select,\s*\n\s*\.penalty-form textarea\s*\{([^{}]*)\}/],
    ["modal de revocación", "../styles/penalties.css", /\.penalty-modal textarea\s*\{([^{}]*)\}/],
  ])("usa el token --surface-input en %s", (_name, file, rule) => {
    const source = readFileSync(resolve(__dirname, file), "utf8");
    const block = source.match(rule)?.[1] ?? "";
    expect(block).not.toBe("");
    expect(block).toMatch(/background:\s*var\(--surface-input\);/);
    expect(block).not.toContain("#0d1523");
  });


  it.each([
    ["botones primarios base", /(?:^|\n)button,\s*\n\.button-link\s*\{([^{}]*)\}/],
    ["grilla de puntaje en hover", /\.score-grid button:hover:not\(:disabled\)\s*\{([^{}]*)\}/],
    ["icono de confirmación de asignación", /\.assignment-confirm-btn-icon\s*\{([^{}]*)\}/],
  ])("usa el token --text-on-primary en %s", (_name, rule) => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const block = index.match(rule)?.[1] ?? "";
    expect(block).not.toBe("");
    expect(block).toMatch(/color:\s*var\(--text-on-primary\);/);
    expect(block).not.toContain("#082b61");
  });

  it.each([
    ["navegación global", "../index.css", /\.app-navigation nav a:hover\s*\{([^{}]*color:\s*#e2e8f0[^{}]*)\}/],
    ["navegación de competencia", "../styles/competencia.css", /\.competencia-nav button:hover:not\(:disabled\)\s*\{([^{}]*)\}/],
  ])("usa el token --surface-hover-subtle en hover de %s", (_name, file, rule) => {
    const source = readFileSync(resolve(__dirname, file), "utf8");
    const block = source.match(rule)?.[1] ?? "";
    expect(block).not.toBe("");
    expect(block).toMatch(/background:\s*var\(--surface-hover-subtle\);/);
    expect(block).not.toMatch(/rgba\(148,\s*163,\s*184,\s*0?\.1\)/);
  });

  it.each([
    ["botón primario de componentes", /\.app-button-primary\s*\{([^{}]*)\}/],
    ["botón danger de componentes", /\.app-button-danger\s*\{([^{}]*)\}/],
    ["opción de puntaje staged", /\.score-option-btn\.is-staged\s*\{([^{}]*)\}/],
    ["texto de ancla staged", /\.score-option-btn\.is-staged \.score-anchor-text\s*\{([^{}]*)\}/],
  ])("usa el token --text-on-accent en %s", (_name, rule) => {
    const components = readFileSync(resolve(__dirname, "../styles/components.css"), "utf8");
    const block = components.match(rule)?.[1] ?? "";
    expect(block).not.toBe("");
    expect(block).toMatch(/color:\s*var\(--text-on-accent\);/);
    expect(block).not.toContain("#ffffff");
  });

  it("usa dimensionamiento responsivo clamp en login-card y campos OTP para evitar desborde móvil", () => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const loginCard = index.match(/\.login-card\s*\{([^{}]*)\}/)?.[1] ?? "";
    const otpGroup = index.match(/\.otp-input-group\s*\{([^{}]*)\}/)?.[1] ?? "";
    const otpInput = index.match(/\.otp-input-group input\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(loginCard).toMatch(/max-inline-size:\s*100%/);
    expect(otpGroup).toMatch(/gap:\s*clamp\(/);
    expect(otpInput).toMatch(/width:\s*clamp\(/);
    expect(otpInput).toMatch(/max-inline-size:\s*100%/);
  });

  it("usa tokens semánticos y dimensionamiento fluido en la tarjeta de comparsa de jurados", () => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const card = index.match(/\.judge-ballot-card\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(card).toMatch(/background:\s*var\(--surface-card\);/);
    expect(card).toMatch(/border:\s*2px solid var\(--border-default\);/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-xl\);/);
    expect(card).toMatch(/min-block-size:\s*auto;/);
    expect(card).not.toContain("#64748b");
    expect(card).not.toMatch(/min-block-size:\s*19rem/);
  });

  it.each([
    ["decisión bloqueada ordinaria", /\.locked-score\s*\{([^{}]*)\}/, /var\(--success-border\)/, /var\(--success-bg\)/, /var\(--success-text\)/],
    ["decisión bloqueada no presentado", /\.locked-score\.not-presented\s*\{([^{}]*)\}/, /var\(--warning-border\)/, /var\(--warning-bg\)/, /var\(--warning-text\)/],
    ["planilla bloqueada resumen", /\.locked-sheet\s*\{([^{}]*)\}/, /var\(--success-border\)/, /var\(--success-bg\)/, /var\(--success-text\)/],
  ])("usa tokens semánticos en %s", (_name, rule, borderMatch, bgMatch, textMatch) => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const block = index.match(rule)?.[1] ?? "";

    expect(block).not.toBe("");
    expect(block).toMatch(borderMatch);
    expect(block).toMatch(bgMatch);
    expect(block).toMatch(textMatch);
    expect(block).not.toContain("#86efac");
    expect(block).not.toContain("#fde68a");
  });

  it("declara compensación de scroll en .judge-ballot-page para la barra inferior flotante", () => {
    const index = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const pageBlock = index.match(/\.judge-ballot-page\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(pageBlock).not.toBe("");
    expect(pageBlock).toMatch(/padding-block-end:\s*calc\(5\.5rem\s*\+\s*env\(safe-area-inset-bottom/);
  });

  it("garantiza target táctil accesible (48px) y responsividad móvil en los controles de la barra inferior", () => {
    const components = readFileSync(resolve(__dirname, "../styles/components.css"), "utf8");
    const navBtn = components.match(/\.nav-btn\s*\{([^{}]*)\}/)?.[1] ?? "";
    const faltantesBtn = components.match(/\.faltantes-btn\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(navBtn).toMatch(/min-block-size:\s*var\(--touch-target-min\);/);
    expect(faltantesBtn).toMatch(/min-block-size:\s*var\(--touch-target-min\);/);
    expect(components).toMatch(/@media\s*\(max-width:\s*480px\)\s*\{\s*\.ballot-bottom-bar/);
  });

  it("garantiza altura física estable (68px) y foco visible accesible en botones de puntaje", () => {
    const components = readFileSync(resolve(__dirname, "../styles/components.css"), "utf8");
    const btn = components.match(/\.score-option-btn\s*\{([^{}]*)\}/)?.[1] ?? "";
    const focus = components.match(/\.score-option-btn:focus-visible\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(btn).toMatch(/min-block-size:\s*68px;/);
    expect(focus).toMatch(/box-shadow:\s*var\(--focus-ring\);/);
  });

  it("garantiza target táctil accesible (48px) y foco visible en botones de salto del diálogo de faltantes", () => {
    const components = readFileSync(resolve(__dirname, "../styles/components.css"), "utf8");
    const jumpBtn = components.match(/\.pending-item-jump-btn\s*\{([^{}]*)\}/)?.[1] ?? "";
    const jumpFocus = components.match(/\.pending-item-jump-btn:focus-visible\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(jumpBtn).toMatch(/min-block-size:\s*var\(--touch-target-min\);/);
    expect(jumpBtn).toMatch(/border-inline-start:\s*3px solid var\(--warning\);/);
    expect(jumpFocus).toMatch(/box-shadow:\s*var\(--focus-ring\);/);
  });

  it("garantiza la adopción de tokens semánticos en componentes y tablas del panel de administración (RF-176, RF-177)", () => {
    const adminCss = readFileSync(resolve(__dirname, "../styles/admin.css"), "utf8");
    const competenciaCss = readFileSync(resolve(__dirname, "../styles/competencia.css"), "utf8");
    const cards = adminCss.match(/\.config-card,\s*\.record,\s*\.rubric-card\s*\{([^{}]*)\}/)?.[1] ?? "";
    const roster = adminCss.match(/\.roster-count\s*\{([^{}]*)\}/)?.[1] ?? "";
    const matrixCell = competenciaCss.match(/\.matrix-table th,\s*\.matrix-table td\s*\{([^{}]*)\}/)?.[1] ?? "";
    const statusInvited = adminCss.match(/\.status-invited\s*\{([^{}]*)\}/)?.[1] ?? "";
    const eventHeader = adminCss.match(/\.event-header\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(cards).toMatch(/background:\s*var\(--surface-card\);/);
    expect(cards).toMatch(/border:\s*1px solid var\(--border-subtle\);/);
    expect(roster).toMatch(/background:\s*var\(--surface-raised\);/);
    expect(roster).toMatch(/color:\s*var\(--text-primary\);/);
    expect(matrixCell).toMatch(/border:\s*1px solid var\(--border-subtle\);/);
    expect(statusInvited).toMatch(/color:\s*var\(--warning-text\);/);
    expect(statusInvited).toMatch(/background:\s*var\(--warning-bg\);/);
    expect(eventHeader).toMatch(/border-block-end:\s*4px solid var\(--accent-primary\);/);
  });

  it("garantiza la adopción de tokens semánticos en submódulos de votación y preparación de eventos (RF-176, RF-177)", () => {
    const adminCss = readFileSync(resolve(__dirname, "../styles/admin.css"), "utf8");
    const competenciaCss = readFileSync(resolve(__dirname, "../styles/competencia.css"), "utf8");
    const votingSummaryStrong = adminCss.match(/\.voting-summary strong\s*\{([^{}]*)\}/)?.[1] ?? "";
    const pendingDialogH2 = adminCss.match(/\.pending-dialog-content h2\s*\{([^{}]*)\}/)?.[1] ?? "";
    const readinessFail = competenciaCss.match(/\.readiness-fail\s*\{([^{}]*)\}/)?.[1] ?? "";
    const readinessOk = competenciaCss.match(/\.readiness-ok\s*\{([^{}]*)\}/)?.[1] ?? "";
    const opsSummary = adminCss.match(/\.operations-summary\s*\{([^{}]*)\}/)?.[1] ?? "";

    expect(votingSummaryStrong).toMatch(/color:\s*var\(--accent-primary\);/);
    expect(votingSummaryStrong).toMatch(/font-family:\s*var\(--font-display,\s*var\(--font-sans\)\);/);
    expect(pendingDialogH2).toMatch(/font-family:\s*var\(--font-display,\s*var\(--font-sans\)\);/);
    expect(readinessFail).toMatch(/border-inline-start:\s*3px solid var\(--danger\);/);
    expect(readinessOk).toMatch(/color:\s*var\(--success-text\);/);
    expect(opsSummary).toMatch(/background:\s*var\(--surface-card\);/);
    expect(opsSummary).toMatch(/border:\s*1px solid var\(--border-subtle\);/);
  });
});
