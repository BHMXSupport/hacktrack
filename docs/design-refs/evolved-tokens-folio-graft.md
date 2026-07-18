# Hacktrack — "Almanaque · Tinta & Ámbar" — Token Sheet

**The evolution of Bitácora.** Same validated soul — the editorial "beautiful printed report" that won trust 7/7, the giant serif hero numeral (the sacred brand voice), warm-both-themes, progressive disclosure, the three hard laws. What changed: the accent, the graphic language, and the card language — pushed to something nobody could mistake for another app.

**The one idea:** Hacktrack is your **almanaque personal** — a warm, authored ledger of your own body, set in ink on paper. The interactive/trust color is **Tinta** (a warm ink-indigo — the color of a fountain pen, not a fintech logo). The energy/live color is **Ámbar** (ochre that glows on the warm-dark edition). Data is drawn like an engraved instrument dial and a data-journalism figure — never a dev-tool dashboard.

Why the accent moved: the panel found cobalt "slightly fintech/FT" (Sofía). Orange-as-primary read "warning/food" (Ana). Amber-glow was beloved on dark. So: **Tinta ink-indigo carries trust + all interaction; Ámbar carries energy + the ring + the live plasma signal + streak — never the primary CTA.** Both are miles off the mint/teal band (legal brand separation from BiohackMX). Green + red stay reserved for semantic state only.

---

## 1. Color — Light: "Papel" (default, leads TRUST)

Warm ivory stationery, iron-ink text, ink-indigo spot, ochre energy. Contrast ratios computed by WCAG formula against the surface each token actually sits on.

