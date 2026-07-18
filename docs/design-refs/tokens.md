# Bitácora — Token Sheet (master execution)

> **Bitácora** = tu bitácora de salud, maquetada como un reporte impreso cálido.
> Papel-y-tinta editorial + numerales serif expresivos como voz + un **dial ámbar
> con ticks de instrumento**. Dos temas de primera clase: **Papel** (claro, gana
> confianza) y **Tinta** (cálido-oscuro, gana deseo). Nada que se lea como
> BiohackMX: sin menta, sin teal, sin matraz.

Two accents, two jobs, everywhere:
- **Tinta azul** — confianza + todo lo interactivo/enlaces (fountain-pen ink blue, warmer & more characterful than cobalt so it never reads "fintech/FT").
- **Ámbar** — energía + el anillo/dial + "tu atención aquí / ahora". Luminoso en Tinta, tostado en Papel (para sostener contraste sobre papel claro).

State is **never color-alone**: forma/ícono + texto + color (`●◐○`).

---

## 1. Color — tema **Papel** (claro, por defecto, líder de confianza)

Contrast ratios computed with the WCAG formula against the surface each token sits on (`--paper` unless noted). AA text = 4.5:1, AA large/UI = 3:1.

| Rol | Token | Hex | Contraste | Uso |
|---|---|---|---|---|
| Papel (fondo) | `--paper` | `#F6F2EA` | — | superficie firma, marfil cálido |
| Papel-2 (lecho) | `--paper-2` | `#EFE9DC` | — | camas de gráfica, pistas de anillo, wells |
| Columna (card) | `--column` | `#FFFFFF` | — | "columna impresa" nítida sobre papel |
| Tinta (texto) | `--ink` | `#1A1712` | **16.0:1** | texto y numerales — casi-negro cálido |
| Tinta-2 (secundario) | `--ink-2` | `#57503F` | **7.4:1** | copy secundaria |
| Tinta-3 (labels/mudo) | `--ink-3` | `#6E6656` | **5.1:1** | kickers, captions, labels ≥12px (piso AA+; low-vision) |
| Tinta-4 (decorativo) | `--ink-4` | `#9A9788` | ~3:1 | **solo ticks/no-texto** |
| Hairline | `--rule` | `#E4DDCE` | — | separador primario (no sombra) |
| Hairline fuerte | `--rule-2` | `#D4CBB7` | — | divisores de sección, marcos de figura |
| **Tinta azul** (accent) | `--blue` | `#2C46C9` | **6.7:1** | interactivo, links, series 1, meter |
| Tinta azul fuerte | `--blue-ink` | `#2438A8` | **8.5:1** | texto-accent ≤14px |
| **Ámbar** (dial/energía) | `--amber` | `#C87A16` | **3.0:1** | relleno del arco/dial (elemento gráfico ≥3:1) |
| Ámbar punta (aguja) | `--amber-tip` | `#E8912B` | 2.2:1 | punta-aguja del dial (marca gráfica, pareada con numeral tinta) |
| Ámbar texto | `--amber-ink` | `#9A5A0A` | **4.6:1** | ámbar cuando debe ser texto AA |
| Positivo | `--pos` | `#2E7D46` | **4.9:1** | deltas ▲ (siempre con flecha + texto) |
| Alerta | `--alert` | `#C4342A` | **5.4:1** | tarde/negativo (siempre con ícono + texto) |

**Nota de honestidad sobre el ámbar en Papel:** el ámbar es intrínsecamente claro;
sobre `#F6F2EA` un ámbar luminoso caería <3:1. Por eso en Papel el **arco del dial**
usa `--amber` `#C87A16` (**3.0:1**, elemento gráfico grande — cumple UI 3:1) con la
**punta** más viva `#E8912B` para calidez; el **numeral central es tinta** (16:1) y
carga todo el contraste de lectura. Ningún texto crítico depende del ámbar salvo
`--amber-ink` (4.6:1). En Tinta el ámbar sí es luminoso (ver §2).

### Series de péptidos — Papel (azul / oro / violeta; el triádico más colorblind-safe, ninguno teal)
| Serie | Hex | Contraste (línea, ≥3:1) | Péptido |
|---|---|---|---|
| Serie 1 | `#2C46C9` azul | 6.7:1 | BPC-157 |
| Serie 2 | `#B5731A` oro | 3.5:1 | Retatrutida |
| Serie 3 | `#6D3FD1` violeta | 5.7:1 | NAD+ |

