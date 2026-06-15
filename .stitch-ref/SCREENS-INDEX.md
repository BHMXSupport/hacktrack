# Hacktrack Stitch Screens Index

Generated: 2026-06-15  
Project ID: `18133057328669356998`  
Skipped: SVG symbol (`Hacktrack Symbol`), background SVG image, duplicate Ajustes (`b5d90bb1…`)

---

## Global Design System (applies to all screens)

**CSS approach:** Tailwind utility classes via CDN (`cdn.tailwindcss.com?plugins=forms,container-queries`). Custom Tailwind config embedded per-file (no shared CSS file). All screens use Material Symbols Outlined icon font.

**Fonts:**
- `Bricolage Grotesque` — display/headline (display-lg 40px/800, display-lg-mobile 32px/800, display-md 32px/700, headline-sm 24px/700)
- `Inter` — body/title (title-lg 20px/600, body-lg 16px/400, body-md 14px/400)
- `JetBrains Mono` — label-mono (13px/500, tracking 0.02em)

**Color tokens (primary palette):**
- `primary` #00413b, `primary-container` #0e5a52, `primary-fixed` #acefe4, `primary-fixed-dim` #91d3c8
- `surface` #f7f9fc, `surface-container-lowest` #ffffff, `on-surface` #191c1e
- `secondary-container` #fd7958 (coral accent)
- `outline` #6f7977, `outline-variant` #bfc9c6

**Spacing tokens:** base 8px, stack-sm 8px, stack-md 16px, stack-lg 32px, gutter 16px, margin-mobile 20px, card-padding 24px

**Border radius:** DEFAULT 4px, lg 8px, xl 12px, full 9999px; cards commonly use `rounded-[20px]` or `rounded-card` (20px)

**Card shadow:** `0 4px 16px rgba(11,18,32,.08)` — ambient level

**Bottom nav (shared, 4 tabs + FAB):** Tabs: Inicio (`home`), Diario (`edit_note`/`history_edu`), Protocolo (`assignment`/`monitoring`), Ajustes (`settings`). FAB: centered `+` button (primary-container, 56×56px circle, -top-6 breaks plane). Nav height ~80px, `bg-surface-container-lowest`, top shadow.

---

## Screens

---

### 1. splash-screen.html
**Title:** Splash Screen  
**screenId:** `147f97ccdaab41798607b9ccfd433cff`  
**Height:** 1768px | **Width:** 780px

**CSS approach:** Tailwind utilities. Custom `.glow-bg` (radial gradient center) and `.fade-in-up` CSS animation (fadeInUp 1.2s cubic-bezier). Dark mode class-based.