| Role | Token | Hex | On | Ratio | Note |
|---|---|---|---|---|---|
| Page (paper) | `--paper` | `#F5F1E8` | — | — | warm ivory — the signature surface, faint "laid paper" hairline watermark |
| Well / plot bed | `--paper2` | `#ECE6D8` | — | — | deeper paper for chart beds, meters, operational strips |
| Panel (printed) | `--panel` | `#FCFAF4` | — | — | warm printed-white for framed panels (not stark #FFF) |
| Ink (primary text) | `--ink` | `#191510` | paper | **16.1 : 1** | warm near-black iron ink |
| Ink-2 (secondary) | `--ink2` | `#544B3B` | paper | **7.6 : 1** | subheads, secondary copy |
| Ink-3 (muted/labels) | `--ink3` | `#726853` | paper | **4.9 : 1** | AA+ floor for kickers/captions — never lighten |
| Hairline rule | `--rule` | `#E1D9C8` | — | — | the primary separation device |
| Rule strong | `--rule2` | `#CFC5AF` | — | — | figure frames, dial track, column rules |
| **Oxford rule** | `--rule-ink` | `#191510` | — | — | the thick masthead rule (thick-over-hairline) |
| **Accent — Tinta** | `--tinta` | `#2E3A72` | paper | **9.5 : 1** | trust + ALL interaction (links, CTA fill, active nav, primary series). White-on-tinta CTA = **10.8 : 1** |
| **Energy — Ámbar** | `--ember` | `#B7791F` | — | — | ring arc, live signal, streak, now-dot (graphic use) |
| Ámbar as text | `--ember-ink` | `#8A5510` | paper | **5.5 : 1** | streak label / amber small text (AA) |
| Positive | `--pos` | `#2C7240` | paper | **4.7 : 1** | ▲ deltas (always + ▲/▼ + text) |
| Alert | `--alert` | `#BC3A2E` | paper | **5.0 : 1** | late / adverse (always + icon + text) |

### Chart categorical (peptide series) — Tinta / Ámbar / Claret
The most colorblind-separable warm triad that avoids the mint/teal band entirely. Green + red never used for series.

| Series | Light | Dark | Peptide |
|---|---|---|---|
| Series 1 | `#2E3A72` tinta | `#93A6F2` | BPC-157 |
| Series 2 | `#B7791F` ámbar | `#F2B84A` | Retatrutida |
| Series 3 | `#963D6B` claret | `#E191B8` | NAD+ |

---

## 2. Color — Dark: "Edición nocturna" (leads DESIRE)

Warm charcoal-brown ink (NOT blue-black `#0D1117`) where **Ámbar glows** — the beloved dark accent. Genuinely designed, not an invert: deeper wells, luminous amber ring/now-dot, ink-indigo lifted to periwinkle for interaction.

| Role | Token | Hex | On | Ratio | Note |
|---|---|---|---|---|---|
| Page | `--bg` | `#181510` | — | — | warm brown-black, deliberately not blue-black |
| Well / plot bed | `--bg2` | `#211C15` | — | — | chart beds, operational strips |
| Panel (raised) | `--panel` | `#221D16` | — | — | printed panel, warm |
| Plate (readouts) | `--plate` | `#120F0B` | — | — | opaque well behind critical numbers |
| Text primary | `--text` | `#F3ECDD` | bg | **15.5 : 1** | warm paper-white |
| Text-2 | `--text2` | `#BCB09B` | bg | **8.5 : 1** | secondary |
| Text-3 (muted) | `--text3` | `#93897A` | bg | **5.2 : 1** | AA floor — do not lower |
| Hairline rule | `--rule` | `#342D22` | — | — | |
| Rule strong | `--rule2` | `#463D2E` | — | — | figure frames, dial track |
| Oxford rule | `--rule-ink` | `#5C5140` | — | — | masthead thick rule (dark variant) |
| **Accent — Tinta** | `--tinta` | `#93A6F2` | bg | **7.7 : 1** | periwinkle ink — interaction/links/active nav |
| **Energy — Ámbar** | `--ember` | `#F2B84A` | bg | **10.2 : 1** | luminous — ring, live signal, hero glow number |
| Positive | `--pos` | `#6BBE86` | bg | ~7 : 1 | |
| Alert | `--alert` | `#E9887A` | bg | ~6 : 1 | |

**High-contrast mode:** lifts `--ink3`→`#5F5644` (light) / `--text3`→`#A79C88` (dark), rules to full strength, removes decorative transparency. Reduced-motion → all count-ups/draws settle instantly. Both inherited from the validated system, not regressed. Tap targets ≥ 44 px; muted text AA+.

---

## 3. Typography — the sacred voice, kept and amplified

Three self-hostable families (Google Fonts → subset `.woff2`, `font-display:swap`, **zero CDN / zero render-blocking `@import`**). In the mockups each is approximated with a system stack; the real family is named in a `/* comment */`.

| Family | Real font (self-host) | Mockup fallback | Role |
|---|---|---|---|
| **Display serif** | **Fraunces** (opsz 9–144; soft + wonky axes) | `Georgia, 'Times New Roman', serif` | Screen titles, **ALL hero + KPI numerals**, figure titles. The editorial voice. The **giant serif numeral is sacred — never shrink it.** |
| **Grotesque UI** | **Space Grotesk** | `system-ui, 'Segoe UI', Arial` | Body, buttons, nav, card copy. Technical-editorial; not BiohackMX's Amazing Grotesk/DM Sans. |
| **Mono** | **IBM Plex Mono** | `ui-monospace, 'SF Mono', Menlo` | Folios, kickers (UPPER, tracked), tabular readouts, axis/ticks, timestamps. Ledger-almanac character; the "instrument" equity. |

### Type scale (base 16px) — respects the low-vision law (body ≥ 15, label ≥ 12)

| Token | px / lh / track | Family | Use |
|---|---|---|---|
| `display-xl` | 76 / .90 / −.03em | Fraunces 340, tabular | hero numeral (adherence, mg-in-system, active count) — **sacred** |
| `display` | 34 / 1.0 / −.01em | Fraunces 400 | screen title |
| `stat` | 30 / 1.0 | Fraunces 400, tabular | KPI / figure / mg numbers |
| `title` | 20 / 1.15 | Fraunces 500 | section / figure / peptide titles |
| `body` | 15 / 1.5 | Space Grotesk 400 | primary copy — **floor** |
| `body-sm` | 13 / 1.45 | Space Grotesk 400 | secondary/meta only (never primary) |
| `kicker` | 12 / 1 / +.16em UPPER | IBM Plex Mono 500 | folios, section labels, figure captions — **label floor 12** |
| `readout` | 13 / 1 | IBM Plex Mono 500, tabular | data values, deltas, axis |
| `nav` | 12 / 1 | IBM Plex Mono 500 | tab labels |

Rule: **every numeral is `tabular-nums`** (mono readouts + Fraunces display with tabular figures) so digits never jitter during count-up.

---

## 4. Space · Radius · Elevation

- **Grid & space:** 4px base → `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`. Page padding **20px**. Strong baseline rhythm; generous top margins under folios (editorial breathing room).
- **Radius (near-square, magazine columns):** `xs 3 · sm 6 · md 8 · lg 12 · pill 999`. Panels = **8** (tighter than the old 20–24px glass — reads print, not app). Full-round reserved for the dial, status dots, and the FAB.
- **Elevation = rules, not shadows (signature):**
  - **E0** — content ruled directly on paper, separated by a 1px `--rule` hairline. ~60% of the UI. *The report is the page.*
  - **E1** — letterpress panel (hero, dose, figure): 1px `--rule` frame + a whisper `0 1px 2px rgba(25,21,16,.05)` + a 1px inner top highlight `inset 0 1px 0 rgba(255,255,255,.6)` (light) — the "printed slightly-raised" feel.
  - **E2** — floating chrome (bottom nav, sheets): top hairline + `0 -2px 0 --rule, 0 -10px 30px rgba(25,21,16,.07)`.
  - No glassmorphism, no decorative backdrop-blur. (The Sheet's blur-off-during-motion anti-jank mechanism is retained for that one surface.)
- **Signature textures:** (a) **Oxford double-rule** under every masthead — a 2px ink rule with a hairline 3px below it. (b) **Numbered folios** — `§ 01 · ADHERENCIA` in mono with a 6px Ámbar tick-square, then a hairline that **wipes in** left→right. (c) faint **laid-paper hairline watermark** on the page (≤3% opacity, never touches text contrast). (d) engraved hairline chart grid.

---

## 5. Iconography

Lucide, **1.6px stroke, 20px** default, monochrome ink; Tinta only when active/selected. Icons are sparse — type and numerals carry meaning.
- Compliance-safe metaphors only: **`Droplet`** for doses (never a syringe/needle). **No flask/matraz** (`FlaskConical` dropped — too close to the BiohackMX mark); use `Droplet` / `Activity` / a ring glyph.
- Injection map = abstract vector body with labeled **dots** (shape + color + text recency), never needles.
- The folio + Oxford rule is the "section marker" system — a masthead device replacing an icon-on-every-row.

---

## 6. Motion signature (GPU-only: transform / opacity / pathLength — never blur)

Built on the app's existing `motion.ts` easing `cubic-bezier(0,0,0,1)`; all degrade to instant/fade under `prefers-reduced-motion`.

- **Count-up (the number-motion system):** every hero/KPI numeral counts 0 → value over **0.8s** `cubic-bezier(0,0,0,1)`, `tabular-nums` so width is stable. One `<CountUp value format>` primitive reused for %, mg, kg, ratios, deltas, the active-peptide count. Live values (mg-in-system on Vida) **re-count** as time passes → reads as a live instrument. Reduced-motion sets instantly. *(In the mockups: CSS `@property --n` + `counter()` that settles at the true value, so a screenshot always lands correct.)*
- **The Almanac Dial draw-on (signature ring):** a 30-tick engraved track (hairline `stroke-dasharray`), then a single **Ámbar arc** draws `stroke-dashoffset` full→value (1.0s) with a rounded head-dot at the terminus, paired with the center serif count-up. Subordinate to the big number; the number is the hero, the dial is the instrument face.
- **Rule-wipe (editorial signature):** each folio hairline draws `scaleX 0→1`, origin left, 0.5s — like a masthead rule being printed.
- **Chart draw-on:** plasma curves draw left→right (`pathLength`/dashoffset, 0.9s, staggered per series), area tint fades in behind, the "AHORA" now-dot pops with a spring. This is Vida's hero moment.
- **Meters / AUC bars:** grow from baseline (`scaleX`, origin left), staggered.
- **Page transition:** shared-axis X between the 5 tabs.
- **Press:** unified `whileTap scale .97`. **Haptics** (greenfield): light impact on taps, selection tick on segment/tab change, success on the exact frame the dial hits goal + on dose-confirm; gated by setting, skipped under reduced-motion.

---

## 7. Information architecture — the validated 5-tab (judge-endorsed)

**5 tabs + a center capture FAB.** Panel + judges endorsed this exact split:

`Inicio · Vida · [ ＋ ] · Diario · Cuerpo`

- **Inicio** — today's report: greeting masthead, the Almanac Dial (adherencia + streak), next dose (name/time/site), today's doses checklist, "tus señales" KPI multiples (peso/sueño/energía/ánimo — no jargon), alimentación strip, rotación de sitios.
- **Vida** — first-class tab (not buried): multi-peptide estimated plasma presence. **Leads with progressive disclosure** — one plain es-MX sentence + the big number + per-peptide plain now-values FIRST; the scientific FIG.1 multi-curve figure lives below/behind a "La curva completa" reveal, framed as *"tu estimación personal."* % del pico ⇄ mg toggle, 24h/72h/7d ranges, AUC ("Exposición total") with a tap-explain.
- **[ ＋ ] center FAB** — the one universal `Registrar` (Dosis / Medida / Comida / Nota). Bitácora only: the user types their **own** dose; no suggested/recommended values (LGS — no medical advice).
- **Diario** — the chronological history lens (dose/measure timeline).
- **Cuerpo** — the 34 body/wellness measures, trends, projections.
- Config lives in sheets off the gear.

**Jargon law wired in:** `% del pico`, `AUC`, `t½`/vida media, `mcg` each carry a plain-language label first with a `(?)` tap-explain; "Registrar tarde" replaced with the unambiguous **"Llegué tarde — registrar"**.
