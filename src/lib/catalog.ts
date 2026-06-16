// Hacktrack — catálogo de péptidos, categorías, medidas y copy legal (port verbatim del prototipo)
import type { Category, PeptideEntry, MeasureMeta } from './types'

// howto genérico (constante GEN del prototipo)
export const GEN =
  'Configura tu ritmo y registra tu dosis. Hacktrack no define la dosis — la pones tú.'

// Catálogo completo (24 entradas, verbatim del prototipo)
export const PEPTIDES: Record<string, PeptideEntry> = {
  'Retatrutide':        { cat: 'Metabolismo',  type: 'semanal', weekday: 2, phases: 3, phaseWeeks: 4 },
  'Tirzepatida':        { cat: 'Metabolismo',  type: 'semanal', weekday: 2, phases: 4, phaseWeeks: 4 },
  'Semaglutida':        { cat: 'Metabolismo',  type: 'semanal', weekday: 2, phases: 4, phaseWeeks: 4 },
  'Tesamorelin':        { cat: 'Metabolismo',  type: 'diaria' },
  'MOTS-c':             { cat: 'Anti-Aging',   type: 'diaria', phases: 5 },
  '5-Amino-1MQ':        { cat: 'Metabolismo',  type: 'diaria', howto: GEN },
  'SLU-PP-332':         { cat: 'Metabolismo',  type: 'diaria', howto: GEN },
  'BPC-157':            { cat: 'Recuperación', type: 'lv' },
  'TB-500':             { cat: 'Recuperación', type: 'diaria' },
  'GHK-Cu':             { cat: 'Recuperación', type: 'lv', phases: 3 },
  'ARA 290':            { cat: 'Recuperación', type: 'diaria', howto: GEN },
  'GLOW 70':            { cat: 'Piel',         type: 'diaria' },
  'KLOW 80':            { cat: 'Piel',         type: 'diaria', howto: GEN },
  'NAD+':               { cat: 'Anti-Aging',   type: 'cadaN', n: 3 },
  'SS-31':              { cat: 'Anti-Aging',   type: 'diaria', howto: GEN },
  'L-Glutathione':      { cat: 'Anti-Aging',   type: 'diaria', howto: GEN },
  'Semax':              { cat: 'Cognitivo',    type: 'ciclo', on: 4, off: 4, phases: 4 },
  'Selank':             { cat: 'Cognitivo',    type: 'ciclo', on: 4, off: 4, phases: 2 },
  'DSIP':               { cat: 'Cognitivo',    type: 'diaria', howto: GEN },
  'Oxytocin':           { cat: 'Cognitivo',    type: 'por-demanda' },
  'CJC 1295 (No DAC)':  { cat: 'Crecimiento',  type: 'diaria', howto: GEN },
  'Ipamorelin':         { cat: 'Crecimiento',  type: 'diaria' },
  'Kisspeptin-10':      { cat: 'Reproductivo', type: 'diaria', phases: 2 },
  'PT-141':             { cat: 'Reproductivo', type: 'por-demanda' },
}

// Color de acento por categoría — del design system "Quiet Signal" (Stitch THEME, fuente de la verdad)
export const CATEGORY_COLOR: Record<Category, string> = {
  'Metabolismo':  '#E85D3A',
  'Recuperación': '#2FB57C',
  'Cognitivo':    '#6B7BE8',
  'Anti-Aging':   '#A8842F',
  'Piel':         '#D17FA0',
  'Crecimiento':  '#1B8A7D',
  'Reproductivo': '#9B5FC4',
  'Explorar':     '#6B7A99',
}

// Icono (id de glyph) por categoría — ver components/glyphs.tsx
export const CATEGORY_ICON: Record<Category, string> = {
  'Metabolismo':  'cat-metabolismo',
  'Recuperación': 'cat-recuperacion',
  'Cognitivo':    'cat-cognitivo',
  'Piel':         'cat-piel',
  'Anti-Aging':   'cat-antiaging',
  'Crecimiento':  'cat-crecimiento',
  'Reproductivo': 'cat-reproductivo',
  'Explorar':     'cat-explorar',
}