Verde + rojo quedan **reservados a estado semántico**, nunca a series.

---

## 2. Color — tema **Tinta** (cálido-oscuro, líder de deseo)

Carbón **cálido brown-black**, deliberadamente *no* `#0D1117` azulado. El ámbar
**glow-ea** aquí (es lo que hace que Diego lo postee). Contrastes vs `--bg` salvo nota.

| Rol | Token | Hex | Contraste | Uso |
|---|---|---|---|---|
| Fondo | `--bg` | `#17140E` | — | tinta cálida (brown-black) |
| Lecho / plot | `--bg-2` | `#1E190F` | — | cama de gráfica |
| Columna (card) | `--column` | `#241E14` | — | superficie elevada cálida |
| Placa (readouts) | `--plate` | `#110E09` | — | well opaco bajo números críticos |
| Texto primario | `--ink` | `#F3EDDF` | **15.7:1** | blanco-papel cálido |
| Texto-2 | `--ink-2` | `#C7BBA4` | **9.7:1** | secundario |
| Texto-3 (mudo) | `--ink-3` | `#98907E` | **5.8:1** | labels/captions ≥12px (AA+, low-vision) |
| Tinta-4 (decorativo) | `--ink-4` | `#6C6656` | ~3:1 | **solo ticks del bezel / no-texto** |
| Hairline | `--rule` | `rgba(243,237,223,.10)` | — | retícula |
| Hairline fuerte | `--rule-2` | `rgba(243,237,223,.16)` | — | divisores |
| **Tinta azul** (accent) | `--blue` | `#7E97FF` | **6.8:1** | interactivo, links, serie 1 |
| **Ámbar** (dial/energía) | `--amber` | `#F3A93C` | **9.2:1** | arco del dial, aguja, energía — **luminoso** |
| Ámbar glow | `--amber-glow` | `rgba(243,169,60,.45)` | — | `box/text-shadow` bloom del dial (ganado por el dato) |
| Positivo | `--pos` | `#63C88C` | **8.2:1** | deltas ▲ |
| Alerta | `--alert` | `#F0776A` | **6.1:1** | tarde/adverso |

### Series de péptidos — Tinta (luminosas, nunca menta)
| Serie | Hex | Péptido |
|---|---|---|
| Serie 1 | `#7E97FF` azul | BPC-157 |
| Serie 2 | `#F3B84E` oro | Retatrutida |
| Serie 3 | `#B79BF2` violeta | NAD+ |

### Alto contraste (ambos temas)
`--ink-3` sube al nivel de `--ink-2`; hairlines a fuerza plena; transparencias reducidas.
Heredado íntegro del stack de accesibilidad actual.

---

## 3. Tipografía (fuentes reales, self-hostables)

Tres familias, todas Google Fonts descargables como subset `.woff2` + `font-display: swap`
(**cero CDN, cero `@import` render-blocking**). En los HTML se aproximan con stack de
sistema y la real va comentada.

| Familia | Fuente real | Aproximación en mockup | Rol |
|---|---|---|---|
| **Display serif** | **Fraunces** (opsz 9–144, ejes soft/wonky) | `Georgia, 'Times New Roman', serif` | Títulos de pantalla, **todos los numerales héroe & KPI**, títulos de figura. **La voz.** |
| **UI / cuerpo** | **IBM Plex Sans** (humanista, cálido) | `system-ui, 'Segoe UI', Arial` | cuerpo, botones, nav, copy — humanista, cálido, **no Inter** |
| **Mono** | **IBM Plex Mono** | `ui-monospace, 'SF Mono', Menlo` | kickers/eyebrows, readouts tabulares, ejes, timestamps — el "instrumento" |

Por qué serif de display: hoy la app no tiene display face (todo Inter bold = el
mayor "genérico"). Fraunces da voz al instante y hace que un numeral de 76px se sienta
*compuesto*, como una estadística de revista. Fraunces + IBM Plex = editorial + instrumento.

