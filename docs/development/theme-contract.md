# Semantic theme contract

Run `npm run check:theme`. V3test CI and `npm run publish:v3test` run the same command before accepting a release. The legacy PowerShell color scanner forwards to the same checker; it has no separate rules.

## Color ownership

- `src/index.css` owns primitive channels and the default/dark and light theme mappings.
- `tailwind.config.js` exposes semantic roles: `app`, `surface`, `modal`, `txt`, `brand`, `status`, `input`, and `keypad`.
- Use `surface-alt` for the alternate/recessed general surface and `surface-hover` for its interaction state. Modal-specific recessed regions use `modal-bg-recessed`. Do not introduce synonymous spellings such as `surface-recessed` or `surface-bg-alt`.
- `txt-primary` follows the theme. `txt-on-color` stays white for filled controls and dark media overlays; it is not a foreground for lightly tinted panels.
- Shared primary buttons, active icons and grid accents derive from `brand-primary`, so a palette change does not leave a second hardcoded green behind.
- Primitive constants and `txt-on-color` inherit from `:root`. Theme-dependent Tailwind roles must keep explicit light mappings, so deleting a light surface cannot silently fall back to its dark color. All referenced variables and aliases must resolve in both effective themes.
- Tailwind color variables contain RGB channels only. Modal backdrop channels and `--modal-backdrop-opacity` are separate so explicit `/60` modifiers work. Use `bg-modal-backdrop/[var(--modal-backdrop-opacity)]` when the theme's default opacity is wanted.
- Player/custom game colors and exported image treatments are separate from application surfaces. No changes to saved colors, layout, gestures or runtime data access are required for theme work.

## Reviewed fixed colors

`scripts/theme-color-exceptions.ts` lists file-specific color spellings and their reasons: QR quiet zones, source-photo masks and mapping ink, custom-color contrast, physical shadows, switch thumbs, artwork, and categorical badges. These exceptions bypass only the fixed-color rule, never unknown-role or variable checks. `@ui-ignore` is no longer an escape hatch.

The checker inspects production TypeScript/JavaScript string/template literals and CSS definitions using the existing TypeScript and PostCSS parsers. Static datasets, translations and tests are excluded. It does not open built-in scoreboard datasets or run in the browser. It does not prove visual contrast or resolve dynamically assembled class names; keep semantic class names complete and verify appearance separately when authorized.

## Verification and test consolidation

The previous 265 generated per-file/per-variable checks passed while undefined component-only tokens, invalid utilities, and fixed black/white UI colors remained. They were replaced with 14 focused cases covering independent failure modes: unknown utilities in template branches, missing light mappings, missing component variables, missing primitives, effective-theme aliases/CSS uses, cycles, duplicated alpha, four fixed-color spellings, scoped exceptions, and comments versus executable definitions. Repository compliance is one static scan, not one test per source file.

Review findings addressed: coverage (high: unchecked references), diagnostic/design (medium: repetitive passing cases), and exception ownership (medium: unbounded line ignores). The replacement is deterministic, uses no timers or network mocks, and has inline fixtures. Browser/locator concerns do not apply to this static contract. Missing-token/alias and fixed-color fixture mutations exercise the former blind spots; this is not a full automated mutation score or a visual/accessibility audit.