export const MEASURES_ALL = [
  'Peso', 'Cintura', '% grasa', 'Energía', 'Apetito',
  'Dolor', 'Movilidad', 'Sueño', 'Foco', 'Estado de ánimo',
  'Textura piel', 'Hidratación', 'Libido',
] as const

// MEASURES_BY — Crecimiento y Reproductivo AÑADIDOS (faltaban en el prototipo, audit P2)
// Orden = relevancia por categoría; las primeras 4-5 alimentan la tarjeta per-producto (equipo multiagente)
export const MEASURES_BY: Record<string, string[]> = {
  'Metabolismo':  ['Peso', 'Cintura', '% grasa', 'Apetito', 'Saciedad', 'Glucosa ayunas', 'Energía', 'Náusea'],
  'Recuperación': ['Dolor', 'Recuperación muscular', 'Movilidad', 'Inflamación', 'Sueño', 'Energía'],
  'Cognitivo':    ['Foco', 'Ansiedad', 'Estado de ánimo', 'Memoria', 'Niebla mental', 'Sueño', 'Energía'],
  'Piel':         ['Hidratación', 'Elasticidad piel', 'Textura piel', 'Firmeza', 'Manchas / tono', 'Cicatrices'],
  'Anti-Aging':   ['Energía', 'Recuperación muscular', 'Niebla mental', 'Foco', 'Resistencia', 'Sueño'],
  'Crecimiento':  ['Recuperación muscular', '% músculo', '% grasa', 'Fuerza percibida', 'Sueño', 'Dolor', 'Retención hídrica'],
  'Reproductivo': ['Libido', 'Función / excitación', 'Estado de ánimo', 'Energía', 'Frecuencia sexual', 'Rubor post-dosis'],
  'Explorar':     ['Peso', 'Energía', 'Sueño', 'Foco'],
}

// Escalas subjetivas: 1–100 (decisión de Jan). Medidas objetivas: num → perfil.
export const MEASURE_META: Record<string, MeasureMeta> = {
  // objetivas (van al perfil; se capturan en "Cambio de medidas")
  'Peso':         { kind: 'num',   unit: 'kg', prof: 'peso', down: true },
  'Altura':       { kind: 'num',   unit: 'cm', prof: 'est' },
  'Cintura':      { kind: 'num',   unit: 'cm', down: true },
  '% grasa':      { kind: 'num',   unit: '%',  prof: 'grasa', down: true },
  '% músculo':    { kind: 'num',   unit: '%',  prof: 'musculo' },
  'IMC':          { kind: 'num', down: true },
  // subjetivas 1–100
  'Energía':            { kind: 'scale', max: 100 },
  'Estado de ánimo':    { kind: 'scale', max: 100 },
  'Sueño':              { kind: 'scale', max: 100 },
  'Dolor':              { kind: 'scale', max: 100, down: true },
  'Foco':               { kind: 'scale', max: 100 },
  'Libido':             { kind: 'scale', max: 100 },
  'Elasticidad piel':   { kind: 'scale', max: 100 },
  'Recuperación muscular': { kind: 'scale', max: 100 },
  'Efecto secundario':  { kind: 'scale', max: 100, down: true },
  // otras (compatibilidad)
  'Apetito':      { kind: 'scale', max: 100, down: true },
  'Movilidad':    { kind: 'scale', max: 100 },
  'Textura piel': { kind: 'scale', max: 100 },
  'Hidratación':  { kind: 'scale', max: 100 },
  // ── KPIs por categoría (equipo multiagente) ──
  'Saciedad':            { kind: 'scale', max: 100 },                    // Metabolismo
  'Náusea':              { kind: 'scale', max: 100, down: true },        // Metabolismo
  'Glucosa ayunas':      { kind: 'num', unit: 'mg/dL', down: true },     // Metabolismo
  'Inflamación':         { kind: 'scale', max: 100, down: true },        // Recuperación
  'Manchas / tono':      { kind: 'scale', max: 100 },                    // Piel
  'Cicatrices':          { kind: 'scale', max: 100 },                    // Piel
  'Firmeza':             { kind: 'scale', max: 100 },                    // Piel
  'Niebla mental':       { kind: 'scale', max: 100, down: true },        // Anti-Aging / Cognitivo
  'Resistencia':         { kind: 'scale', max: 100 },                    // Anti-Aging
  'Ansiedad':            { kind: 'scale', max: 100, down: true },        // Cognitivo
  'Memoria':             { kind: 'scale', max: 100 },                    // Cognitivo
  'Fuerza percibida':    { kind: 'scale', max: 100 },                    // Crecimiento
  'Retención hídrica':   { kind: 'scale', max: 100, down: true },        // Crecimiento
  'Función / excitación': { kind: 'scale', max: 100 },                   // Reproductivo
  'Frecuencia sexual':   { kind: 'num', unit: '/sem' },                  // Reproductivo
  'Rubor post-dosis':    { kind: 'scale', max: 100, down: true },        // Reproductivo
}