**Sections top-to-bottom:**
1. Full-screen centered `<main>` — `bg-surface`, `glow-bg` radial teal glow from center
2. Logo — 120×120px PNG (base64 embedded Hacktrack symbol), `animate-[pulse_4s_ease-in-out_infinite]`, rounded-lg shadow
3. Wordmark — `<h1>` display-lg-mobile (32px/800): `"Hack"` in `#0B1220` + `"track"` in `primary-container` (#0e5a52)
4. Tagline — body-lg, `#4A5A7A`: `"tu progreso, en una sola pantalla"`

**Copy:**
- Wordmark: "Hacktrack"
- Tagline: "tu progreso, en una sola pantalla"

**Interactive elements:** None (animated logo only). Page title: "Hacktrack - Tu progreso, en una sola pantalla"

---

### 2. onboarding-hacktrack.html
**Title:** Onboarding - Hacktrack  
**screenId:** `956d65a0a155444e98bdd0e0598309cf`  
**Height:** 1768px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode class.

**Sections top-to-bottom:**
1. Header bar — 3-dot progress indicator (first dot wider/active in primary-container, 2 inactive dots in surface-container-highest) + ghost "Saltar" button (primary-container, right)
2. Illustration container — two atmospheric blurred circles (primary-fixed/20 teal, tertiary-fixed/20 lime) + centered `<img>` (Hacktrack symbol SVG from CDN, 280×280px)
3. Content area — sticky bottom white band:
   - Heading display-lg-mobile: `"No vuelvas a fallar tu dosis"`
   - Subtext body-lg on-surface-variant: `"Seguimiento preciso para optimizar tus resultados."`
4. Primary CTA button — 52px height, `bg-primary-container`, `text-on-primary`, rounded-xl, full width: `"Continuar"`

**Copy:**
- Heading: "No vuelvas a fallar tu dosis"
- Sub: "Seguimiento preciso para optimizar tus resultados."
- Primary button: "Continuar"
- Skip: "Saltar"

**Interactive elements:** 3-step dot pagination indicator; "Saltar" ghost button; "Continuar" primary button.

---

### 3. seleccion-de-objetivos.html
**Title:** Selección de Objetivos  
**screenId:** `83cf952286544669b8cd186579eb4e94`  
**Height:** 2212px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode class. Custom category colors added to Tailwind config: `cat-metabolismo` #fd7958, `cat-recuperacion` #9dd584, `cat-cognitivo` #5c6bc0, `cat-piel` #ec407a, `cat-longevidad` #d4af37.

**Sections top-to-bottom:**
1. Top app bar — back arrow button + centered "Hacktrack" in display-md/primary + spacer
2. Page heading block (centered):
   - headline-sm primary: `"¿Qué quieres lograr?"`
   - body-lg on-surface-variant: `"Elige tu enfoque principal para personalizar tu experiencia Hacktrack."`
3. Goal cards grid — `grid-cols-1 md:grid-cols-2 gap-gutter`, 5 cards total. Each card: white bg, border border-surface-variant, rounded-20, card-padding, flex row icon + text. Icon: 48×48 circle with category-color/10 bg + Material Symbol. On hover: border tinted, shadow; on click: `ring-2 ring-primary-fixed bg-surface-bright` active state.
   - "Bajar de peso" (local_fire_department, metabolismo orange) — "Optimiza tu metabolismo y quema de grasa."
   - "Recuperarme mejor" (bedtime, recuperacion green) — "Mejora tu sueño y reduce el estrés físico."
   - "Más energía y foco" (bolt, cognitivo blue) — "Claridad mental y rendimiento cognitivo sostenido."
   - "Cuidar mi piel" (face, piel pink) — "Salud dermatológica desde adentro hacia afuera."
   - "Longevidad" (spa, longevidad gold, md:col-span-2) — "Prácticas para una vida más larga y saludable."
4. CTA + disclaimer:
   - Primary button 52px: `"Continuar"` (full width mobile, auto desktop)
   - Caption: `"Podrás ajustar esto más adelante en tu perfil."`

**Copy:**
- Page title: "¿Qué quieres lograr?"
- Primary button: "Continuar"
- Disclaimer: "Podrás ajustar esto más adelante en tu perfil."

**Interactive elements:** 5 selectable goal cards (JS single-select toggle); "Continuar" button; back arrow.

---

### 4. crear-cuenta-hacktrack.html
**Title:** Crear cuenta - Hacktrack  
**screenId:** `6cf1d40917d74c3ba4b9cc1ba847898c`  
**Height:** 2032px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode class. Custom `boxShadow.level-1` / `level-2`. viewport-fit=cover, user-scalable=no.

**Sections top-to-bottom:**
1. Header — centered logo: `monitoring` icon (filled) + "Hacktrack" in display-md/primary
2. Page heading — display-lg-mobile: `"Crea tu cuenta"`
3. BiohackMX highlighted card — white bg, `border-primary/20`, rounded-[20px], shadow-level-1. Top accent gradient bar (primary-container → primary-fixed). Icon `hub` (filled). Title: `"Únete con BiohackMX"`. Body: `"Trae tus productos comprados de inmediato. Inicias sesión en su sitio, nosotros nunca vemos tu contraseña."`. CTA button 52px: `"Conectar con BiohackMX"` (link icon)
4. Divider — `"o crea tu cuenta en Hacktrack"`
5. Social buttons row — Apple + Google (equal width, white bg, border, rounded-[16px])
6. Email/password form:
   - `Correo electrónico` input (type=email, placeholder "tu@correo.com")
   - `Contraseña` input (type=password, visibility toggle button)
   - Submit: `"Crear cuenta"` 52px primary-container
7. Footer:
   - Link: `"¿Ya tengo cuenta? Iniciar sesión"` (primary-container)
   - Legal copy (12px): `"Al crear una cuenta, aceptas nuestra Política de Privacidad y confirmas que has leído el Aviso de Privacidad (LFPDPPP) para el manejo seguro de tus datos personales en México."`

**Copy:**
- Highlighted CTA: "Conectar con BiohackMX"
- Form CTA: "Crear cuenta"
- Link: "¿Ya tengo cuenta? Iniciar sesión"
- Legal: "…Aviso de Privacidad (LFPDPPP)…"

**Interactive elements:** BiohackMX connect button; Apple/Google OAuth buttons; email/password form with password visibility toggle; submit button; sign-in link.

---

### 5. importar-de-tienda-asociada-hacktrack.html
**Title:** Importar de tienda asociada - Hacktrack  
**screenId:** `e96d050e6a0f4a58bb20d8b71d3cb20e`  
**Height:** 1992px | **Width:** 780px

**CSS approach:** Tailwind utilities. Custom `.soft-card-shadow` class.

**Sections top-to-bottom:**
1. Top app bar — back arrow + headline-sm: `"Importar productos"`
2. Explainer info card — white rounded-[20px], info icon, body-lg on-surface-variant: `"Puedes importar una orden para precargar tus productos; tú traes tus datos. Este paso es opcional."`
3. Illustration image — 16:9 aspect, workspace photo (CDN)
4. Form:
   - `Correo electrónico` — email input, placeholder "ejemplo@correo.com"
   - `Número de orden` — text input, shown in **error state** (border-error), value "HT-99821", error message: `"Orden no encontrada"` (error icon + text)
   - Consent checkbox: `"Doy mi consentimiento para transferir los datos de mi orden de forma segura."`
5. Action buttons (stacked):
   - Primary: `"Importar orden"` (sync_alt icon, bg-primary #00413b)
   - Secondary outline: `"Lo agrego manualmente"`
6. Bottom nav (4 tabs, no FAB, Protocolo active)

**Copy:**
- Primary button: "Importar orden"
- Secondary: "Lo agrego manualmente"
- Error: "Orden no encontrada"
- Consent: "Doy mi consentimiento para transferir los datos de mi orden de forma segura."
- Info: "Este paso es opcional."

**Interactive elements:** Email + order number inputs; consent checkbox; error state on order field (JS clears error on change); "Importar orden" button; "Lo agrego manualmente" button; bottom nav.

---

### 6. inicio-hacktrack.html
**Title:** Inicio - Hacktrack  
**screenId:** `1afb41d96e144a0985b33e105acc4c23`  
**Height:** 1780px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode. Custom `.ring-track`, `.ring-progress` CSS for SVG adherence ring (stroke-dasharray animation with stroke-dashoffset, 1.5s ease-out transition).

**Sections top-to-bottom:**
1. Top app bar (mobile) — bubble_chart icon + "Hacktrack" wordmark + notifications bell button (right). Desktop version: full nav links.
2. Header section — headline-sm: `"¡Hola! Tu progreso hoy"`, body-lg date: `"Lunes, 24 de Octubre"`
3. Adherence ring card — white rounded-[20px] shadow, organic blur decoration top-right:
   - SVG ring (r=65, teal→lime gradient `#0E5A52` → `#b8f29e`, 85% fill = dashoffset 61)
   - Center: display-md `"85%"` + label-mono `"CUMPLIMIENTO"`
   - Coaching chip: trending_up icon (tertiary-fixed bg) + body-md: `"Vas por buen camino. Tu recuperación ha mejorado un 12% esta semana."`
4. Bento grid (2×2, gap-gutter):
   - "Energía" card — bolt icon (secondary-container/coral), display-md `"Alto"`, sparkline SVG (coral #fd7958)
   - "Sueño" card — bedtime icon (tertiary), display-md `"7h 15m"`, sparkline SVG (green #114302)
5. Quick action button — 52px full width, primary-container: `"Registrar métrica"` (add_circle icon)
6. Bottom nav (Inicio active, FAB center)

**Copy:**
- Header: "¡Hola! Tu progreso hoy"
- Coaching: "Vas por buen camino. Tu recuperación ha mejorado un 12% esta semana."
- Primary button: "Registrar métrica"

**Interactive elements:** Notifications button; adherence ring (CSS animation on load); bento cards (hover lift translate-y-1); "Registrar métrica" button; bottom nav.

---

### 7. inicio-tablero-de-control.html
**Title:** Inicio - Tablero de Control  
**screenId:** `a5f067b1e17e469b99baccdfa279d305`  
**Height:** 2648px | **Width:** 780px

**CSS approach:** Tailwind utilities. Custom `hacktrack-coral` #FF7A59, `hacktrack-metabolism` #E85D3A, `hacktrack-recovery` #2FB57C, `hacktrack-lime` #B6F09C, `hacktrack-dark` #0B1220. Custom shadow tokens `card-ambient` / `modal-elevated`. `.card-hover` active:scale-0.98 micro-interaction.

**Sections top-to-bottom:**
1. Desktop-only sticky header — avatar + "Hacktrack" + notifications button (hidden on mobile)
2. Mobile greeting section:
   - date body-md outline: `"Lunes, 24 de Mayo"`
   - display-lg-mobile on-surface: `"Hola, Alejandro"`
   - category pill: metabolism dot + `"Metabolismo"` (hacktrack-metabolism color)
   - avatar (top-right, 56×56px circle, mobile only)
3. "Próxima toma" card — white rounded-card shadow, decorative quadrant shape top-right:
   - Row: schedule icon + label-mono uppercase `"PRÓXIMA TOMA"` + `"En 2h 15m"` (right)
   - Product: headline-sm `"Vitamina D3 + K2"`
   - Subtext: `"Protocolo Inmune Matutino"`
   - CTA 52px: `"Registrar"` (check_circle icon, primary-container)
4. Adherence ring section:
   - title-lg centered: `"Adherencia Semanal"`
   - SVG ring 192×192px, gradient #0E5A52→#B6F09C, dashoffset for 85%
   - Center: JetBrains Mono 48px `"85%"`
   - Caption: `"Vas por buen camino, mantén el ritmo hoy."`
5. KPI cards grid (2-col, gap-gutter):
   - "Glucosa" — water_drop icon (hacktrack-metabolism), 32px mono `"92"` + `"mg/dL"`, sparkline SVG (#E85D3A)
   - "Sueño" — bed icon (hacktrack-recovery), 32px mono `"7.2"` + `"hrs"`, sparkline SVG (#2FB57C)
6. "Peso Corporal" line chart card — title-lg `"Peso Corporal"` + `"Tus datos (30d)"`, SVG smooth line (#0E5A52 with gradient fill), x-axis labels "1 May" → "Hoy"
7. Bottom nav (Inicio active, 5 slots with center FAB spacer)

**Copy:**
- Greeting: "Hola, Alejandro"
- Next dose: "Próxima toma" / "En 2h 15m" / "Vitamina D3 + K2" / "Protocolo Inmune Matutino"
- CTA: "Registrar"
- Adherence: "Adherencia Semanal" / "85%" / "Vas por buen camino, mantén el ritmo hoy."
- KPI labels: "Glucosa", "Sueño", "Peso Corporal"

**Interactive elements:** "Registrar" button on próxima-toma card; bottom nav; all cards have card-hover active scale.

---

### 8. diario-hacktrack.html
**Title:** Diario - Hacktrack  
**screenId:** `9733c4ea74f04d5cbbf4699babcd7a88`  
**Height:** 2108px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode class. Scroll event listener adds shadow to top app bar on scroll.

**Sections top-to-bottom:**
1. Top app bar (sticky) — bubble_chart icon + "Hacktrack" + desktop nav links. Mobile: no extra buttons.
2. Desktop desktop nav tabs: Inicio / **Diario** (active, primary semibold) / Protocolo / Ajustes + "+" button (primary-container, right, desktop only)
3. Page header:
   - display-md/display-lg-mobile: `"Tu Diario"`
   - body-lg on-surface-variant: `"Hoy, 24 de Octubre"`
4. Timeline section — vertical line (2px, surface-container-high, left-[39px]) with 4 entries:
   - **08:30** — "Registro de dosis" card (node: secondary-container dot). Chip: "Metabolismo" (orange #ffdad2/862208). Item: "L-Theanine 200mg"
   - **10:00** — "Entrenamiento completado" card (node: tertiary-container dot). Chip: "Físico" (tertiary-fixed bg). Item: "Zona 2 - 45 min"
   - **14:15** — "Comida principal" card (node: outline-variant dot). Chip: "Nutrición" (surface-container). Item: "Alto en proteína, sin procesados". Photo thumbnail (h-32, CDN food image).
   - **22:15** — Dashed empty slot (opacity-60): `"Añadir registro nocturno"` (add_circle icon, dashed border)
5. Bottom nav (Diario active, FAB center breaking the plane)

**Copy:**
- Page title: "Tu Diario"
- Date: "Hoy, 24 de Octubre"
- Timeline entries: "Registro de dosis", "Entrenamiento completado", "Comida principal", "Añadir registro nocturno"

**Interactive elements:** Each card has more_horiz overflow menu icon; empty slot is clickable "add" prompt; FAB (+); bottom nav with scroll-shadow JS.

---

### 9. protocolo-hacktrack.html
**Title:** Protocolo - Hacktrack  
**screenId:** `66a0f1a7e5f544adb191224715f3dbb4`  
**Height:** 2322px | **Width:** 780px

**CSS approach:** Tailwind utilities. Extra brand color tokens: `brand-recovery` #2FB57C, `brand-metabolism` #E85D3A, `brand-cognitive` #6B7BE8, `brand-aging` #A8842F, `brand-ember` #FF7A59. Custom shadow: `ambient` 0 4px 16px / `modal` 0 12px 32px.

**Sections top-to-bottom:**
1. Top app bar — bubble_chart icon + "Hacktrack" + account_circle avatar button (right)
2. Page heading:
   - display-md: `"Protocolo de Bienestar"`
   - body-lg: `"Tu estado actual y plan de acción."`
3. Recovery line chart card — white rounded-card shadow:
   - Header: title-lg `"Recuperación"` + label-mono `"ÚLTIMOS 7 DÍAS"` + badge `"+12%"` (trending_up, brand-recovery, #EBF8F2 bg)
   - SVG smooth line chart (h-40, viewbox 400×120), gradient fill brand-recovery/15→0, white dots on data points, x-axis L/M/X/J/V/S/D labels
4. Focus areas section:
   - title-lg: `"Áreas de Enfoque"`
   - Pill chips row: "Metabolismo" (#FDF0EC/#FADBD2 border, brand-metabolism dot), "Cognitivo" (#F1F3FD, brand-cognitive), "Anti-Aging" (#F8F5EE, brand-aging), "Físico" (primary-fixed bg)
   - Cards grid (1 col mobile / 2 col desktop):
     - "Ayuno Intermitente" — fire icon (metabolism), "16:8 Objetivo diario alcanzado." chevron right
     - "Enfoque Profundo" — psychology icon (cognitive), "2h 45m registrados hoy." chevron right
5. Conversion CTA — centered: `"Optimizar protocolo"` 52px, `bg-brand-ember` (#FF7A59), text `#1A0C09`, tune icon (filled), rounded-2xl, w-full mobile / auto desktop
6. Bottom nav (Protocolo active, FAB center)

**Copy:**
- Page title: "Protocolo de Bienestar"
- Sub: "Tu estado actual y plan de acción."
- Recovery badge: "+12%"
- CTA: "Optimizar protocolo"
- Cards: "Ayuno Intermitente — 16:8 Objetivo diario alcanzado." / "Enfoque Profundo — 2h 45m registrados hoy."

**Interactive elements:** Category cards (clickable, hover:bg-surface-bright, chevron); "Optimizar protocolo" CTA; bottom nav.

---

### 10. nuevo-registro-hacktrack.html
**Title:** Nuevo Registro - Hacktrack  
**screenId:** `8d1384e5d99749d3bc15e9ace7b0b8be`  
**Height:** 1864px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode class. Custom CSS removes number input spinners. No bottom nav (transactional screen).

**Sections top-to-bottom:**
1. Top app bar — back arrow (primary) + centered display-md `"Nuevo Registro"` + spacer
2. Category selector section:
   - title-lg: `"Categoría"`
   - Chip row (flex-wrap): `"Piel"` (SELECTED: primary-fixed bg, on-primary-fixed-variant text) | `"Crecimiento"` | `"Nutrición"` | `"Actividad"` (unselected: white bg, outline-variant border)
3. Numeric quantity input section:
   - title-lg: `"Cantidad"`
   - Large input card (rounded-[20px], subtle gradient bg, primary-fixed/5):
     - 64px JetBrains Mono number input (value: 1), `"unidades"` label
     - +/- stepper buttons (44×44px circles, surface-container bg)
4. Notes section:
   - title-lg: `"Notas (Opcional)"`
   - Textarea 3 rows, placeholder: `"Añade detalles sobre este registro…"`
5. Primary action button (bottom, mt-auto):
   - 52px, primary-container, `"Guardar registro"` + check icon

**Copy:**
- Section labels: "Categoría", "Cantidad", "Notas (Opcional)"
- Category chips: "Piel", "Crecimiento", "Nutrición", "Actividad"
- Quantity unit: "unidades"
- Notes placeholder: "Añade detalles sobre este registro..."
- CTA: "Guardar registro"

**Interactive elements:** Category chips (JS single-select); ±stepper buttons (stepUp/stepDown on number input); notes textarea; "Guardar registro" submit.

---

### 11. registrar-dosis-hacktrack.html
**Title:** Registrar Dosis - Hacktrack  
**screenId:** `e9616de57b4343edb2729e3438fe828d`  
**Height:** 1768px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode. This is the **bottom sheet** entry-point state (sheet at full height with dimmed overlay).

**Sections top-to-bottom:**
1. Dimmed overlay — `bg-on-surface/40`, fixed inset-0, z-40
2. Bottom sheet (fixed bottom, rounded-t-[20px], h-795px, shadow `-12px 32px`):
   - Drag handle bar (48px w, 6px h, outline-variant, rounded-full)
   - Header row: spacer + headline-sm `"Registrar"` + close (×) button
3. Scrollable sheet content:
   - **Producto** — display row: eco icon (filled, primary-container/10 bg) + `"Extracto de Melena de León"` + `"Cambiar"` link (primary-container)
   - **Cadence segmented control** — 4-segment pill: `"Por día"` (active, white shadow) | `"Semana"` | `"Mes"` | `"Por uso"`; weekday chips row: L M X J (active/primary-container) | V S D (inactive/surface-container-high)
   - **Dose input** — minus button (56px circle border) + 32px display-lg-mobile input (value: 500) + `"mg"` pill (surface-container-low) + plus button
   - **"Calculadora de unidades"** link (calculate icon + expand_more)
   - **Hora de registro** — text input value `"Ahora"` (schedule icon left)
4. Fixed bottom CTA (gradient fade bg): `"Guardar registro"` 52px primary-container (check icon, animated: text collapses icon scales on click)

**Copy:**
- Sheet title: "Registrar"
- Product: "Extracto de Melena de León" / "Cambiar"
- Cadence: "Por día", "Semana", "Mes", "Por uso"
- Weekdays: L, M, X, J, V, S, D
- Unit: "mg"
- Time: "Ahora"
- Link: "Calculadora de unidades"
- CTA: "Guardar registro"

**Interactive elements:** Close (×) button; product "Cambiar"; 4-segment cadence control; 7 weekday toggles; ±dose buttons + editable input; unit calculator link; time field; animated "Guardar registro" (text slides out, icon scales up, resets after 2s).

---

### 12. registrar-dosis-confirmacion-hacktrack.html
**Title:** Registrar Dosis (Confirmación) - Hacktrack  
**screenId:** `e0ce6942210b4237950a359ebc3eddfc`  
**Height:** 1768px | **Width:** 780px

**CSS approach:** Tailwind utilities. Light mode. viewport-fit=cover.

**Note:** This screen is **identical in HTML structure** to `registrar-dosis-hacktrack.html` (same bottom sheet layout, same content, same script for the animated save button). This appears to be the **confirmation state** of the same bottom sheet. The only difference: the save button JS animation resets after 2s (no dedicated confirmation state visible in markup — likely the animated `check` icon IS the confirmation micro-interaction).

Sections, copy, and interactions: same as screen #11 above.

---

### 13. ajustes-hacktrack.html
**Title:** Ajustes - Hacktrack  
**screenId:** `f1d82dbba53648c1938270b7889ef554`  
**Height:** 2164px | **Width:** 780px

**CSS approach:** Tailwind utilities. Custom `.toggle-teal` CSS toggle (44×24px, active bg #0E5A52, `.toggle-dot` 18×18px white circle slides 20px). `-webkit-tap-highlight-color: transparent`. Safe-area padding for bottom.

**Sections top-to-bottom:**
1. Sticky header — display-md `"Ajustes"` (left) + avatar circle (right, primary-fixed bg, 40×40px profile photo)
2. **Recordatorios** section (grouped card, rounded-[20px]):
   - "Recordatorio de registro" row — alarm icon, label `"Recordatorio de registro"`, sub `"Es hora de tu registro de hoy"`, time badge `"08:00"` (label-mono, primary-fixed bg) — tappable full row
   - "Resumen semanal" — auto_graph icon + toggle (ACTIVE/ON state)
   - "Avisos por correo" — mail icon + toggle (OFF state)
3. **Apariencia** section (grouped card):
   - "Tema oscuro" — dark_mode icon + toggle (OFF)
   - "Unidades" — straighten icon + chevron_right
4. **Cuenta** section (grouped card):
   - "Importar de tienda asociada" — sync icon + chevron (→ importar screen)
   - "Perfil y privacidad" — lock icon + chevron (→ perfil screen)
   - "Cerrar sesión" — logout icon (text-error, red, hover:bg-red-50)
5. Decorative image — h-48 rounded-[20px], landscape wellness photo (CDN), gradient overlay (primary/60), caption: `"Tu progreso es constante."` + `"Continúa optimizando tu rutina día con día."`
6. FAB — fixed bottom-24, bg-surface-tint #246960 (56×56px circle, add icon, outside bottom nav)
7. Bottom nav (Ajustes active)

**Copy:**
- Section headers: "Recordatorios", "Apariencia", "Cuenta"
- Reminder row: "Es hora de tu registro de hoy"
- Rows: "Resumen semanal", "Avisos por correo", "Tema oscuro", "Unidades", "Importar de tienda asociada", "Perfil y privacidad", "Cerrar sesión"
- Image caption: "Tu progreso es constante. / Continúa optimizando tu rutina día con día."

**Interactive elements:** Reminder row (tappable to edit time); 3 custom toggle switches (JS inline classList toggle); "Unidades" chevron row; 3 account rows; "Cerrar sesión" destructive row; FAB; bottom nav.

---

### 14. perfil-y-privacidad-hacktrack.html
**Title:** Perfil y privacidad - Hacktrack  
**screenId:** `1195c2c59c014855843a0e7b14f67c9e`  
**Height:** 2756px | **Width:** 780px

**CSS approach:** Tailwind utilities. Custom `.active-icon` (FILL: 1). Scroll elevation on header (JS adds shadow + bg-white on scrollY > 10).

**Sections top-to-bottom:**
1. Sticky header — back arrow + display-md `"Perfil y privacidad"` + notifications bell
2. Profile header (centered):
   - 96×96px avatar circle (border-4 surface-container), edit button overlay (primary bg)
   - display-md `"Alejandro"` + body-md outline `"Miembro desde 2023"`
3. **Privacidad y datos** section (grouped card rounded-card):
   - "Estado de consentimiento" — verified_user icon, label, sub `"v1.0 — activo"`, chevron
   - "Derechos ARCO" — policy icon, chevron
   - "Descargar mis datos (Acceso)" — download icon, chevron
   - "Corregir mis datos (Rectificación)" — edit_square icon, chevron
   - "Gestionar consentimiento (Oposición / Cancelación)" — settings_accessibility icon, chevron
   - "Aviso de privacidad" — visibility icon, chevron
4. **Cuenta** section (grouped card):
   - "Información personal" — person_outline icon, chevron
   - "Seguridad y contraseña" — lock_open icon, chevron
5. Footer:
   - Compliance badge: security icon (filled) + `"Hecho en México · Cumple con LFPDPPP"` (label-mono, rounded-full pill)
   - `"Borrar mi cuenta"` button (delete_forever icon, #E4564B red text, hover:bg-red-50)
6. Bottom nav (Ajustes active, no FAB, 4-tab variant)

**Copy:**
- Page title: "Perfil y privacidad"
- User: "Alejandro" / "Miembro desde 2023"
- ARCO rows: "Estado de consentimiento (v1.0 — activo)", "Derechos ARCO", "Descargar mis datos (Acceso)", "Corregir mis datos (Rectificación)", "Gestionar consentimiento (Oposición / Cancelación)", "Aviso de privacidad"
- Compliance badge: "Hecho en México · Cumple con LFPDPPP"
- Destructive: "Borrar mi cuenta"

**Interactive elements:** Back arrow; edit avatar button; 6 privacy/ARCO rows (all tappable with scale feedback); 2 account rows; "Borrar mi cuenta" destructive button; bottom nav (Ajustes active). Note: No FAB on this screen.

---

### 15. hacktrack-plus.html
**Title:** Hacktrack Plus  
**screenId:** `009f1e42af794bffac9d9b7b598d3f19`  
**Height:** 2166px | **Width:** 780px

**CSS approach:** Tailwind utilities. Custom `.soft-shadow`, `.active-pill` (bg #00413b, text white), `.inactive-pill` (text #3f4947), `.bg-conversion` (#fd7958). No bottom nav (focused upgrade flow).

**Sections top-to-bottom:**
1. Top app bar — close (×) button + title-lg `"Upgrade to Plus"` (primary) + spacer
2. Hero section:
   - display-lg-mobile `"Eleva tu seguimiento con Plus"` (primary, centered, px-4)
   - h-48 hero image (abstract green/lime organic waves, CDN)
3. Pricing toggle:
   - Segmented pill: `"Mensual"` (active) | `"Anual"` (with `"SAVE 20%"` badge on tertiary-fixed bg)
   - Price: display-md `"$99/mes"` (JS updates to `"$799/año"` on annual)
4. Comparison table (rounded-card, border, soft-shadow):
   - Header row: "Beneficios" | "Gratis" | "Plus"
   - Row 1: "Resumen semanal" — check | done_all
   - Row 2: "Historial 30d vs 90d+" — check | done_all
   - Row 3: "Multi-protocolo" — horizontal_rule (none) | done_all
   - Footer band (primary-container/5 bg): italic `"Y mucho más: exportación de datos, perspectivas premium..."`
5. CTA cluster:
   - Primary: `"Probar Plus"` 52px, `bg-secondary-container` (#fd7958 coral), `text-on-secondary-container`, rounded-card
   - Secondary outline: `"Quizás después"` (border-primary, text-primary)
   - Text link: `"Restaurar compra"`
   - Legal: 12px `"Al suscribirte, aceptas nuestros Términos de Servicio y Política de Privacidad. La suscripción se renovará automáticamente."`

**Copy:**
- Page: "Upgrade to Plus" (note: en, not es — likely intentional)
- Hero: "Eleva tu seguimiento con Plus"
- Prices: "$99/mes" (monthly) / "$799/año" (annual)
- Table: "Resumen semanal", "Historial 30d vs 90d+", "Multi-protocolo"
- Primary CTA: "Probar Plus"
- Secondary: "Quizás después"
- Link: "Restaurar compra"
- Legal: "…La suscripción se renovará automáticamente."

**Interactive elements:** Close (×); segmented pricing toggle (JS swaps price + pill styles); "Probar Plus" CTA; "Quizás después"; "Restaurar compra" link.

---

## Summary Table

| # | Filename | Title | screenId | Height |
|---|----------|-------|----------|--------|
| 1 | splash-screen.html | Splash Screen | 147f97cc… | 1768px |
| 2 | onboarding-hacktrack.html | Onboarding | 956d65a0… | 1768px |
| 3 | seleccion-de-objetivos.html | Selección de Objetivos | 83cf9522… | 2212px |
| 4 | crear-cuenta-hacktrack.html | Crear cuenta | 6cf1d409… | 2032px |
| 5 | importar-de-tienda-asociada-hacktrack.html | Importar de tienda asociada | e96d050e… | 1992px |
| 6 | inicio-hacktrack.html | Inicio (simple) | 1afb41d9… | 1780px |
| 7 | inicio-tablero-de-control.html | Inicio — Tablero de Control | a5f067b1… | 2648px |
| 8 | diario-hacktrack.html | Diario | 9733c4ea… | 2108px |
| 9 | protocolo-hacktrack.html | Protocolo | 66a0f1a7… | 2322px |
| 10 | nuevo-registro-hacktrack.html | Nuevo Registro | 8d1384e5… | 1864px |
| 11 | registrar-dosis-hacktrack.html | Registrar Dosis (sheet) | e9616de5… | 1768px |
| 12 | registrar-dosis-confirmacion-hacktrack.html | Registrar Dosis (Confirmación) | e0ce6942… | 1768px |
| 13 | ajustes-hacktrack.html | Ajustes | f1d82dbb… | 2164px |
| 14 | perfil-y-privacidad-hacktrack.html | Perfil y privacidad | 1195c2c5… | 2756px |
| 15 | hacktrack-plus.html | Hacktrack Plus | 009f1e42… | 2166px |

## Skipped

| Reason | screenId | Title |
|--------|----------|-------|
| SVG symbol (image/svg+xml) | 6c68c127… | Hacktrack Symbol |
| Background image (no htmlCode) | b99eae06… | Soft wave pattern |
| Duplicate Ajustes (skipped per instructions) | b5d90bb1… | Ajustes - Hacktrack |
