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

// Emoji por categoría (pantalla de objetivo / chips)
export const CATEGORY_EMOJI: Record<Category, string> = {
  'Metabolismo':  '⚖️',
  'Recuperación': '🩹',
  'Cognitivo':    '🧠',
  'Piel':         '✨',
  'Anti-Aging':   '🧬',
  'Crecimiento':  '🌱',
  'Reproductivo': '❤️',
  'Explorar':     '🧭',
}

export const MEASURES_ALL = [
  'Peso', 'Cintura', '% grasa', 'Energía', 'Apetito',
  'Dolor', 'Movilidad', 'Sueño', 'Foco', 'Ánimo',
  'Textura piel', 'Hidratación', 'Libido',
] as const

// MEASURES_BY — Crecimiento y Reproductivo AÑADIDOS (faltaban en el prototipo, audit P2)
export const MEASURES_BY: Record<string, string[]> = {
  'Metabolismo':  ['Peso', 'Cintura', '% grasa', 'Energía', 'Apetito'],
  'Recuperación': ['Dolor', 'Movilidad', 'Sueño', 'Energía'],
  'Cognitivo':    ['Foco', 'Estado de ánimo', 'Sueño', 'Energía'],
  'Piel':         ['Textura piel', 'Hidratación', 'Sueño'],
  'Anti-Aging':   ['Energía', 'Sueño', 'Textura piel'],
  'Crecimiento':  ['Sueño', 'Energía', 'Movilidad'],
  'Reproductivo': ['Libido', 'Estado de ánimo', 'Energía'],
  'Explorar':     ['Peso', 'Energía', 'Sueño'],
}

// Escalas subjetivas: 1–100 (decisión de Jan). Medidas objetivas: num → perfil.
export const MEASURE_META: Record<string, MeasureMeta> = {
  // objetivas (van al perfil; se capturan en "Cambio de medidas")
  'Peso':         { kind: 'num',   unit: 'kg', prof: 'peso' },
  'Altura':       { kind: 'num',   unit: 'cm', prof: 'est' },
  'Cintura':      { kind: 'num',   unit: 'cm' },
  '% grasa':      { kind: 'num',   unit: '%',  prof: 'grasa' },
  '% músculo':    { kind: 'num',   unit: '%',  prof: 'musculo' },
  'IMC':          { kind: 'num' },
  // subjetivas 1–100
  'Energía':            { kind: 'scale', max: 100 },
  'Estado de ánimo':    { kind: 'scale', max: 100 },
  'Sueño':              { kind: 'scale', max: 100 },
  'Dolor':              { kind: 'scale', max: 100 },
  'Foco':               { kind: 'scale', max: 100 },
  'Libido':             { kind: 'scale', max: 100 },
  'Elasticidad piel':   { kind: 'scale', max: 100 },
  'Recuperación muscular': { kind: 'scale', max: 100 },
  'Efecto secundario':  { kind: 'scale', max: 100 },
  // otras (compatibilidad)
  'Apetito':      { kind: 'scale', max: 100 },
  'Movilidad':    { kind: 'scale', max: 100 },
  'Ánimo':        { kind: 'scale', max: 100 },
  'Textura piel': { kind: 'scale', max: 100 },
  'Hidratación':  { kind: 'scale', max: 100 },
}

// Icono/color por medida para el diario
export const MEASURE_ICON: Record<string, { ic: string; cat: string }> = {
  'Peso':         { ic: '⚖️', cat: '#7BC96F' },
  'Energía':      { ic: '⚡', cat: '#FF7A59' },
  'Sueño':        { ic: '😴', cat: '#5FC9B8' },
  'Foco':         { ic: '🎯', cat: '#6B7BE8' },
  'Ánimo':        { ic: '🙂', cat: '#A8842F' },
  'Dolor':        { ic: '🩹', cat: '#2FB57C' },
  'Movilidad':    { ic: '🤸', cat: '#2FB57C' },
  'Cintura':      { ic: '📏', cat: '#7BC96F' },
  '% grasa':      { ic: '📉', cat: '#7BC96F' },
  'Textura piel': { ic: '✨', cat: '#D17FA0' },
  'Hidratación':  { ic: '💧', cat: '#D17FA0' },
  'Apetito':      { ic: '🍽️', cat: '#E85D3A' },
  'Libido':       { ic: '❤️', cat: '#9B5FC4' },
  'Estado de ánimo':       { ic: '🙂', cat: '#A8842F' },
  'Elasticidad piel':      { ic: '✨', cat: '#D17FA0' },
  'Recuperación muscular': { ic: '🤸', cat: '#2FB57C' },
  'Efecto secundario':     { ic: '⚠️', cat: '#E8A317' },
  'Altura':       { ic: '📏', cat: '#7BC96F' },
  '% músculo':    { ic: '💪', cat: '#1B8A7D' },
  'IMC':          { ic: '🧮', cat: '#7BC96F' },
  'Cambio de medidas': { ic: '📐', cat: '#1B8A7D' },
}

// KPIs del registro rápido ("+"): Dosis es el héroe (aparte). Estos son los 10 KPIs.
export type KpiKind = 'medidas' | 'scale'
export interface KpiDef { key: string; label: string; emoji: string; kind: KpiKind; color: string }
export const KPIS: KpiDef[] = [
  { key: 'Cambio de medidas',     label: 'Cambio de medidas',     emoji: '📐', kind: 'medidas', color: '#1B8A7D' },
  { key: 'Energía',               label: 'Energía',               emoji: '⚡', kind: 'scale', color: '#FF7A59' },
  { key: 'Estado de ánimo',       label: 'Estado de ánimo',       emoji: '🙂', kind: 'scale', color: '#A8842F' },
  { key: 'Sueño',                 label: 'Sueño',                 emoji: '😴', kind: 'scale', color: '#5FC9B8' },
  { key: 'Dolor',                 label: 'Dolor',                 emoji: '🩹', kind: 'scale', color: '#2FB57C' },
  { key: 'Foco',                  label: 'Foco',                  emoji: '🎯', kind: 'scale', color: '#6B7BE8' },
  { key: 'Libido',                label: 'Libido',                emoji: '❤️', kind: 'scale', color: '#9B5FC4' },
  { key: 'Elasticidad piel',      label: 'Elasticidad de piel',   emoji: '✨', kind: 'scale', color: '#D17FA0' },
  { key: 'Recuperación muscular', label: 'Recuperación muscular', emoji: '🤸', kind: 'scale', color: '#2FB57C' },
  { key: 'Efecto secundario',     label: 'Efecto secundario',     emoji: '⚠️', kind: 'scale', color: '#E8A317' },
]

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
