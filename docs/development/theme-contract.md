# Semantic theme contract

Run `npm run check:theme`. V3test CI and `npm run publish:v3test` run the same command before accepting a release. The legacy PowerShell color scanner forwards to the same checker; it has no separate rules.

## Color ownership

- `src/index.css` owns primitive channels and all theme palette mappings.
- `src/theme.ts` registers theme identity, cycle order and surface appearance. The top-left control cycles `dark` → `light` (warm paper) → `sage` → `dark`. Palette values remain in `src/index.css`; adding a palette does not require new component branches or a theme framework. `getThemeAppearance()` owns light/dark ink protection independently of theme names.
- `useAppTheme` owns document selection and persistence. Existing dark/light preferences remain valid; sage is included in system backup/restore. Invalid stored values use dark; unknown imported preferences do not replace the current choice. No database migration is required.
- Warm paper uses parchment/ivory surfaces, charcoal-green ink and forest accents. Sage uses green-grey surfaces, pale jade cards and botanical ink. Both map modal, grid, input, keypad, cloud, status and hover roles explicitly. Fixed player palettes, QR white, source images and exported photo treatments are not recolored.
- Tailwind dark variants follow `data-theme-appearance` from the registry, not OS preference or a particular palette name. Native controls use each palette's CSS `color-scheme`. Appearance-specific styling belongs to semantic tokens; do not add `theme === 'light'` checks to individual components.
- Theme selection is applied before React renders so custom-color outlines do not lag behind CSS by one render. Browser `theme-color` reads the selected background once on an actual theme change, with no observer or polling; platform support varies, and the installed splash screen still uses the manifest's original fallback.
- `tailwind.config.js` exposes semantic roles: `app`, `surface`, `modal`, `txt`, `brand`, `status`, `input`, and `keypad`.
- Use `surface-alt` for the alternate/recessed general surface and `surface-hover` for its interaction state. Modal-specific recessed regions use `modal-bg-recessed`. Do not introduce synonymous spellings such as `surface-recessed` or `surface-bg-alt`.
- `txt-primary` follows the theme. `txt-on-color` stays white for filled controls and dark media overlays; it is not a foreground for lightly tinted panels.
- Shared primary buttons, active icons and grid accents derive from `brand-primary`, so a palette change does not leave a second hardcoded green behind.
- Primitive constants and `txt-on-color` inherit from `:root`. Theme-dependent Tailwind roles must keep explicit mappings in every registered non-default palette, so deleting a surface cannot silently fall back to its dark color. All referenced variables and aliases must resolve in every effective theme.
- Tailwind color variables contain RGB channels only. Modal backdrop channels and `--modal-backdrop-opacity` are separate so explicit `/60` modifiers work. Use `bg-modal-backdrop/[var(--modal-backdrop-opacity)]` when the theme's default opacity is wanted.
- Player/custom game colors and exported image treatments are separate from application surfaces. No changes to saved colors, layout, gestures or runtime data access are required for theme work.

## Color calculation foundation

- `src/utils/color.ts` normalizes Hex (3/4/6/8 digits), RGB/RGBA (numeric or percentage channels), HSL/HSLA, basic named colors and resolved CSS variables to RGBA. Unsupported or unresolved values return `null`; this is not a complete implementation of every CSS color space or named color.
- `withColorOpacity` multiplies existing alpha instead of appending Hex digits to arbitrary strings. Fixed player-channel variables retain their live CSS reference without computed-style reads. General variables are resolved because their values can already contain alpha.
- `src/utils/colorContrast.ts` owns source-over composition and foreground comparison. Translucent paint requires an explicitly supplied opaque backing; unknown backing is not guessed. Candidate foreground colors are evaluated against the composited background, rather than treating ink-tone labels as a button-text policy.
- Callers provide the effective backing for their context; this utility does not inspect ancestor elements, sample images, or infer every CSS overlay/filter. Photo treatments and the existing ink-outline registry remain separate consumers of shared color math.
- Reuse a `createColorReader()` for one synchronous operation or render. It performs at most one lazy `getComputedStyle` call and deduplicates parsed colors within that operation. Never keep this reader across theme changes. There are no new observers, global caches, effects or theme-selection state.
- Solid button labels now choose the higher-contrast candidate. Some mid-tone backgrounds, including current blue/red/green quick buttons, therefore use dark text. Numeric badges lighten for dark text and darken for light text so the badge does not undo that choice. Saved player/attribute colors and existing photo outlines are not rewritten.

## Reviewed fixed colors

`scripts/theme-color-exceptions.ts` lists file-specific color spellings and their reasons: QR quiet zones, source-photo masks and mapping ink, custom-color contrast, physical shadows, switch thumbs, artwork, and categorical badges. These exceptions bypass only the fixed-color rule, never unknown-role or variable checks. `@ui-ignore` is no longer an escape hatch.

The checker inspects production TypeScript/JavaScript string/template literals and CSS definitions using the existing TypeScript and PostCSS parsers. Static datasets, translations and tests are excluded. It does not open built-in scoreboard datasets or run in the browser. It does not prove visual contrast or resolve dynamically assembled class names; keep semantic class names complete and verify appearance separately when authorized.

## Verification and test consolidation

Theme checks read the same registry as runtime and validate all palettes. Focused visual-contract checks cover compact text on base/recessed/hover surfaces, tinted notices, filled controls, keypad and cloud pairs (4.5:1 for the two redesigned palettes), fixed player colors and light/texture outline behavior. Hook/header checks cover cycling, keyboard activation, persistence, remount and backup preference validation. These are static/component checks, not a substitute for mobile visual inspection; do not open a browser without explicit user authorization.

The previous 265 generated per-file/per-variable checks passed while undefined component-only tokens, invalid utilities, and fixed black/white UI colors remained. They were replaced with 14 focused cases covering independent failure modes: unknown utilities in template branches, missing light mappings, missing component variables, missing primitives, effective-theme aliases/CSS uses, cycles, duplicated alpha, four fixed-color spellings, scoped exceptions, and comments versus executable definitions. Repository compliance is one static scan, not one test per source file.

Review findings addressed: coverage (high: unchecked references), diagnostic/design (medium: repetitive passing cases), and exception ownership (medium: unbounded line ignores). The replacement is deterministic, uses no timers or network mocks, and has inline fixtures. Browser/locator concerns do not apply to this static contract. Missing-token/alias and fixed-color fixture mutations exercise the former blind spots; this is not a full automated mutation score or a visual/accessibility audit.
