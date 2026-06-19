# Hacktrack rebuild — Design System "Precision × Accessible" (v2)

Guía para construir pantallas en `src/v2/screens/`. Cockpit oscuro premium + accesibilidad AA. React + Tailwind + framer-motion, reusando la lógica de `src/lib/`.

## Tokens (clases Tailwind)
- Fondos: `bg-void` (más profundo), `bg-background`, `bg-raised` (filas/sólido), `bg-card`.
- Texto: `text-foreground` (primario 15:1), `text-secondary-foreground` (7:1), `text-muted-foreground` (5.7:1 — piso AA), `text-teal`, `text-ok` / `text-warn` / `text-alert`.
- Bordes: `border border-white/10`. Números: `font-mono tabular-nums`.
- Acento teal = `--teal #5FC9B8`. **NUNCA `#5eead4`** (otra marca). Número hero brillante: `text-[var(--teal-bright)]`.

## Primitivas (importar de `../ui/...`)
- `Glass` — card de vidrio (contenido/analítica). `<Glass className="...">`
- `DataPlate` — placa OPACA para números/datos críticos. `<DataPlate className="px-4 py-2">`
- `Button` — `variant: primary|ghost|outline|plate`, `size: md|sm|icon|full`. CTA primario = sólido teal.
- `Ring` — anillo de progreso. `<Ring value goal unit label sub size stroke/>`
- `Chip` — pill seleccionable. `<Chip active onClick>label</Chip>`
- `SegmentedTabs` — `<SegmentedTabs options={[{value,label}]} value onChange/>`
- `Stepper` — `<Stepper onDec onInc>{numero}</Stepper>` (tap targets 48px)
- `Sheet` — bottom-sheet (se monta a nivel shell). `<Sheet open onClose title>...`

## Reglas DURAS
1. **Vidrio (`Glass`) solo para contenido/analítica.** Médicas/operativas SÓLIDAS (`bg-raised`, no glass): glucosa, agua/hidratación, electrolitos, semáforo, alertas, disclaimers, vial.
2. **Números críticos en `DataPlate`** (opaca), nunca sobre blur a secas.
3. **Estado = ícono + texto + color** (nunca color solo).
4. **Motion**: framer-motion; animar SOLO `transform`/`opacity` (NO `filter`/blur en elementos animados). Todo bajo `useReducedMotion()`. Entrada = fade + y (stagger), no blur.
5. **Tap targets ≥44px.** Foco visible (ya global).
6. **Compliance**: sin jeringas (usa `lucide-react` Droplet/Leaf), sin claims médicos, sin dosis precargada (el usuario teclea), sin vía de administración ("subcutáneo/IV"), sin antes/después. Microcopy de privacidad ("Tu historial se guarda solo en tu dispositivo").
7. **es-MX**, sentence case.

## Datos
- `import { useApp } from '../../lib/store'` → `const { state, dispatch } = useApp()`.
- Reusa `src/lib/`: `calendar` (upcomingDoses, dayProducts, doseTakenOnProduct, protocolStreak, monthMatrix), `cadence` (startOfDay), `calc`, `nutrition`, `pharma`, `catalog`, `store` (weekStatus, trackedProtocols).
- **Referencia de lógica**: la pantalla vieja en `src/screens/<X>.tsx` tiene las derivaciones reales — replica el wiring de datos, re-estiliza con v2. NO copies el CSS viejo.

## Salida
- Un archivo `src/v2/screens/<Nombre>.tsx` que exporta `export function <Nombre>()`.
- NO edites archivos compartidos (`ui/`, `provider`, `AppV2`, `globals.css`, `tailwind.config.ts`) ni otras pantallas. Si necesitas un subcomponente, ponlo en el mismo archivo o en `src/v2/screens/<nombre>/`.
- Verifica TS válido (no rompas el build).