### Escala de tipo (base 16px · **piso body 15 · piso label 12**, low-vision)
| Token | px / lh · tracking | Familia | Uso |
|---|---|---|---|
| `display-xl` | 76 / 0.90 · −0.03em | Fraunces 380 | numeral héroe (adherencia, % del pico) |
| `display-l` | 34 / 1.0 · −0.01em | Fraunces 400 | título de pantalla |
| `stat-l` | 30 / 1.0 | Fraunces 400 | numerales KPI / figura |
| `title` | 22 / 1.15 | Fraunces 500 | títulos de sección / figura |
| `body` | 15 / 1.5 | IBM Plex Sans 400 | copy primaria (**piso**) |
| `body-sm` | 14 / 1.45 | IBM Plex Sans 400 | copy secundaria |
| `label` | 12 / 1 · +0.16em · UPPER | IBM Plex Mono 500 | kickers, labels de panel (**piso label**) |
| `readout` | 13 / 1 · tnum | IBM Plex Mono 500 | valores, deltas, ejes |
| `micro` | 11 / 1 · +0.1em | IBM Plex Mono 500 | ticks de eje (decorativo, no-texto-crítico) |

Regla: **numerales siempre `tabular-nums`** (mono en readouts, Fraunces con figuras
tabulares en display) para que los dígitos no salten al contar.

---

## 4. Espacio · Radio · Elevación

- **Retícula / espacio:** base 4px → `4·8·12·16·20·24·32·40`. Padding de página **20px**.
  Ritmo de línea base fuerte; márgenes superiores generosos bajo las reglas de sección
  (aire editorial).
- **Radio (más apretado — las columnas de revista son casi cuadradas):**
  `xs 3 · sm 6 · md 10 · lg 14 · pill 999`. Cards = **10**. Full-round reservado a
  avatares, dots de estado, thumb del switch y el FAB. Esto solo ya rompe con los
  glassy 20–24px de hoy.
- **Elevación = reglas, no sombras (gesto firma):**
  - **E0** — superficie plana separada por **hairline 1px `--rule`**. Default del 90% de la UI.
  - **E1** — columna impresa (card): 1px rule + *susurro* de sombra `0 1px 2px rgba(26,23,18,.05)` (Papel) / sin sombra, tono + rule (Tinta).
  - **E2** — cromo flotante (nav, sheets): hairline superior + `0 -2px 0 --rule, 0 10px 34px rgba(26,23,18,.12)`.
  - Sin glass, sin `backdrop-filter` decorativo. La placa opaca bajo números críticos se conserva.

---

## 5. Motion signature (GPU-only: transform / opacity / pathLength — nunca blur)

Easing casa firma: **`cubic-bezier(0,0,0,1)`** (decelerate expo) — "una aguja mecánica
que se asienta": precisa, micro-overshoot, luego quieta. `prefers-reduced-motion` →
todo instantáneo/fade (heredado).

**Sistema de número-motion (el pedido central):**
- Primitivo `<CountUp value format>` reusado en **todo** readout (%, mg, kg, ratios, deltas, kcal).
  `dur 0.9–1.1s`, ease decelerate, `tabular-nums` para ancho estable. En valores vivos
  (`% del pico` en Vida) **re-cuenta** al pasar el tiempo → se lee como instrumento en vivo.
  Reduced-motion → valor instantáneo.
- *En los mockups:* el numeral héroe usa un contador CSS `@property --n` que **se asienta
  en el valor real** (`forwards`), así un screenshot siempre cae en el valor correcto.

**Firmas específicas:**
- **Dial ámbar (draw-on):** el arco se traza `pathLength 0→1` (0.95s, expo-out) mientras
  el numeral cuenta; al llegar a meta la **punta-aguja ámbar** se asienta con micro-overshoot
  y (en Tinta) un único pulso de glow que se desvanece — no repite. Bezel de **ticks de
  instrumento** fijo (círculo con `stroke-dasharray`), 4 ticks mayores en cuartos.
- **Chart draw-on (Vida):** cada curva se traza izq→der como **barrido de osciloscopio**
  (`pathLength`, escalonado por serie 0.15s offset); el área se desvanece detrás; el
  cursor **"ahora"** hace pop con spring; marcadores en escalera.
- **Rule-wipe (firma editorial):** la hairline bajo cada kicker se dibuja horizontal
  (`scaleX 0→1`, origen izq, 0.5s) — como una regla de masthead siendo impresa.