// Icono (id de glyph) + color por medida para el diario/dashboard
export const MEASURE_ICON: Record<string, { icon: string; cat: string }> = {
  'Peso':         { icon: 'peso',        cat: '#7BC96F' },
  'Energía':      { icon: 'energia',     cat: '#FF7A59' },
  'Sueño':        { icon: 'sueno',       cat: '#5FC9B8' },
  'Foco':         { icon: 'foco',        cat: '#6B7BE8' },
  'Dolor':        { icon: 'dolor',       cat: '#2FB57C' },
  'Movilidad':    { icon: 'movilidad',   cat: '#2FB57C' },
  'Cintura':      { icon: 'cintura',     cat: '#7BC96F' },
  '% grasa':      { icon: 'grasa',       cat: '#7BC96F' },
  'Textura piel': { icon: 'piel',        cat: '#D17FA0' },
  'Hidratación':  { icon: 'hidratacion', cat: '#D17FA0' },
  'Apetito':      { icon: 'apetito',     cat: '#E85D3A' },
  'Libido':       { icon: 'libido',      cat: '#9B5FC4' },
  'Estado de ánimo':       { icon: 'animo',        cat: '#A8842F' },
  'Elasticidad piel':      { icon: 'piel',         cat: '#D17FA0' },
  'Recuperación muscular': { icon: 'recuperacion', cat: '#2FB57C' },
  'Efecto secundario':     { icon: 'efecto',       cat: '#E8A317' },
  'Altura':       { icon: 'altura',  cat: '#7BC96F' },
  '% músculo':    { icon: 'musculo', cat: '#1B8A7D' },
  'IMC':          { icon: 'imc',     cat: '#7BC96F' },
  'Cambio de medidas': { icon: 'medidas', cat: '#1B8A7D' },
}

// KPIs del registro rápido ("+"): Dosis es el héroe (aparte). Estos son los 10 KPIs.
export type KpiKind = 'medidas' | 'scale'
export interface KpiDef { key: string; label: string; icon: string; kind: KpiKind; color: string }
export const KPIS: KpiDef[] = [
  { key: 'Cambio de medidas',     label: 'Cambio de medidas',     icon: 'medidas',      kind: 'medidas', color: '#1B8A7D' },
  { key: 'Energía',               label: 'Energía',               icon: 'energia',      kind: 'scale', color: '#FF7A59' },
  { key: 'Estado de ánimo',       label: 'Estado de ánimo',       icon: 'animo',        kind: 'scale', color: '#A8842F' },
  { key: 'Sueño',                 label: 'Sueño',                 icon: 'sueno',        kind: 'scale', color: '#5FC9B8' },
  { key: 'Dolor',                 label: 'Dolor',                 icon: 'dolor',        kind: 'scale', color: '#2FB57C' },
  { key: 'Foco',                  label: 'Foco',                  icon: 'foco',         kind: 'scale', color: '#6B7BE8' },
  { key: 'Libido',                label: 'Libido',                icon: 'libido',       kind: 'scale', color: '#9B5FC4' },
  { key: 'Elasticidad piel',      label: 'Elasticidad de piel',   icon: 'piel',         kind: 'scale', color: '#D17FA0' },
  { key: 'Recuperación muscular', label: 'Recuperación muscular', icon: 'recuperacion', kind: 'scale', color: '#2FB57C' },
  { key: 'Efecto secundario',     label: 'Efecto secundario',     icon: 'efecto',       kind: 'scale', color: '#E8A317' },
]

