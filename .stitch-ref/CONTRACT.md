# Hacktrack — CONTRATO para portar pantallas (léelo COMPLETO antes de escribir)

Estás portando UNA pantalla de Hacktrack a React/TS contra una fundación ya construida y congelada.
Tu salida = **un solo archivo** (el que se te asigna). No toques NADA más.

## Reglas duras
- **Escribe SOLO tu archivo asignado.** No edites `App.tsx`, `lib/*`, `components/*`, `tokens.css`, `package.json`, ni otras pantallas.
- **No agregues dependencias.** No corras `npm install`, `npm run build` ni `tsc` (otros agentes editan en paralelo en el mismo dir → carreras). Escribe código type-correct siguiendo este contrato.
- **Convención de estilos:** CSS global (clases de `tokens.css`) + estilos inline. **NADA de Tailwind, NADA de CSS modules.** Los HTML de Stitch usan Tailwind → **tradúcelos** a estas clases.
- **Idioma:** es-MX, sentence case (solo la 1ª palabra en mayúscula). Números/datos/dosis con fuente mono (clase `.mono`).
- Componente **sin props**, named export con el nombre exacto indicado. Usa `useApp()` para estado y navegación.
- Las pantallas de Stitch traen **contenido placeholder** (p.ej. "Vitamina D3", "Glucosa 92 mg/dL"). **IGNÓRALO**: cablea datos REALES del store/catálogo. Copia el LAYOUT y la jerarquía visual, no el contenido falso.

## Compliance (NUNCA romper — esta marca ya fue baneada por esto)
- **Cero imágenes/iconos de jeringas, agujas, viales-con-aguja, cruces médicas, pastillas, antes/después.** Usa `IcDrop` (gota) / `IcLeaf` (hoja) de `components/icons`.
- **El usuario teclea su propia dosis.** NUNCA precargues una dosis "recomendada". Sin selector de sitio de inyección.
- **La calculadora solo convierte** (no decide cuánto). Lleva selector de escala U-40/50/100.
- **Sin venta in-app.** Sin precios/catálogo en la pantalla de importación. (Precios SÍ permitidos solo en el paywall — es la app, fuera de Meta.)
- **Sin promesas de resultado**, sin curva de "outcome". Gráficas etiquetadas "tus datos".
- **Disclaimers:** usa `<Disclaimer kind="..." />`. Mantén TODAS las instancias (no reduzcas).

## API del store — `import { useApp } from '../lib/store'`
`const { state, dispatch } = useApp()`

### state (campos clave)
- `screen`, `tab` ('inicio'|'diario'|'protocolo'|'ajustes'), `sheet`, `sheetArg`
- `curGoal: Category|null`, `selectedMeasures: string[]`
- `protocol: UserProtocol|null` → `{ product, cadence:UserCadence, progOn, progN, curPhase, startDate }`
- `importedProducts: string[]`
- `log: LogGroup[]` → `[{ day:'Hoy'|'Ayer'|'Vie 12 jun', range, items: LogItem[] }]`; `LogItem={id,t,n,u,cat,ic,type:'dose'|'medida',ts}`
- `profile: {peso,est,grasa,bmi}`, `measureValues: Record<string,number>`
- `settings: {pinEnabled,darkMode,weeklySummary,emailNotices,consentVersion,consentActive}`
- `logged: boolean`, `scale: 40|50|100`, `toast`, `todayTs:number`

### dispatch(action) — acciones
- `{t:'go', screen}` · `{t:'tab', tab}` · `{t:'sheet', sheet, arg?}` (sheet=null cierra)
- `{t:'pickGoal', cat}` — configura SOLO medidas (P0-4, sin producto)
- `{t:'setProtocol', product}` · `{t:'setCadence', cadence}` (P0-3) · `{t:'importProducts', names}`
- `{t:'logDose', product, value:number|null, unit}` (P0-1: entra al diario + racha + activa dash)
- `{t:'saveMeasure', name, value}` (P0-1: entra al diario + perfil + activa dash)
- `{t:'deleteLog', id}` · `{t:'setSetting', key, value}` · `{t:'setScale', scale}`
- `{t:'arcoDelete'}` (P0-5: borra datos y reinicia) · `{t:'reset'}` (logout)
- `{t:'toast', msg}`