- **Medidores / barras:** crecen desde la base (`scaleX`/height, origin left/bottom), escalonados.
- **Transición de pantalla:** shared-axis X entre las 4 tabs (continuidad lateral); el tick
  del nav viaja con `layoutId`.
- **Táctil (greenfield Capacitor Haptics):** impacto ligero en taps (`<Pressable>` unifica los
  42 `active:scale` ad-hoc), tick de selección en segmentos/tabs, notificación de éxito en el
  frame exacto en que el dial toca meta / se registra una dosis (check por `pathLength`).
  Tras un toggle; anulado bajo reduced-motion.

---

## 6. IA — 5-tab (4 destinos + captura central)

`Inicio · Vida · [ ＋ ] · Diario · Cuerpo`

- **Inicio** — reporte de hoy: dial ámbar de adherencia con numeral serif héroe, próxima
  toma, tus dosis de hoy (accionable), señales (peso/sueño/energía), nutrición, rotación de sitios.
- **Vida** — la firma PK. **Ley de divulgación progresiva:** superficie primaria = UNA frase
  llana es-MX + el numeral grande + acción; la figura científica ("FIG. 1") vive **debajo de un
  resumen llano / tras "Ver la curva"**. Ventana 24 h · 72 h · 7 d; `% del pico` ⇄ `mg`.
- **[ ＋ ] Registrar** — captura universal al centro (Dosis / Medida / Comida / Nota). Bitácora:
  el usuario teclea **su propia** cantidad — sin valores sugeridos/recomendados.
- **Diario** — la bitácora cronológica al frente; filtros por tipo como chips.
- **Cuerpo** — historial y tendencias de las 34 medidas + proyección de peso.

Config vive en sheets tras el engrane (patrón `returnTo`). Se elimina "modo simple"
(4 tabs *ya es* simple) y se corrige el defecto de nombre "Protocolo→Progreso".

**FAB por tema (decisión deliberada):** en **Papel** el botón central es **tinta azul**
(el tema líder de confianza mantiene todo lo interactivo en un solo color); en **Tinta**
es **ámbar con glifo tinta** (el momento "Diego lo postea": el único glow de la pantalla
vive en la captura y el dial). Mismo lugar, mismo glifo, distinta temperatura.

---

## 6b. Microcopy — reglas duras (de las 7 personas)

- **Formas inequívocas:** nunca "Registrar tarde" (ambiguo para Carmen) →
  **"Registrar (atrasada)"**. La pendiente dice el hecho: "ayer · 21:00 — no se registró".
- **Deltas siempre con unidad** y la **ventana la nombra el kicker**, no el chip:
  kicker `TUS SEÑALES · 7 DÍAS` → chips `▼ 0.6 kg` / `▲ 0.5 h` / `→ estable`.
  (El bug clásico "▼ 0.6 7 d" se lee "0.67 d" — prohibido.)
- **Jerga solo con tap-explain `(?)`:** `t½`, `% del pico`, `AUC`. Primera línea siempre
  llana: "de su pico estimado", "lo que sigue activo en tu cuerpo".
- **Cantidades = "tu registro"** ("0.25 ml · tu registro"), jamás "recomendada/sugerida".
- **Reloj coherente en todo el mockup:** status bar, "AHORA · 14:48" y la cuenta
  regresiva ("en 3 h 12 m" para las 18:00) refieren al mismo instante.

---

## 7. Cumplimiento (obedecido en todos los mockups)
- es-MX, **tú** en todo.
- **Sin consejo médico ni dosis/prescripción:** las cantidades son *tu registro*, nunca
  recomendadas/sugeridas; Vida lleva el disclaimer "estimación educativa… no es consejo médico
  ni indicación de dosis" y se enmarca como **"tu estimación personal"** (nunca dispositivo clínico).
- **Sin jeringa/aguja, sin matraz/flask.** Mapa de aplicación = torso abstracto + dots de recencia.
- **Separación de marca:** sin menta `#5eead4`, sin teal, sin flask, sin "BiohackMX".
- Sin antes/después, sin precio/compra, jerga (`% del pico`, `t½`, `AUC`) siempre con tap-explain (?).
- WCAG AA documentado, targets ≥44px, reduced-motion respetado.
