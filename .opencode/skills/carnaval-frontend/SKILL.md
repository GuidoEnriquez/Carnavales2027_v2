---
name: carnaval-frontend
description: Build or review frontend UI in Carnavales2027_v2 (React/Vite CSS, tokens, planilla, Dialog, PageShell, data-layer brand/instrument). Use ONLY when touching client/src pages, components, or styles; combine with frontend-design for aesthetics and web-design-guidelines for audits.
---

# Carnaval Frontend

Project adapter over `frontend-design` + `web-design-guidelines` for
Carnavales2027_v2. Aesthetic ambition comes from those skills; every choice
below is a hard project constraint that wins over generic taste.

## 0. Trigger routing

- New UI / restyle / CSS / layout / copy in `client/src`: use this skill,
  then apply `frontend-design` (plan → critique) inside these constraints.
- Asked to "review my UI", "check accessibility", "audit design": fetch the
  guidelines URL from `web-design-guidelines/SKILL.md` first, then audit
  against Section 3–5 below and output `file:line` findings.
- Backend-only, migration-only, or API-only task: do NOT use this skill.

## 1. Mandatory reads (SDD proportional)

Before touching operative screens, read:

1. `client/AGENTS.md` — binding design brief (routes, dark-mode night op,
   immutability, completeness, viewports).
2. `client/src/styles/tokens.css` — only legal values for color, type,
   space (`--space-*`), radius (`--radius-*`), touch (`--touch-target-min: 48px`),
   focus (`--focus-ring`), shadows, z-index.
3. `client/src/index.css` import order: `tokens → components → ceremony →
   penalties → scrutiny → admin → competencia → utilities` (last wins at
   equal specificity).
4. Specs 020 (tokens, `data-layer`, atomic components, PWA), 023 (brand
   layer, `goToRoleHome`, `prefers-reduced-motion`), 026 (no dead CSS,
   single `.ballot-status-*` source in `styles/judge.css`, badges/results to
   tokens, `u-*` utilities, `PageShell`/`DialogFooter` 100% adoption).

No behavior change without an approved spec: never invent flows,
persistence, auth, scoring rules, or offline sync in UI code.

## 2. Layers and components (non-negotiable)

- `data-layer="instrument"` (default operative: judge ballot, admin,
  VEEDOR monitor, comisariato, escrutinio): sober dark `#090D16`, accent
  `#2563eb`, zero decorative animation, WCAG 2.2 AA (4.5:1 text, 3:1
  controls), visible keyboard focus, `48px` minimum touch (52–64px for
  primary ops), never color-only status (color + icon + text).
- `data-layer="brand"` (login, role home, public results, acta): festive
  magenta `#E11D74` / gold `#F5B301` / turquoise `#14B8A6`, display type.
  Spend boldness here; keep instrument quiet.
- Reuse, don't reinvent: `Dialog` (native `<dialog>`, focus trap +
  `focusReturnRef` + ESC + labelledby/describedby), `Button`
  (variants + `aria-busy`), `StatusPill`, `ProgressBar`
  (`role="progressbar"` + valuemin/max/now), `Toast`
  (`role="status"`, `aria-live="polite"`), `PageShell`, `DialogFooter`,
  `EventCard`, `RequireAnyRole`. New colors must be tokens, new spacing
  must be `u-*` utilities, new status must extend `.ballot-status-*`.
- Copy: sentence case, active voice, user vocabulary ("Guardar", "Publicar"
  → toast "Publicado"). Errors explain what happened + how to fix, never
  raw codes (resolve via `client/src/i18n/errors.js`). Empty states invite
  action. No `→` suffixes, no `WORD — fragment` labels, no ALL-CAPS
  eyebrows unless the brief pins them.

## 3. Ballot invariants (Specs 004/006/007)

- Scale is 1–10 only. `0` never appears in the grid; `No se presentó`
  is a segregated secondary action → confirm modal → `NOT_PRESENTED`,
  immediately immutable. No manual 0, no auto-scores, no "5 por equidad".
- `PENDING` blocks confirm and close. Pending-dialog lists jurado,
  comparsa, rubro, ítem with direct navigation; no silent completion.
- Confirmed item = immutable. No "Modificar puntuaciones" for
  `SCORED`/`NOT_PRESENTED`. Closed sheets render read-only, never disabled
  inputs. Server is authoritative for session, 2FA, assignment, window,
  integrity, secrecy; UI indicators never substitute it.
- Offline/sync visuals are prototype-only (Spec 005 deferred, Spec 012
  online-only). Never wire local persistence as operative behavior.

## 4. Responsive and a11y floor

- Viewports: `390x844` (single column, 2-col score grid, `No se presentó`
  separated, footer wraps full-width), `768x1024` (may add lateral nav),
  `1440x900` (desktop sidebar of comparsas, never a giant mobile).
- Touch: no hover-dependent or precision-dependent critical action;
  destructive/irreversible pairs (Cancelar / Confirmar-cerrar) spaced to
  prevent mis-taps. Respect `prefers-reduced-motion` and
  `prefers-contrast: more`. Keep progress and state always visible.

## 5. Workflow (two passes)

1. Plan: 4–6 named hex tokens (from project palette unless brand layer
   justifies one new accent), type roles (Inter/system + mono for
   metadata), one-sentence layout + ASCII wireframe per viewport,
   one memorable element, everything else quiet.
2. Self-check against `client/AGENTS.md` §2 reference + generic-default
   list in `frontend-design` (cream/terracotta, acid-on-black, broadsheet,
   SaaS-card-kit, eyebrow/dot/dash chrome): revise anything that reads as
   a default, state what changed and why. Then build, watching selector
   specificity (utilities compose last), then critique from a screenshot
   when possible and remove one decoration.
