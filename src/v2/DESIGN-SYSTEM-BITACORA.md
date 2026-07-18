# Hacktrack — Design System "Bitácora" (LOCKED 2026-07-17)

The single source of truth for the aesthetic overhaul. Chosen via 6 art-director directions → visual judging → 7-persona panel (varying sophistication) + 3 design judges. Base = "Editorial Data" (judges unanimous; trust 7/7 personas). Grafts: warm-dark from "Tactile Depth", glowing ring from "Living Signal", gauge precision from "Quiet Instrument".

Name **Bitácora** = a beautiful personal *logbook/report* about your body. It is legally load-bearing: reinforces "bitácora, NOT dispositivo médico" (LGS art. 262) — the aesthetic must read *editorial/personal*, never *clinical readout*.

## Soul (one paragraph)
A warm, editorial, paper-and-ink report about your body. Expressive **serif display numerals** are the voice (they finally give the app a voice — the teardown's #1 gap). Data looks like a beautiful printed figure, not a hospital monitor. Two first-class themes: warm **Papel** (light) and warm **Tinta** (dark, premium, glowing). Trust comes from the editorial calm + ink-blue; warmth/energy from amber. Depth is available for biohackers but **never ambushes** the casual user — plain language first, science on tap.

## THE THREE LAWS (from the panel — violate none)
1. **Progressive disclosure.** Primary surfaces (Inicio, top of Vida) lead with ONE plain-language line + the big number + the primary action. The scientific plasma figure lives on Vida *below a plain summary or behind "ver detalle"* — reachable for Rodrigo, never ambushing Carmen/Mariana/Beto.
2. **Plain es-MX first; jargon on tap.** Every technical term (`t½`, `% del pico`, `AUC`, `adherencia`, `farmacocinética`, `HRV`, `mcg`) shows a plain label first and reveals a one-line explanation on tap (a subtle `?`). This is also a compliance win (less clinical framing).
3. **The giant serif number is sacred.** Every persona loved it. Hero numerals stay big, serif, and count up.

## COLOR — two themes, one accent logic
Semantics: **ink-blue = interactive/trust/data**; **amber = your energy/momentum (the ring, streaks, dark glow)**; green/amber/red = states (always icon+text+color, never color alone).

### Papel (light) — warm paper, not cold white
```
--paper:        #F4F1EA   /* body */
--surface:      #FBFAF6   /* cards (lifted paper) */
--raised:       #EEE9DE   /* rows/wells */
--ink:          #1A1712   /* text primary — warm near-black, ~15:1 */
--ink-2:        #57514663 → solid #575146  /* secondary ~7:1 */
--ink-3:        #8A8477   /* tertiary — AA floor, don't lower */
--hairline:     rgba(26,23,18,0.12)
--blue:         #2A3F8F   /* primary: CTA/active/links/data — deep ink azure, NOT cobalt-fintech */
--blue-press:   #223475
--amber:        #C9761F   /* energy: ring, streak, highlights (clay-amber, editorial not "alarm") */
--amber-soft:   #F3E7D4   /* amber tint fills */
--ok:           #2E9E6B
--warn:         #C7901E
--alert:        #C6412E
```
### Tinta (dark) — warm ink, NOT blue-black (the Tactile Depth graft)
```
--paper:        #14110C   /* warm ink body */
--surface:      #1E1A13   /* warm panel */
--raised:       #262019
--ink:          #F2EDE3   /* warm white */
--ink-2:        #B4AC9B
--ink-3:        #8A8272   /* AA on ink */
--hairline:     rgba(255,255,255,0.09)
--blue:         #8AA6FF   /* interactive/data — bright enough for AA on ink */
--amber:        #F0A63C   /* THE glow: ring/streak/energy — luminous (Tactile Depth soul) */
--amber-soft:   rgba(240,166,60,0.14)
--ok:           #4AC98E   --warn: #E8B24A   --alert: #F0705C
```
High-contrast mode (`[data-contrast=high]`): keep the existing lift (muted→higher, hairline→0.20). AA is a floor in BOTH themes; document ratios per token in globals.css. **Bump the small gray labels** the personas (Carmen/Beto) couldn't read: min body 15px, min label 12px (raise 10/11px sites), muted ≥ AA-comfortable especially in Tinta.

### Default theme
Respect system (`prefers-color-scheme`); ship BOTH exquisite. Toggle in Ajustes persists. (Personas split: trust→light, desire→dark. We win by making both first-class.)

## TYPOGRAPHY — self-hosted (KILL the Google-Fonts CDN import)
- **Display / numerals / headlines: Fraunces** (variable serif) — the voice. Self-host variable woff2, preload. Optical size high on big numerals; tabular lining figures for data. Fallback: Georgia, serif.
- **Body / UI: Inter** — self-host (keep, legible/AA for dense UI + Carmen/Beto). Fallback: system-ui.
- **Micro-labels / units: JetBrains Mono** — self-host (keep; uppercase tracked labels, unit subscripts). Fallback: ui-monospace.
- Bricolage (loaded-but-unused today) → remove. Google CDN `@import` → remove; add `@font-face` from `public/fonts/*.woff2` + `<link rel=preload>`.

### Type scale (replace arbitrary bracket values)
```
display   Fraunces  clamp(56–88px) / 0.95 / -0.02em   (hero numerals: adherencia %, mg)
h1        Fraunces  30px / 1.1 / -0.01em               (screen titles "Reporte de hoy")
h2        Fraunces  22px / 1.15
title     Inter 600 17px / 1.25                        (card titles, peptide names)
body      Inter 400 15px / 1.45                        (min body)
label     Mono 500  12px / 1.3 / 0.08em UPPERCASE      (section/eyebrow labels)
micro     Mono 400  11px                               (units, timestamps — never key info)
num-inline Fraunces tabular for inline metrics (78.4 kg, 7.2 h)
```

## SPACE · RADIUS · ELEVATION
- Space: 4-pt base; page `px-4` (16), section gap 20, card pad 16–20. Generous whitespace (editorial calm).
- Radius (ONE scale — kill the dead duplicate): `sm 10 · md 14 · lg 20 · xl 26 (sheets)`; pills `full`.
- Elevation: paper uses **soft warm shadows + hairline**, not glass-everywhere. Tinta uses **panel + subtle inner-glow + amber glow on active**. Keep the Sheet anti-jank mechanism (blur off during motion). Reserve backdrop-blur for the nav + sheet-settled only.

## MOTION — "number motion" system (the user's explicit ask)
All GPU-only (transform/opacity/pathLength). Reduced-motion → instant/settled. Easing signature: `cubic-bezier(0.16,1,0.3,1)` (editorial ease-out).
- **useCountUp(value, {duration:0.7})** — EVERY hero numeral counts up (adherencia %, mg, kg, streak días, sleep h). Tabular figures so width doesn't jitter. Reduced-motion → final value.
- **Ring draw-on** (keep/enhance): amber arc strokeDashoffset draw ~0.9s + glow intensifies at goal; grafts Living Signal glow + optional Quiet-Instrument tick marks around the rim.
- **Chart path draw**: plasma curves + sparklines animate `pathLength 0→1` staggered; area fills fade in behind. Vida figure draws on entry.
- **Stagger-in** cards/list (staggerChildren ~0.06, y+opacity).
- **Tab transition**: quick cross-fade; FAB persistent; active-tab indicator uses `layoutId`.
- Keep: ambient drift (GPU), reduced-motion short-circuits. Purge the unused `focus-in` blur keyframe (violates "never animate filter").

## INFORMATION ARCHITECTURE — 6 tabs → 5 (+ center capture)
`Inicio · Vida · [ + ] · Diario · Cuerpo`  (FloatingNav rebuilt; center [+] = universal capture sheet: dosis/medida/comida)
- **Inicio (Hoy):** plain hero — next dose line + big adherence numeral (amber ring, count-up) + today's doses + quick metric row + "Ver semana ›". NO plasma chart here.
- **Vida:** TOP = plain-language summary ("Cuánto sigue activo en tu cuerpo ahora") + big readout; BELOW/"ver detalle" = the scientific plasma figure (Rodrigo's depth), framed as *"tu estimación personal"* (NOT clinical). Segmented 24h/72h/7d.
- **[+]:** capture sheet (existing Registrar/Medida/Comida flows, restyled).
- **Diario:** the log/timeline + calendar (serif numerals). Semana folds in as a view here or from Inicio.
- **Cuerpo:** measures/KPIs/trends (peso, sueño, energía…) with sparklines; **Comida** (nutrición) folds in here as a sub-view (or reachable from Inicio's nutrition card + the [+] capture). Perfil/ARCO from here or Ajustes.
- Ajustes reachable from a header affordance (not a tab).
- "Simple mode" still collapses to Inicio/Diario/Cuerpo.

## COMPLIANCE GUARDS (brand judge) — keep gates GREEN
- Vida's scientific-figure styling MUST stay framed as **"tu estimación personal / tus datos"**, never a clinical/device readout. Keep the existing disclaimer near it. This protects the bitácora-not-device boundary + `gate:dosing`.
- No dosing recommendations anywhere (gate:dosing). No BiohackMX/vendor/mint/flask (gate:store, brand separation). es-MX. Honest copy. No syringes/before-after/prices.
- New palette is amber+ink-blue on warm paper/ink — maximally distinct from BiohackMX mint/teal. Ring is amber, NOT teal.

## COMPONENT DISPOSITION (highest-leverage first)
| Component | Action |
|---|---|
| tokens (globals.css) + tailwind.config | REBUILD: Papel+Tinta+high-contrast, self-host fonts, type scale, one radius scale, warm shadows |
| Button | RESTYLE: ink-blue primary (paper) / bright-blue (tinta), pill, press-scale; secondary = outline |
| Card/Glass | RESTYLE: paper→soft-shadow+hairline card; tinta→warm panel+inner-glow. Less "glass everywhere" |
| Ring | ENHANCE: amber arc + glow + count-up + optional tick rim; the signature |
| FloatingNav | REBUILD: 5 tabs + center FAB, active `layoutId`, amber/blue active state |
| Sheet | KEEP mechanism (anti-jank), RESTYLE surface |
| SegmentedTabs, Chip, Stepper, Switch, Toast, DataPlate | RESTYLE to tokens + serif numerals on readouts |
| NEW: `useCountUp` hook, `StatNumber` (serif count-up readout), `Sparkline`/chart draw utils, `TermInfo` (jargon-on-tap `?`), `PlainSummary` (Vida plain header) |
| MultiLineChart / plasma | RESTYLE: editorial figure, path-draw, plain summary above, "ver detalle" gate |

## Fonts to fetch (self-host under public/fonts/)
Fraunces (variable, latin) · Inter (variable or 400/500/600/700, latin) · JetBrains Mono (400/500). woff2 only, `font-display: swap`, subset latin+latin-ext (es-MX). Preload Fraunces + Inter.

---
## VEREDICTO FINAL (revisit Fable-5, 2026-07-17) — LOCKED v2
Head-to-head de 3 contendientes a fidelidad completa (ambos temas). **Ganó "Bitácora Master"** — sus 4 mockups son la REFERENCIA CANÓNICA DE PIXELES: `docs/design-refs/{inicio,vida}-{light,dark}.html` (+ screenshots `_shot-*.png` y `tokens.md`). Ante cualquier duda de ejecución, abrir y COPIAR la referencia.
**Grafts adoptados (añadir al sistema):**
1. **§-folios** (de "Evolved"): etiquetas de sección numeradas `§ 01 ■ ADHERENCIA · …` con tick ámbar — firma editorial propia. Usar en headers de sección de pantallas principales.
2. **Card "Stock bajo"** (del "Challenger"): aviso en Inicio cuando el vial activo de un producto está por agotarse (deriva de vialStock/productRecon existente — mera lectura, sin lógica nueva de dosis). Copy honesto: "Stock bajo: NAD+ (~90 mg restantes). Considera preparar un vial nuevo." — SIN verbos de compra (gate:store).
3. **Chip "Tus datos son tuyos"** (Evolved/Challenger): señal de confianza en el header de Inicio o Perfil → abre el resumen de privacidad.
**Reglas de ejecución de pantallas:** overhaul ESTÉTICO — preservar TODA la funcionalidad, dispatches, semántica de adherencia y copy de compliance. La coherencia interna del reloj (hora del status ≈ countdowns) que muestra la referencia es el estándar de detalle.
