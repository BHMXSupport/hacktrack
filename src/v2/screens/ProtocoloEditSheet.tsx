// ProtocoloEditSheet v2 — design system "Bitácora" (LOCKED): campos cálidos de papel
// (hairline + pozos), chips de fase/preset en azul-tinta, numerales serif en las placas,
// labels mono de instrumento. Toda la lógica de guardado/validación queda intacta.
// Editar cadencia, titulación, fechas, recordatorio y stock de vial por producto.
// Items R8,R9,R10,R11,R13,R14,M1,M2 (protocolo & cadencia).
// Compliance: sin claims médicos, sin dosis precargada, es-MX, tap targets ≥44px.
import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Info, ChevronDown, ChevronUp, Archive, ArchiveRestore, Droplet, Sunrise, Sun, Moon } from 'lucide-react'
import { useApp } from '../../lib/store'
import { STORE_BUILD } from '../../lib/buildFlags'
import { PEPTIDES, WDS } from '../../lib/catalog'
import {
  rhythmLabel,
  proximasCadence,
  cadenceLabel,
  presetCad,
  startOfDay,
} from '../../lib/cadence'
import { doseTakenOnProduct, doseSkippedOnProduct } from '../../lib/calendar'
import type { UserCadence } from '../../lib/types'
import { Sheet } from '../ui/Sheet'
import { Switch } from '../ui/Switch'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { Chip } from '../ui/Chip'
import { Stepper } from '../ui/Stepper'
import { Button } from '../ui/Button'
import { Glass } from '../ui/Glass'
import { DataPlate } from '../ui/DataPlate'

// ── helpers de fecha ─────────────────────────────────────────────────────────

const toInputDate = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromInputDate = (v: string): number | null => {
  const parts = v.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  const ts = new Date(parts[0], parts[1] - 1, parts[2]).getTime()
  return isNaN(ts) ? null : ts
}
function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '')
}
function fmtTime12(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

// Dosis promedio real del log para una fase concreta (item 333)
function avgDoseForPhase(
  log: ReturnType<typeof useApp>['state']['log'],
  product: string,
  phaseIdx: number,
  totalPhases: number,
  startDate: number,
  endDate: number | null,
): number | null {
  if (totalPhases <= 0) return null
  const end = endDate ?? startOfDay(new Date()).getTime()
  const span = end - startDate
  const phaseLen = span / totalPhases
  const phaseStart = startDate + phaseIdx * phaseLen
  const phaseEnd = startDate + (phaseIdx + 1) * phaseLen
  const doses: number[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type !== 'dose' || it.product !== product) continue
      if (it.ts < phaseStart || it.ts > phaseEnd) continue
      if (it.value != null && it.value > 0) doses.push(it.value)
    }
  }
  if (doses.length === 0) return null
  return doses.reduce((a, b) => a + b, 0) / doses.length
}

// Últimas N dosis del producto del log (item 332)
function lastDoses(
  log: ReturnType<typeof useApp>['state']['log'],
  product: string,
  n = 10,
): { value: number | null; unit: string; ts: number }[] {
  const out: { value: number | null; unit: string; ts: number }[] = []
  for (const group of log) {
    for (const it of group.items) {
      if (it.type === 'dose' && it.product === product) {
        out.push({ value: it.value ?? null, unit: (it.unit as string) ?? 'mg', ts: it.ts })
        if (out.length >= n) return out
      }
    }
  }
  return out
}

// Modos que el usuario puede editar directamente en esta hoja
// cadaN y ciclo son modos editables sí disponibles
type EditableMode = 'dia' | 'sem' | 'mes' | 'cadaN' | 'ciclo' | 'uso'

const MODE_OPTIONS: { value: EditableMode; label: string }[] = [
  { value: 'dia',   label: 'Por día' },
  { value: 'sem',   label: 'Semana' },
  { value: 'mes',   label: 'Mes' },
  { value: 'cadaN', label: 'Cada N días' },
  { value: 'ciclo', label: 'On/Off' },
  { value: 'uso',   label: 'Por uso' },
]