### derivados — `import { computeStreak, weekStatus, nextDose, STREAK_GOAL } from '../lib/store'`
- `computeStreak(state.log, new Date(state.todayTs)) → number` (racha honesta, P0-2)
- `weekStatus(state.log, today) → boolean[]` (7 celdas, on si hay registro ese día)
- `nextDose(state) → Date|null` (próxima toma según cadencia; null si no hay protocolo → oculta la card, P1-2)

## Catálogo — `import { ... } from '../lib/catalog'`
`PEPTIDES` (Record<string,PeptideEntry>), `CATEGORY_COLOR`, `CATEGORY_EMOJI`, `MEASURES_BY`, `MEASURE_META`, `MEASURE_ICON`, `WDS` ([['L',1],['Ma',2],...]), `WD`, `MON`, `DISCLAIMER`, `GOALS` (5 objetivos, sin producto), `GEN`.
Iniciales canónicas de día: **L Ma Mi J V S D** (usa `WDS`).

## Cadencia/cálculo — `import { ... } from '../lib/cadence'` / `'../lib/calc'` / `'../lib/bmi'`
- cadence: `diaTocaCadence(d,cad,start)`, `proximasCadence(cad,start,today,n)`, `fmtDate(d,today)`, `fmtTime(d)`, `dayLabel(d,today)`, `rhythmLabel(p)`, `rhythmBadge(p)`, `presetCad(p?)`, `weekStrip(today)`
- calc: `calcRecon({vial,agua,dosis,unit,scale}) → {ui,mL,conc,scale}|null`, `copyToRegisterToast(r)`
- bmi: `bmiCalc(w,h)`, `bmiBand(bmi)`

## Componentes compartidos
- `import { BottomNav } from '../components/BottomNav'` (ya montada por el shell — NO la incluyas en tabs)
- `import { Sheet } from '../components/Sheet'` → `<Sheet title onClose>{...}</Sheet>` (bottom-sheet)
- `import { AdherenceRing } from '../components/AdherenceRing'` → `<AdherenceRing value goal size? stroke? label? unit? />`
- `import { Segmented, Chip, Toggle, Stepper, Disclaimer } from '../components/controls'`
- `import { Sparkline, LineChart } from '../components/charts'`
- `import { IcHome, IcDiary, IcProto, IcGear, IcChevron, IcBack, IcClose, IcDrop, IcLeaf, IcCheck, IcShield, IcBell } from '../components/icons'`

## Vocabulario CSS (clases de tokens.css)
- Contenedor: `.scroll` (full) / `.scroll.has-nav` (tabs, deja espacio a la nav). Tarjeta: `.card`.
- Botones: `.btn` + `.btn-brand` (kelp) / `.btn-ember` (coral, CTA conversión) / `.btn-ghost` / `.btn-outline` / `.btn-sm`.
- Tipografía: `.display-l .h1 .h2 .body .sm .mono`.
- `.chip`(`.active` / `.chip-cat` con `style={{['--c']:color}}`), `.segmented` (usa `<Segmented>`),
  `.rowlist` > `.row`(`.danger`) > `.row-ic .row-main .row-label .row-sub .row-end`,
  `.field`(`.error`) `.label` `.field-error`, `.toggle`(`.on`) (usa `<Toggle>`), `.stepbtn`, `.badge`(`.badge-mint`),
  `.overlay .sheet .sheet-handle .sheet-head .iconbtn`, `.disclaimer`, `.ring-num`.
- Colores: vars `--brand-700` (#0E5A52 kelp), `--ember`, `--lime`, `--ink-900/700/400/300/200/100`, `--bg`, `--card`, `--border`, `--error`, `--cat-metabolismo` etc.

## Animación
`framer-motion` (`motion`, `AnimatePresence`). Patrón stagger opcional:
`const stagger={animate:{transition:{staggerChildren:.06}}}; const item={initial:{opacity:0,y:12},animate:{opacity:1,y:0}}`.
Respeta `prefers-reduced-motion` (ya cubierto en CSS).

## Tu material por pantalla
- HTML de referencia de Stitch: `.stitch-ref/<slug>.html` (layout/visual a traducir).
- `.stitch-ref/SCREENS-INDEX.md` (estructura + copy es-MX por pantalla).
- `.stitch-ref/LOGIC-SPEC.md` (modelo de datos + los fixes P0 — respétalos).