// Set por defecto de escalas para el "+" cuando aún no hay objetivo elegido
const DEFAULT_SCALES = ['Energía', 'Estado de ánimo', 'Sueño', 'Dolor', 'Foco', 'Libido', 'Elasticidad piel', 'Recuperación muscular']
const KPI_LABEL: Record<string, string> = { 'Elasticidad piel': 'Elasticidad de piel' }

function scaleKpiFor(name: string): KpiDef {
  return {
    key: name,
    label: KPI_LABEL[name] ?? name,
    icon: MEASURE_ICON[name]?.icon ?? 'medidas',
    kind: 'scale',
    color: MEASURE_ICON[name]?.cat ?? '#1B8A7D',
  }
}

// KPIs registrables en el "+" — DERIVADOS de tu objetivo (misma fuente que las cards de Inicio):
// "Cambio de medidas" + las medidas de escala de tu objetivo + "Efecto secundario".
// Esto evita KPIs huérfanos (cards de Inicio que no se pueden registrar).
export function loggableKpis(selectedMeasures: string[]): KpiDef[] {
  const out: KpiDef[] = [KPIS[0]] // 'Cambio de medidas'
  const seen = new Set<string>()
  const scales = (selectedMeasures.length ? selectedMeasures : DEFAULT_SCALES).filter(
    (m) => MEASURE_META[m]?.kind === 'scale',
  )
  for (const m of [...scales, 'Efecto secundario']) {
    if (seen.has(m)) continue
    seen.add(m)
    out.push(scaleKpiFor(m))
  }
  return out
}

// Campos objetivos de "Cambio de medidas" (se guardan en el perfil; IMC se deriva)
export interface MedidaField { key: keyof import('./types').Profile; label: string; unit: string }
export const MEDIDAS_FIELDS: MedidaField[] = [
  { key: 'peso',    label: 'Peso',                   unit: 'kg' },
  { key: 'est',     label: 'Altura',                 unit: 'cm' },
  { key: 'grasa',   label: '% grasa',                unit: '%' },
  { key: 'musculo', label: '% masa musculoesquelética', unit: '%' },
]

// Tablas de días — iniciales canónicas (audit P2): L Ma Mi J V S D
export const WDS: [string, number][] = [
  ['L', 1], ['Ma', 2], ['Mi', 3], ['J', 4], ['V', 5], ['S', 6], ['D', 0],
]
export const WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// Disclaimers legales — mantener TODAS las instancias, redacción unificada (audit guardrail)
export const DISCLAIMER = {
  dose:    'Tú registras tu propia dosis. Hacktrack no la calcula ni la prescribe.',
  calc:    'Solo convierte unidades con TU dosis. Hacktrack no decide cuánto debes aplicarte. No es consejo médico.',
  measure: 'Tú registras cómo te sientes. Son tus datos, no una promesa de resultado.',
  general: 'Hacktrack es una herramienta de auto-registro. No es consejo médico.',
  proto:   'Esto describe un ritmo general. Tú confirmas y ajustas lo que TÚ haces. No es consejo médico.',
} as const