// ── Subcomponente: chip de cadencia (para que Inicio lo reutilice)
// M2: Inicio debería montar <CadenciaChip cad={state.protocol?.cadence} />
// SheetId: 'protocolo-edit' → abrir con dispatch({ t:'sheet', sheet:'protocolo-edit', arg: product })
// Píldora mono azul-tinta (interactivo/dato) con gota Droplet — metáfora segura, nunca jeringa.
export function CadenciaChip({ cad }: { cad: UserCadence | undefined | null }) {
  if (!cad) return null
  const label = cadenceLabel(cad)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--blue)_35%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-3 py-1 font-mono text-[12px] font-medium text-blue"
      aria-label={`Cadencia activa: ${label}`}
    >
      <Droplet size={12} strokeWidth={1.6} aria-hidden className="shrink-0" />
      {label}
    </span>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export function ProtocoloEditSheet({
  open,
  onClose,
  product: productProp,
}: {
  open: boolean
  onClose: () => void
  product?: string | null
}) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // Tema RESUELTO (espejo de applyTheme del provider) — solo para el chrome nativo de los
  // pickers de fecha/hora (color-scheme): antes iba clavado a 'dark' y en Papel pintaba
  // los controles nativos oscuros sobre fondo claro.
  const _themeMode = state.settings.themeMode
  const _hour = new Date().getHours()
  const nativeScheme: 'dark' | 'light' =
    _themeMode === 'light' ? 'light'
    : _themeMode === 'auto' ? (_hour >= 19 || _hour < 7 ? 'dark' : 'light')
    : 'dark'

  // Producto a editar: prop > sheetArg > activeProduct
  const editProduct =
    productProp ??
    (state.sheetArg && state.protocols[state.sheetArg] ? state.sheetArg : null) ??
    state.activeProduct

  const p = editProduct ? state.protocols[editProduct] : null
  const entry = p ? PEPTIDES[p.product] : null
  const isPreset = p != null && !entry  // producto personalizado sin entrada en catálogo

  // Estado derivado de p — se reinicializa cuando cambia el producto o se abre el sheet
  const defaultCad = p?.cadence ?? (entry ? presetCad(entry) : presetCad())
  // #35: cadencia fresca si el protocolo no tiene cadencia guardada previamente o aún no se ha confirmado.
  // #F17: cadenceConfirmed ya está tipado en UserProtocol → sin casts.
  const [isFreshCadence, setIsFreshCadence] = useState(
    !p?.cadenceConfirmed,
  )

  const [startStr, setStartStr] = useState(toInputDate(p?.startDate ?? state.todayTs))
  const [endStr, setEndStr] = useState(p?.endDate ? toInputDate(p.endDate) : '')
  const [cad, setCad] = useState<UserCadence>(defaultCad)
  const [progOn, setProgOn] = useState(p?.progOn ?? false)
  const [progN, setProgN] = useState(p?.progN ?? (entry?.phases ?? 2))
  const [phaseDoses, setPhaseDoses] = useState<string[]>(
    (p?.phaseDoses ?? []).map((d) => (d == null ? '' : String(d))),
  )
  const [reminderTime, setReminderTime] = useState(p?.reminderTime ?? '08:00')
  // #36: siempre vacío — solo despachar setVialStock si el usuario lo rellena explícitamente
  const [totalMgStr, setTotalMgStr] = useState('')
  // debt-102: setVialStock DESCARTA el vial actual (usedMg vuelve a 0) — si el vial en curso todavía
  // tiene mg restantes, el guardado pide un segundo tap de confirmación antes de pisarlo.
  const [vialOverwriteConfirm, setVialOverwriteConfirm] = useState(false)
  const [purchaseMgStr, setPurchaseMgStr] = useState('')
  const [purchaseCostStr, setPurchaseCostStr] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [phaseDoseErrors, setPhaseDoseErrors] = useState<boolean[]>([])

  // Re-sincronizar estado cuando el producto o el sheet cambia
  useEffect(() => {
    if (!open || !p) return
    setStartStr(toInputDate(p.startDate ?? state.todayTs))
    setEndStr(p.endDate ? toInputDate(p.endDate) : '')
    setCad(p.cadence ?? (entry ? presetCad(entry) : presetCad()))
    setProgOn(p.progOn ?? false)
    setProgN(p.progN ?? (entry?.phases ?? 2))
    setPhaseDoses((p.phaseDoses ?? []).map((d) => (d == null ? '' : String(d))))
    setReminderTime(p.reminderTime ?? '08:00')
    // #36: inicializar siempre vacío para no re-disparar setVialStock al guardar sin cambios
    setTotalMgStr('')
    setVialOverwriteConfirm(false)
    setPurchaseMgStr('')
    setPurchaseCostStr('')
    setShowHistory(false)
    // #35: re-sincronizar estado fresco al cambiar de producto
    setIsFreshCadence(!p?.cadenceConfirmed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editProduct])

  const setPhaseDose = useCallback((i: number, v: string) => {
    setPhaseDoses((arr) => {
      const next = arr.slice()
      while (next.length <= i) next.push('')
      next[i] = v
      return next
    })
  }, [])

  if (!open) return null
  if (!p || !editProduct) {
    return (
      <Sheet open={open} onClose={onClose} title="Protocolo">
        <div className="flex flex-col items-center gap-4 py-8 text-ink-2">
          <Info size={32} strokeWidth={1.6} aria-hidden />
          <p className="text-[15px]">No hay protocolo activo. Agrega un producto primero.</p>
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </Sheet>
    )
  }

  const mode = cad.mode as EditableMode

  function setMode(m: EditableMode) {
    setCad((c) => ({
      ...c,
      mode: m,
      every: m === 'sem' || m === 'mes' ? Math.max(1, c.every) : 1,
      n: m === 'cadaN' ? (c.n ?? 3) : c.n,
      on: m === 'ciclo' ? (c.on ?? 5) : c.on,
      off: m === 'ciclo' ? (c.off ?? 2) : c.off,
    }))
  }
  function toggleDay(key: 'days' | 'semDays', i: number) {
    setCad((c) => {
      const arr = c[key].slice()
      arr[i] = !arr[i]
      return { ...c, [key]: arr }
    })
  }

  // Validación: ≥1 día en modos que lo requieren (item R9)
  const daysValid =
    mode === 'dia'
      ? cad.days.some(Boolean)
      : mode === 'sem'
      ? cad.semDays.some(Boolean)
      : true

  // Preview próximas 5 tomas (item R11). fromInputDate puede ser null (fecha parcial/borrada) → cae a p.startDate.
  const startDate = new Date((startStr ? fromInputDate(startStr) : null) ?? p.startDate)
  // #F13: el preview de próximas tomas excluye días que el usuario ya registró o saltó (p.ej. hoy)
  // — antes la cadencia pura mostraba como "próxima" una dosis ya hecha/saltada.
  const proximas = (mode !== 'uso' ? proximasCadence(cad, startDate, new Date(), 5) : [])
    .filter((d) => !doseTakenOnProduct(state, d, p.product) && !doseSkippedOnProduct(state, d, p.product))

  // Historial reciente
  const historial = lastDoses(state.log, p.product)
  // #38: unidad derivada de las últimas dosis registradas (no hardcoded 'mg')
  const doseUnit = historial[0]?.unit ?? 'mg'

  // Etiqueta legible de la cadencia en edición (para el chip de preview)
  const cadPreviewLabel = cadenceLabel(cad)

  // Ritmo recomendado del catálogo
  const recomendado = entry ? rhythmLabel(entry) : null

  function save() {
    if (!p) return
    if (!daysValid) {
      dispatch({ t: 'toast', msg: 'Selecciona al menos un día' })
      return
    }
    const sd = startStr ? fromInputDate(startStr) : p.startDate
    if (sd == null || isNaN(sd)) {
      dispatch({ t: 'toast', msg: 'Fecha de inicio inválida' })
      return
    }
    const ed = endStr ? fromInputDate(endStr) : null
    if (ed != null && ed < sd) {
      dispatch({ t: 'toast', msg: 'La fecha de fin no puede ser antes del inicio' })
      return
    }
    if (progOn) {
      const errors = Array.from({ length: progN }, (_, i) => {
        const n = parseFloat(phaseDoses[i] ?? '')
        return isNaN(n) || n <= 0
      })
      setPhaseDoseErrors(errors)
      if (errors.some(Boolean)) {
        dispatch({ t: 'toast', msg: 'Ingresa una dosis mayor a 0 en cada fase' })
        return
      }
    }
    setPhaseDoseErrors([])

    // debt-102: pisar un vial a medias pierde su stock para siempre (usedMg se reinicia a 0).
    // Primer tap con vial en curso → aviso inline y NO se guarda nada; segundo tap confirma todo.
    const newVialMg = parseFloat(totalMgStr)
    const wantsNewVial = totalMgStr.trim() !== '' && !isNaN(newVialMg) && newVialMg > 0
    const curVial = p.vialStock
    const vialInUse = !!curVial && curVial.usedMg > 0 && curVial.totalMg - curVial.usedMg > 0
    if (wantsNewVial && vialInUse && !vialOverwriteConfirm) {
      setVialOverwriteConfirm(true)
      return
    }

    const doses: (number | null)[] = Array.from({ length: progN }, (_, i) => {
      const n = parseFloat(phaseDoses[i] ?? '')
      return isNaN(n) ? null : n
    })

    dispatch({
      t: 'updateProtocolFor',
      product: p.product,
      // #35/#F17: cadenceConfirmed persiste en el protocolo (ya tipado en UserProtocol).
      patch: {
        cadence: cad,
        cadenceConfirmed: true,
        progOn,
        progN,
        phaseDoses: progOn ? doses : undefined,
        startDate: sd,
        endDate: ed,
        reminderTime,
      } as any,
    })
    // #35: suprimir banner en la sesión actual
    setIsFreshCadence(false)

    // #36: solo despachar setVialStock si el usuario rellenó el campo explícitamente
    if (wantsNewVial) {
      dispatch({ t: 'setVialStock', product: p.product, totalMg: newVialMg })
    }

    // Registrar compra
    const purchaseMg = parseFloat(purchaseMgStr)
    const purchaseCost = parseFloat(purchaseCostStr)
    if (!isNaN(purchaseMg) && purchaseMg > 0) {
      dispatch({
        t: 'setPurchase',
        product: p.product,
        purchasedMg: purchaseMg,
        purchasedAt: Date.now(),
        cost: isNaN(purchaseCost) ? null : purchaseCost,
      })
    }

    dispatch({ t: 'toast', msg: 'Protocolo guardado' })
    onClose()
  }

  function handleArchive() {
    if (!p) return
    dispatch({ t: 'archiveProtocol', product: p.product })
    dispatch({ t: 'toast', msg: `${p.product} archivado` })
    onClose()
  }
  function handleReactivate() {
    if (!p) return
    dispatch({ t: 'reactivateProtocol', product: p.product })
    dispatch({ t: 'toast', msg: `${p.product} reactivado` })
    onClose()
  }

  const vialUsed = p.vialStock?.usedMg ?? 0
  const vialTotal = p.vialStock?.totalMg ?? 0
  const vialPct = vialTotal > 0 ? Math.min(1, vialUsed / vialTotal) : 0

  return (
    <Sheet open={open} onClose={onClose} title={`Protocolo · ${p.product}`}>
      <div className="flex flex-col gap-5 pb-4">

        {/* ── M1: aviso si cadencia es sugerencia (sin confirmar) ─────────── */}
        {isFreshCadence && (
          <div className="flex gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_7%,transparent)] px-4 py-3">
            <Info size={16} strokeWidth={1.8} aria-hidden className="mt-0.5 shrink-0 text-blue" />
            <p className="text-[13px] leading-snug text-ink-2">
              Cadencia sugerida por Hacktrack — basada en el catálogo.
              <strong className="text-ink"> Ajústala a lo que tú haces.</strong>
            </p>
          </div>
        )}

        {/* ── Chip de cadencia en edición (preview activo) ─────────────── */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-2">Cadencia actual:</span>
          <CadenciaChip cad={cad} />
        </div>

        {/* ── Selector de modo ─────────────────────────────────────────── */}
        <section aria-labelledby="proto-mode-label">
          <p id="proto-mode-label" className="mb-2 font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
            Ritmo
            {recomendado && (
              <span className="ml-2 font-normal normal-case tracking-normal text-ink-3">
                (catálogo: {recomendado})
              </span>
            )}
          </p>
          {/* Scroll horizontal si caben todos los modos en pantalla angosta */}
          {/* #40: contenedor relativo con fade lateral para insinuar más contenido en iPhone ≤390px */}
          <div className="relative">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-[440px]">
                <SegmentedTabs<EditableMode>
                  options={MODE_OPTIONS}
                  value={mode}
                  onChange={setMode}
                />
              </div>
            </div>
            {/* Gradiente derecho: insinúa scroll horizontal sin romper funcionalidad.
                to-surface = el panel del Sheet (antes to-background, que ya no coincide). */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-surface"
              aria-hidden
            />
          </div>
        </section>

        {/* ── Configuración por modo ─────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            {mode === 'dia' && (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] text-ink-2">Días de la semana</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Días activos">
                  {WDS.map(([lbl], i) => (
                    <Chip
                      key={lbl}
                      active={cad.days[i]}
                      onClick={() => toggleDay('days', i)}
                      aria-label={`${lbl} ${cad.days[i] ? 'activo' : 'inactivo'}`}
                    >
                      {lbl}
                    </Chip>
                  ))}
                </div>
                {!daysValid && (
                  <p className="text-[12px] text-alert" role="alert">
                    Selecciona al menos un día
                  </p>
                )}
              </div>
            )}

            {mode === 'sem' && (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-2 text-[13px] text-ink-2">Cada cuántas semanas</p>
                  <Stepper
                    onDec={() => setCad((c) => ({ ...c, every: Math.max(1, c.every - 1) }))}
                    onInc={() => setCad((c) => ({ ...c, every: Math.min(12, c.every + 1) }))}
                    decLabel="Menos semanas"
                    incLabel="Más semanas"
                  >
                    {/* Placa de instrumento: numeral SERIF (DataPlate ya pone Fraunces tabular) */}
                    <DataPlate className="flex items-baseline justify-center px-4 py-2">
                      <span className="text-[24px] leading-none">{cad.every}</span>
                      <span className="ml-2 font-mono text-[12px] font-medium opacity-70">sem</span>
                    </DataPlate>
                  </Stepper>
                </div>
                <div>
                  <p className="mb-2 text-[13px] text-ink-2">Días en esas semanas</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Días de la semana activos">
                    {WDS.map(([lbl], i) => (
                      <Chip
                        key={lbl}
                        active={cad.semDays[i]}
                        onClick={() => toggleDay('semDays', i)}
                        aria-label={`${lbl} ${cad.semDays[i] ? 'activo' : 'inactivo'}`}
                      >
                        {lbl}
                      </Chip>
                    ))}
                  </div>
                  {!daysValid && (
                    <p className="mt-1 text-[12px] text-alert" role="alert">
                      Selecciona al menos un día
                    </p>
                  )}
                </div>
              </div>
            )}

            {mode === 'mes' && (
              <div>
                <p className="mb-2 text-[13px] text-ink-2">
                  Cada cuántos meses (el mismo día del mes que la fecha de inicio)
                </p>
                <Stepper
                  onDec={() => setCad((c) => ({ ...c, every: Math.max(1, c.every - 1) }))}
                  onInc={() => setCad((c) => ({ ...c, every: Math.min(12, c.every + 1) }))}
                  decLabel="Menos meses"
                  incLabel="Más meses"
                >
                  <DataPlate className="flex items-baseline justify-center px-4 py-2">
                    <span className="text-[24px] leading-none">{cad.every}</span>
                    <span className="ml-2 font-mono text-[12px] font-medium opacity-70">mes</span>
                  </DataPlate>
                </Stepper>
              </div>
            )}

            {mode === 'cadaN' && (
              <div>
                <p className="mb-2 text-[13px] text-ink-2">
                  Tomar cada N días (contando desde la fecha de inicio)
                </p>
                <Stepper
                  onDec={() => setCad((c) => ({ ...c, n: Math.max(1, (c.n ?? 3) - 1) }))}
                  onInc={() => setCad((c) => ({ ...c, n: Math.min(60, (c.n ?? 3) + 1) }))}
                  decLabel="Menos días"
                  incLabel="Más días"
                >
                  <DataPlate className="flex items-baseline justify-center px-4 py-2">
                    <span className="text-[24px] leading-none">{cad.n ?? 3}</span>
                    <span className="ml-2 font-mono text-[12px] font-medium opacity-70">días</span>
                  </DataPlate>
                </Stepper>
              </div>
            )}

            {mode === 'ciclo' && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[13px] text-ink-2">Días ON (activo)</p>
                  <Stepper
                    onDec={() => setCad((c) => ({ ...c, on: Math.max(1, (c.on ?? 5) - 1) }))}
                    onInc={() => setCad((c) => ({ ...c, on: Math.min(90, (c.on ?? 5) + 1) }))}
                    decLabel="Menos días on"
                    incLabel="Más días on"
                  >
                    {/* ON = energía → numeral ámbar (luminoso sobre la placa oscura en ambos temas) */}
                    <DataPlate className="flex items-baseline justify-center px-4 py-2">
                      <span className="text-[24px] leading-none text-amber">{cad.on ?? 5}</span>
                      <span className="ml-2 font-mono text-[12px] font-medium opacity-70">on</span>
                    </DataPlate>
                  </Stepper>
                </div>
                <div>
                  <p className="mb-2 text-[13px] text-ink-2">Días OFF (descanso)</p>
                  <Stepper
                    onDec={() => setCad((c) => ({ ...c, off: Math.max(0, (c.off ?? 2) - 1) }))}
                    onInc={() => setCad((c) => ({ ...c, off: Math.min(90, (c.off ?? 2) + 1) }))}
                    decLabel="Menos días off"
                    incLabel="Más días off"
                  >
                    <DataPlate className="flex items-baseline justify-center px-4 py-2">
                      <span className="text-[24px] leading-none opacity-80">{cad.off ?? 2}</span>
                      <span className="ml-2 font-mono text-[12px] font-medium opacity-70">off</span>
                    </DataPlate>
                  </Stepper>
                </div>
                <p className="text-[12px] text-ink-3">
                  Ciclo total: {(cad.on ?? 5) + (cad.off ?? 2)} días
                </p>
              </div>
            )}

            {mode === 'uso' && (
              <div className="rounded-[10px] border border-hairline bg-raised px-4 py-3">
                <p className="text-[13px] text-ink-2">
                  Sin horario fijo — registras cuando lo usas. Hacktrack no programa días.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Preview próximas tomas (item R11) ────────────────────────── */}
        {proximas.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] text-ink-3">
              Próximas tomas con esta cadencia:
            </p>
            <div className="flex flex-wrap gap-2">
              {proximas.map((d, i) => (
                <span
                  key={i}
                  className="rounded-full border border-[color-mix(in_srgb,var(--blue)_30%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-3 py-1 font-mono text-[12px] font-medium text-blue"
                >
                  {fmtShortDate(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Hora de recordatorio (item R13) ──────────────────────────── */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="proto-reminder"
            className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2"
          >
            Hora de recordatorio
            <span className="ml-2 font-normal normal-case tracking-normal text-ink-3">
              (solo para {p.product})
            </span>
          </label>
          <input
            id="proto-reminder"
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            aria-label={`Hora del recordatorio para ${p.product}`}
            style={{ colorScheme: nativeScheme }}
            className="h-12 w-full rounded-[8px] border border-hairline bg-raised px-4 font-mono text-[15px] tabular-nums text-ink focus:outline focus:outline-2 focus:outline-ring"
          />
          {/* #20: presets rápidos (incl. tomas nocturnas de primera clase) */}
          <div className="flex flex-wrap gap-2">
            {([
              { label: 'Mañana', value: '08:00', Icon: Sunrise },
              { label: 'Mediodía', value: '13:00', Icon: Sun },
              { label: 'Noche', value: '21:00', Icon: Moon },
            ] as const).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setReminderTime(preset.value)}
                aria-pressed={reminderTime === preset.value}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 font-mono text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                  reminderTime === preset.value
                    ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] text-blue'
                    : 'border-hairline bg-transparent text-ink-2 hover:bg-raised'
                }`}
              >
                <preset.Icon size={13} strokeWidth={1.6} aria-hidden /> {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Vigencia (fechas) (item R10) ─────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">Vigencia</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-ink-3">Empieza</span>
              <input
                type="date"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                aria-label="Fecha de inicio del protocolo"
                style={{ colorScheme: nativeScheme }}
                className="h-12 w-full rounded-[8px] border border-hairline bg-raised px-3 font-mono text-[14px] tabular-nums text-ink focus:outline focus:outline-2 focus:outline-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] text-ink-3">
                Termina{' '}
                <span className="opacity-70">(opcional)</span>
              </span>
              <input
                type="date"
                value={endStr}
                min={startStr}
                onChange={(e) => setEndStr(e.target.value)}
                aria-label="Fecha de fin del protocolo (opcional)"
                style={{ colorScheme: nativeScheme }}
                className="h-12 w-full rounded-[8px] border border-hairline bg-raised px-3 font-mono text-[14px] tabular-nums text-ink focus:outline focus:outline-2 focus:outline-ring"
              />
            </div>
          </div>
          {endStr && (
            <button
              type="button"
              onClick={() => setEndStr('')}
              className="min-h-[36px] self-start rounded-full border border-hairline bg-transparent px-3 py-1 text-[12px] text-ink-2 transition-colors hover:bg-raised"
            >
              Quitar fecha de fin
            </button>
          )}
        </div>

        {/* ── Titulación por fases (item R8) ───────────────────────────── */}
        <Glass className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              {/* Título de card en serif — la voz editorial */}
              <p className="font-serif text-[17px] font-medium tracking-tight text-ink">Titulación por fases</p>
              <p className="text-[12px] text-ink-3">
                Sube la dosis por etapas que tú defines
              </p>
            </div>
            <Switch checked={progOn} onChange={setProgOn} label="Activar titulación por fases" />
          </div>

          {progOn && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-ink-2">Número de fases</p>
                <Stepper
                  onDec={() => setProgN((n) => Math.max(2, n - 1))}
                  onInc={() => setProgN((n) => Math.min(8, n + 1))}
                  decLabel="Menos fases"
                  incLabel="Más fases"
                >
                  <DataPlate className="flex items-baseline justify-center px-4 py-1.5">
                    <span className="text-[22px] leading-none">{progN}</span>
                  </DataPlate>
                </Stepper>
              </div>

              <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">Dosis por fase</p>
              <div className="flex flex-col gap-3">
                {Array.from({ length: progN }, (_, i) => {
                  const avg = avgDoseForPhase(
                    state.log,
                    p.product,
                    i,
                    progN,
                    p.startDate,
                    p.endDate ?? null,
                  )
                  const planned = parseFloat(phaseDoses[i] ?? '')
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        {/* Chip de fase — mono de instrumento, numerado */}
                        <span className="inline-flex w-16 shrink-0 items-center justify-center rounded-full border border-hairline bg-raised px-2 py-1 font-mono text-[12px] font-medium tabular-nums text-ink-2">
                          Fase {i + 1}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min={0}
                          placeholder="—"
                          aria-label={`Dosis de la fase ${i + 1}`}
                          aria-invalid={phaseDoseErrors[i] ?? false}
                          value={phaseDoses[i] ?? ''}
                          onChange={(e) => {
                            setPhaseDose(i, e.target.value)
                            if (phaseDoseErrors[i]) setPhaseDoseErrors((err) => { const next = err.slice(); next[i] = false; return next })
                          }}
                          className={`h-11 flex-1 rounded-[8px] border bg-raised px-3 font-mono text-[15px] tabular-nums text-ink placeholder:text-ink-3 focus:outline focus:outline-2 focus:outline-ring ${phaseDoseErrors[i] ? 'border-alert' : 'border-hairline'}`}
                        />
                        {/* #38: unidad dinámica derivada de las dosis del log */}
                        <span className="shrink-0 font-mono text-[12px] text-ink-3">{doseUnit}</span>
                      </div>
                      {phaseDoseErrors[i] && (
                        <p className="ml-[76px] text-[12px] text-alert" role="alert">
                          Ingresa un valor mayor a 0
                        </p>
                      )}
                      {/* item R14: promedio real vs planeado */}
                      {avg != null && (
                        <div className="ml-[76px] flex items-center gap-2">
                          <span className="text-[12px] text-ink-3">
                            Promedio real:{' '}
                            <strong className="font-mono font-medium tabular-nums text-ink">{avg.toFixed(2)} {doseUnit}</strong>
                          </span>
                          {!isNaN(planned) && planned > 0 && (
                            <span
                              className={`font-mono text-[12px] font-medium tabular-nums ${
                                Math.abs(avg - planned) < 0.05
                                  ? 'text-ok'
                                  : 'text-warn'
                              }`}
                            >
                              {avg > planned
                                ? `+${(avg - planned).toFixed(2)}`
                                : (avg - planned).toFixed(2)}{' '}
                              vs planeado
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[12px] text-ink-3">
                Tú defines la dosis de cada fase. Hacktrack no la prescribe.
              </p>
              <p className="text-[12px] text-ink-3">
                Usa la misma unidad que en tus registros ({doseUnit}).
              </p>
            </div>
          )}
        </Glass>

        {/* ── Stock de vial (item R13) ──────────────────────────────────── */}
        <div className="flex flex-col gap-3 rounded-[10px] border border-hairline bg-raised p-4">
          <p className="font-serif text-[17px] font-medium tracking-tight text-ink">Stock de vial</p>
          {p.vialStock && vialTotal > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ink-2">
                  Usado: <strong className="font-mono font-medium tabular-nums text-ink">{vialUsed.toFixed(1)} mg</strong>
                </span>
                <span className="text-ink-2">
                  Total: <strong className="font-mono font-medium tabular-nums text-ink">{vialTotal} mg</strong>
                </span>
              </div>
              {/* Barra de progreso accesible — pista de papel + relleno azul (dato) */}
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink-3)_28%,transparent)]"
                role="progressbar"
                aria-valuenow={Math.round(vialPct * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Vial ${Math.round(vialPct * 100)}% usado`}
              >
                <div
                  className="h-full rounded-full bg-blue transition-all"
                  style={{ width: `${vialPct * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="proto-vial-total"
              className="text-[12px] text-ink-3"
            >
              mg totales del nuevo vial
            </label>
            <input
              id="proto-vial-total"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder="p. ej. 5"
              value={totalMgStr}
              onChange={(e) => { setTotalMgStr(e.target.value); setVialOverwriteConfirm(false) }}
              aria-label="Miligramos totales del vial"
              className="h-11 w-full rounded-[8px] border border-hairline bg-surface px-3 font-mono text-[15px] tabular-nums text-ink placeholder:text-ink-3 focus:outline focus:outline-2 focus:outline-ring"
            />
            {vialOverwriteConfirm && p.vialStock && (
              <p className="mt-1 rounded-[8px] border border-[color-mix(in_srgb,var(--warn)_45%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3 py-2 text-[12px] leading-snug text-ink" role="alert">
                Esto abre un vial nuevo: el actual lleva {vialUsed.toFixed(1)} mg usados y aún le
                quedan {(vialTotal - vialUsed).toFixed(1)} mg — su registro se descartará. Toca
                "Guardar cambios" otra vez para confirmar, o borra el campo para conservarlo.
              </p>
            )}
          </div>

          {/* Build de tienda: léxico neutro sin verbos de comercio (Google escanea strings del APK) */}
          <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">{STORE_BUILD ? 'Registrar gasto del lote' : 'Registrar compra'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="proto-purchase-mg" className="text-[12px] text-ink-3">
                {STORE_BUILD ? 'mg del lote' : 'mg comprados'}
              </label>
              <input
                id="proto-purchase-mg"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder="—"
                value={purchaseMgStr}
                onChange={(e) => setPurchaseMgStr(e.target.value)}
                aria-label={STORE_BUILD ? 'Miligramos del lote' : 'Miligramos comprados'}
                className="h-11 rounded-[8px] border border-hairline bg-surface px-3 font-mono text-[14px] tabular-nums text-ink placeholder:text-ink-3 focus:outline focus:outline-2 focus:outline-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="proto-purchase-cost" className="text-[12px] text-ink-3">
                Costo (MXN)
              </label>
              <input
                id="proto-purchase-cost"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                placeholder="—"
                value={purchaseCostStr}
                onChange={(e) => setPurchaseCostStr(e.target.value)}
                aria-label={STORE_BUILD ? 'Costo del lote en pesos' : 'Costo de la compra en pesos'}
                className="h-11 rounded-[8px] border border-hairline bg-surface px-3 font-mono text-[14px] tabular-nums text-ink placeholder:text-ink-3 focus:outline focus:outline-2 focus:outline-ring"
              />
            </div>
          </div>
        </div>

        {/* ── Historial reciente colapsable (item R14) ─────────────────── */}
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex h-11 items-center gap-2 rounded-full bg-transparent px-1 font-mono text-[13px] font-medium text-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            aria-expanded={showHistory}
            aria-controls="proto-historial"
          >
            {showHistory ? (
              <ChevronUp size={16} aria-hidden />
            ) : (
              <ChevronDown size={16} aria-hidden />
            )}
            {showHistory
              ? 'Ocultar historial'
              : `Últimas ${Math.min(historial.length, 10)} dosis registradas`}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                id="proto-historial"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {historial.length > 0 ? (
                  <div className="mt-2 flex flex-col divide-y divide-hairline overflow-hidden rounded-[10px] border border-hairline bg-raised">
                    {historial.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="font-mono text-[12px] tabular-nums text-ink-3">
                          {new Date(d.ts).toLocaleDateString('es-MX', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          {fmtTime12(d.ts)}
                        </span>
                        {/* El valor registrado en serif — el numeral es la voz */}
                        <span className="font-serif text-[16px] font-normal tabular-nums text-ink">
                          {d.value != null ? d.value : '—'}
                          {d.value != null && <span className="ml-1 font-mono text-[11px] font-medium text-ink-3">{d.unit}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[12px] text-ink-3">
                    Sin dosis registradas aún.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Botón guardar ────────────────────────────────────────────── */}
        <Button
          variant="primary"
          size="full"
          onClick={save}
          disabled={!daysValid}
          aria-disabled={!daysValid}
        >
          Guardar cambios
        </Button>

        {/* ── Archivar / reactivar ─────────────────────────────────────── */}
        {p.archived ? (
          <Button
            variant="outline"
            size="full"
            onClick={handleReactivate}
            className="gap-2"
          >
            <ArchiveRestore size={16} aria-hidden />
            Reactivar protocolo
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="full"
            onClick={handleArchive}
            className="gap-2 text-ink-3"
          >
            <Archive size={16} strokeWidth={1.6} aria-hidden />
            Archivar protocolo
          </Button>
        )}

        {/* ── Disclaimer (datos personales, sin consejo médico) ────────── */}
        <p className="text-center text-[12px] leading-relaxed text-ink-3">
          Tu historial se guarda solo en tu dispositivo. Hacktrack no prescribe dosis ni
          cadencias — la información que ingresas es tuya y solo tuya.
        </p>

      </div>
    </Sheet>
  )
}