// Compras del usuario en BiohackMX (mock — en real vendría del OAuth/cuenta BiohackMX).
// El usuario elige de SUS compras cuáles está usando y quiere trackear.
export interface BiohackmxPurchase { product: string; orderId: string; date: string }
export const MOCK_BIOHACKMX_PURCHASES: BiohackmxPurchase[] = [
  { product: 'Retatrutide', orderId: 'BMX-1042', date: '12 may 2026' },
  { product: 'BPC-157',     orderId: 'BMX-1042', date: '12 may 2026' },
  { product: 'GLOW 70',     orderId: 'BMX-0988', date: '28 abr 2026' },
  { product: 'NAD+',        orderId: 'BMX-0988', date: '28 abr 2026' },
  { product: 'TB-500',      orderId: 'BMX-0951', date: '3 abr 2026' },
  { product: 'Semax',       orderId: 'BMX-0951', date: '3 abr 2026' },
]

// Objetivos (pantalla de selección) — SIN producto asociado (P0-4)
export interface GoalOption { label: string; sub: string; cat: Category }
export const GOALS: GoalOption[] = [
  { label: 'Bajar de peso',       sub: 'Optimiza tu metabolismo y composición.',        cat: 'Metabolismo' },
  { label: 'Recuperarme mejor',   sub: 'Mejora tu sueño y reduce el estrés físico.',    cat: 'Recuperación' },
  { label: 'Más energía y foco',  sub: 'Claridad mental y rendimiento sostenido.',      cat: 'Cognitivo' },
  { label: 'Cuidar mi piel',      sub: 'Salud dermatológica desde adentro.',            cat: 'Piel' },
  { label: 'Longevidad',          sub: 'Prácticas para una vida más larga y saludable.', cat: 'Anti-Aging' },
]

// ── Ingredientes comunes (macros por 100 g/ml) — para "crear platillo" (gratis) ──
export interface Ingredient { name: string; unit: 'g' | 'ml'; per: number; kcal: number; protein: number; carbs: number; fat: number }
export const INGREDIENTS: Ingredient[] = [
  { name: 'Pechuga de pollo', unit: 'g', per: 100, kcal: 165, protein: 31, carbs: 0, fat: 4 },
  { name: 'Pechuga de pavo', unit: 'g', per: 100, kcal: 135, protein: 29, carbs: 0, fat: 2 },
  { name: 'Huevo entero', unit: 'g', per: 100, kcal: 155, protein: 13, carbs: 1, fat: 11 },
  { name: 'Arroz blanco cocido', unit: 'g', per: 100, kcal: 130, protein: 3, carbs: 28, fat: 0 },
  { name: 'Papa cocida', unit: 'g', per: 100, kcal: 87, protein: 2, carbs: 20, fat: 0 },
  { name: 'Camote cocido', unit: 'g', per: 100, kcal: 90, protein: 2, carbs: 21, fat: 0 },
  { name: 'Brócoli', unit: 'g', per: 100, kcal: 34, protein: 3, carbs: 7, fat: 0 },
  { name: 'Espinaca', unit: 'g', per: 100, kcal: 23, protein: 3, carbs: 4, fat: 0 },
  { name: 'Jitomate', unit: 'g', per: 100, kcal: 18, protein: 1, carbs: 4, fat: 0 },
  { name: 'Zanahoria', unit: 'g', per: 100, kcal: 41, protein: 1, carbs: 10, fat: 0 },
  { name: 'Frijol negro cocido', unit: 'g', per: 100, kcal: 132, protein: 9, carbs: 24, fat: 1 },
  { name: 'Lentejas cocidas', unit: 'g', per: 100, kcal: 116, protein: 9, carbs: 20, fat: 0 },
  { name: 'Tortilla de maíz', unit: 'g', per: 100, kcal: 218, protein: 6, carbs: 46, fat: 3 },
  { name: 'Pan integral', unit: 'g', per: 100, kcal: 247, protein: 9, carbs: 45, fat: 3 },
  { name: 'Pasta cocida', unit: 'g', per: 100, kcal: 158, protein: 6, carbs: 31, fat: 1 },
  { name: 'Avena cruda', unit: 'g', per: 100, kcal: 379, protein: 13, carbs: 67, fat: 7 },
  { name: 'Aguacate', unit: 'g', per: 100, kcal: 160, protein: 2, carbs: 9, fat: 15 },
  { name: 'Plátano', unit: 'g', per: 100, kcal: 89, protein: 1, carbs: 23, fat: 0 },
  { name: 'Manzana', unit: 'g', per: 100, kcal: 52, protein: 0, carbs: 14, fat: 0 },
  { name: 'Leche entera', unit: 'ml', per: 100, kcal: 61, protein: 3, carbs: 5, fat: 3 },
  { name: 'Yogurt griego natural', unit: 'g', per: 100, kcal: 100, protein: 10, carbs: 4, fat: 5 },
  { name: 'Queso panela', unit: 'g', per: 100, kcal: 270, protein: 20, carbs: 4, fat: 20 },
  { name: 'Atún en agua', unit: 'g', per: 100, kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { name: 'Salmón', unit: 'g', per: 100, kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Carne de res molida 90/10', unit: 'g', per: 100, kcal: 176, protein: 20, carbs: 0, fat: 10 },
  { name: 'Tofu firme', unit: 'g', per: 100, kcal: 76, protein: 8, carbs: 2, fat: 4 },
  { name: 'Almendras', unit: 'g', per: 100, kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { name: 'Crema de cacahuate', unit: 'g', per: 100, kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { name: 'Semillas de chía', unit: 'g', per: 100, kcal: 486, protein: 17, carbs: 42, fat: 31 },
  { name: 'Aceite de oliva', unit: 'ml', per: 100, kcal: 884, protein: 0, carbs: 0, fat: 100 },
]

// ── Recetario (Plus): recetas listas con macros + ingredientes ──
export interface Recipe { name: string; kcal: number; protein: number; carbs: number; fat: number; ingredients: { name: string; grams: number }[]; prep: string }
export const RECIPES: Recipe[] = [
  { name: 'Bowl de pollo y arroz', kcal: 600, protein: 56, carbs: 54, fat: 19,
    ingredients: [{ name: 'Pechuga de pollo', grams: 150 }, { name: 'Arroz blanco cocido', grams: 150 }, { name: 'Brócoli', grams: 100 }, { name: 'Aguacate', grams: 50 }, { name: 'Aceite de oliva', grams: 5 }],
    prep: 'Cocina la pechuga a la plancha con aceite y sazona. Sirve sobre el arroz y el brócoli al vapor; corona con aguacate en cubos.' },
  { name: 'Avena proteica', kcal: 605, protein: 22, carbs: 81, fat: 23,
    ingredients: [{ name: 'Avena cruda', grams: 60 }, { name: 'Leche entera', grams: 200 }, { name: 'Plátano', grams: 100 }, { name: 'Crema de cacahuate', grams: 20 }, { name: 'Semillas de chía', grams: 10 }],
    prep: 'Cocina la avena en la leche 3-4 min. Mezcla la crema de cacahuate y las chías; decora con plátano.' },
  { name: 'Tacos de tinga ligera', kcal: 414, protein: 44, carbs: 36, fat: 13,
    ingredients: [{ name: 'Pechuga de pollo', grams: 120 }, { name: 'Tortilla de maíz', grams: 60 }, { name: 'Jitomate', grams: 80 }, { name: 'Aguacate', grams: 40 }, { name: 'Espinaca', grams: 30 }],
    prep: 'Desmenuza la pechuga y saltéala con jitomate y chipotle hasta formar la tinga. Sirve en tortillas con aguacate y espinaca.' },
  { name: 'Smoothie verde', kcal: 392, protein: 21, carbs: 48, fat: 14,
    ingredients: [{ name: 'Espinaca', grams: 60 }, { name: 'Plátano', grams: 120 }, { name: 'Leche entera', grams: 200 }, { name: 'Yogurt griego natural', grams: 100 }, { name: 'Semillas de chía', grams: 10 }],
    prep: 'Licúa todos los ingredientes hasta homogéneo. Sirve de inmediato; agrega hielo si gustas.' },
]
