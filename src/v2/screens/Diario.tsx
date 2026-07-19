// Diario — la bitácora cronológica, restyle "Bitácora" (LOCKED 2026-07-17).
// Log editorial: masthead + secciones con §-folios, numerales serif en horas/fechas,
// tarjetas de registro como "columna impresa" (hairlines, jerarquía tipográfica),
// filtros como chips mono, sheet de edición sobre primitivas. Overhaul ESTÉTICO:
// dispatches, semántica de adherencia y copy de cumplimiento intactos.
// Semana es alcanzable desde aquí vía el segmentado "Registro | Semana".
import { useState, useMemo, useEffect, useDeferredValue, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion, PanInfo } from 'framer-motion'
import {
  Droplet,
  Activity,
  SkipForward,
  AlertTriangle,
  Check,
  Clock,
  Search,
  X,
  Download,
  Shield,
  TrendingUp,
  TrendingDown,
  Flame,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useApp, adherenceMonth } from '../../lib/store'
import { dayLabel, cyclePhaseInfo } from '../../lib/cadence'
import {
  productStreak,
  protocolStreak,
  phaseForDate,
} from '../../lib/calendar'
import { presenceNow } from '../../lib/pharma'
import { MON, WD, MEASURE_META } from '../../lib/catalog'
import { rachaLabel } from '../../lib/buildFlags'
import type { LogItem, RangeFilter, AdverseSeverity } from '../../lib/types'
import { Glass } from '../ui/Glass'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { SectionHero } from '../ui/SectionHero'
import { HEROES } from '../lib/heroes'
import { SegmentedTabs } from '../ui/SegmentedTabs'
import { FolioLabel } from '../ui/FolioLabel'
import { TermInfo } from '../ui/TermInfo'
import { staggerContainer, staggerItem } from '../lib/motion'
import { Semana } from './Semana'

// ── helpers de fecha ─────────────────────────────────────────────────────────

function groupLabel(dateKey: string, todayTs: number): string {
  return dayLabel(new Date(dateKey + 'T00:00:00'), new Date(todayTs))
}

function todayLabel(ts: number): string {
  const d = new Date(ts)
  return `${WD[d.getDay()]}, ${d.getDate()} de ${MON[d.getMonth()]}`
}

function getISOWeekKey(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00')
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (x: Date) => `${x.getDate()} ${MON[x.getMonth()]}`
  return `Semana del ${fmt(mon)} al ${fmt(sun)}`
}

// ── CSV export ───────────────────────────────────────────────────────────────

function buildCsv(items: LogItem[]): string {
  // BOM UTF-8 para que Excel / Sheets abran el archivo correctamente (#49)
  const BOM = '﻿'
  const rows: string[][] = [['Fecha', 'Hora', 'HoraISO', 'Timestamp', 'Tipo', 'Nombre', 'Valor', 'Unidad', 'ValorDisplay', 'Producto', 'Nota', 'Efecto']]
  for (const it of items) {
    const d = new Date(it.ts)
    rows.push([
      d.toLocaleDateString('es-MX'),
      it.t,
      d.toISOString(),
      String(it.ts),
      it.type,
      it.n,
      it.value != null ? String(it.value) : '',
      it.unit ?? '',
      it.u,
      it.product ?? '',
      it.note ?? '',
      it.effect ?? '',
    ])
  }
  return BOM + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── filtros ──────────────────────────────────────────────────────────────────

type TypeFilter = 'todo' | 'dose' | 'medida'

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'dose', label: 'Dosis' },
  { value: 'medida', label: 'Medidas' },
]

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 'all', label: 'Todo' },
]

const FILTER_KEY = 'hk_diario_filters'

function readFilters(): { typeFilter: TypeFilter; rangeFilter: RangeFilter; productFilter?: string } | null {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (![7, 30, 90, 'all'].includes(parsed.rangeFilter)) parsed.rangeFilter = 7
    if (!['todo', 'dose', 'medida'].includes(parsed.typeFilter)) parsed.typeFilter = 'todo'
    return parsed
  } catch {
    return null
  }
}

// ── clases compartidas (Bitácora) ────────────────────────────────────────────
// Alfa sobre var() no se emite en este setup (ver Button.tsx) → tintes vía color-mix
// en clases arbitrarias LITERALES (el JIT necesita verlas escritas).

const LABEL_CLS = 'block font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2 mb-2'
const INPUT_CLS = 'h-11 w-full rounded-[8px] border border-hairline bg-raised px-3 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue'

// ── iconos por tipo de registro ──────────────────────────────────────────────

function ItemIcon({ item }: { item: LogItem }) {
  const base = 'grid place-items-center rounded-full shrink-0'
  const size = 'w-9 h-9'

  if (item.type === 'dose') {
    return (
      <span className={`${base} ${size} bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] border border-[color-mix(in_srgb,var(--blue)_25%,transparent)]`}>
        <Droplet size={16} className="text-blue" />
      </span>
    )
  }
  if (item.type === 'skip') {
    return (
      <span className={`${base} ${size} bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] border border-[color-mix(in_srgb,var(--warn)_28%,transparent)]`}>
        <SkipForward size={16} className="text-warn" />
      </span>
    )
  }
  if (item.type === 'efecto-adverso') {
    return (
      <span className={`${base} ${size} bg-[color-mix(in_srgb,var(--alert)_12%,transparent)] border border-[color-mix(in_srgb,var(--alert)_28%,transparent)]`}>
        <AlertTriangle size={16} className="text-alert" />
      </span>
    )
  }
  // medida, ayuno, otros
  return (
    <span className={`${base} ${size} bg-raised border border-hairline`}>
      <Activity size={16} className="text-ink-2" />
    </span>
  )
}

// ── badge de estado (ícono + texto + color — nunca color solo) ───────────────

function StatusBadge({ item }: { item: LogItem }) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[12px] font-medium border'
  if (item.type === 'dose') {
    return (
      <span className={`${base} bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] border-[color-mix(in_srgb,var(--blue)_25%,transparent)] text-blue`}>
        <Check size={10} strokeWidth={3} /> Dosis
      </span>
    )
  }
  if (item.type === 'skip') {
    return (
      <span className={`${base} bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] border-[color-mix(in_srgb,var(--warn)_28%,transparent)] text-warn`}>
        <SkipForward size={10} /> Saltada
      </span>
    )
  }
  if (item.type === 'efecto-adverso') {
    const sev = item.severity
    const color = sev === 'severo'
      ? 'text-alert bg-[color-mix(in_srgb,var(--alert)_12%,transparent)] border-[color-mix(in_srgb,var(--alert)_28%,transparent)]'
      : sev === 'moderado'
        ? 'text-warn bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] border-[color-mix(in_srgb,var(--warn)_28%,transparent)]'
        : 'text-ink-2 bg-raised border-hairline'
    const label = sev === 'severo' ? 'Severo' : sev === 'moderado' ? 'Moderado' : 'Leve'
    return (
      <span className={`${base} ${color}`}>
        <AlertTriangle size={10} /> {label}
      </span>
    )
  }
  if (item.type === 'medida') {
    return (
      <span className={`${base} bg-raised border-hairline text-ink-2`}>
        <Activity size={10} /> Medida
      </span>
    )
  }
  return null
}

// ── sheet de edición inline (R51) ────────────────────────────────────────────

// Unidades de dosis válidas del sistema. El editor las restringe a estas (antes la unidad era texto
// libre → se podían meter unidades que el sistema no reconoce).
const DOSE_UNITS = ['mg', 'mcg', 'UI', 'mL'] as const
function normDoseUnit(u: string | null | undefined): string {
  if (u === 'clics') return 'UI' // alias legado
  return (DOSE_UNITS as readonly string[]).includes(u ?? '') ? (u as string) : 'mg'
}

function EditLogSheet({
  item,
  open,
  onClose,
  dispatch,
}: {
  item: LogItem
  open: boolean
  onClose: () => void
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  // estado local del formulario
  const [value, setValue] = useState<string>(() => item.value != null ? String(item.value) : '')
  const [unit, setUnit] = useState<string>(() => normDoseUnit(item.unit))
  const [note, setNote] = useState<string>(item.note ?? '')
  // severidad editable — solo efectos adversos (#122); sin severidad guardada se muestra 'leve'
  // (igual que el badge del Diario, que cae a 'Leve' cuando severity es undefined)
  const [severity, setSeverity] = useState<AdverseSeverity>(item.severity ?? 'leve')
  // hora editable: extraída del timestamp
  const [timeStr, setTimeStr] = useState<string>(() => {
    const d = new Date(item.ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })

  // re-sincronizar si el item cambia (ej. otro dispatch)
  useEffect(() => {
    if (!open) return
    setValue(item.value != null ? String(item.value) : '')
    setUnit(normDoseUnit(item.unit))
    setNote(item.note ?? '')
    setSeverity(item.severity ?? 'leve')
    const d = new Date(item.ts)
    setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
  }, [open, item.ts, item.value, item.unit, item.note, item.severity])

  function handleSave() {
    const numVal = value.trim() !== '' ? parseFloat(value) : null

    // R51a: editar valor/unidad/nota vía editLog. 'Cambio de medidas' es COMPUESTO (Peso+Altura+%grasa+
    // %músculo+IMC en un solo registro): un único value no le corresponde → no se edita su valor aquí
    // (se editaría desincronizando el perfil/history). Solo hora + nota; el resto se ajusta en Cambio de medidas.
    const editableValue = item.type === 'dose' || (item.type === 'medida' && item.n !== 'Cambio de medidas')
    if (editableValue) {
      dispatch({
        t: 'editLog',
        id: item.id,
        patch: {
          value: numVal,
          unit: unit.trim() || null,
          note: note.trim() || null,
        },
      })
    } else {
      // skip / compuesto / efecto-adverso / otros: nota (y severidad si aplica)
      const severityChanged = item.type === 'efecto-adverso' && severity !== (item.severity ?? 'leve')
      if (note.trim() !== (item.note ?? '') || severityChanged) {
        dispatch({
          t: 'editLog',
          id: item.id,
          patch: {
            note: note.trim() || null,
            ...(severityChanged ? { severity } : {}),
          },
        })
      }
    }

    // R51b: editar hora vía editLogTime
    const parts = timeStr.split(':').map(Number)
    const hh = parts[0] ?? 0
    const mm = parts[1] ?? 0
    const base = new Date(item.ts)
    base.setHours(hh, mm, 0, 0)
    if (base.getTime() !== item.ts) {
      dispatch({ t: 'editLogTime', id: item.id, ts: base.getTime() })
    }

    onClose()
  }

  const isComposite = item.type === 'medida' && item.n === 'Cambio de medidas'
  const canEdit = item.type === 'dose' || (item.type === 'medida' && !isComposite)
  const measureMeta = item.type === 'medida' ? MEASURE_META[item.n] : undefined

  return (
    <Sheet open={open} onClose={onClose} title={`Editar — ${item.type === 'skip' ? 'Dosis saltada' : item.n}`}>
      <div className="flex flex-col gap-5 px-1">
        {/* hora (siempre editable) */}
        <div>
          <label className={LABEL_CLS}>
            Hora
          </label>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className={`${INPUT_CLS} font-mono tabular-nums`}
          />
        </div>

        {/* valor numérico (dosis/medida) */}
        {canEdit && (
          <div>
            <label className={LABEL_CLS}>
              {item.type === 'dose' ? 'Dosis' : 'Valor'}
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className={`${INPUT_CLS} flex-1 font-mono tabular-nums`}
              />
              {/* unidad — solo dosis; SELECT restringido a las unidades del sistema (no texto libre) */}
              {item.type === 'dose' && (
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  aria-label="Unidad de dosis"
                  className="w-20 h-11 rounded-[8px] border border-hairline bg-raised px-2 font-mono text-[14px] text-ink focus:outline-none focus:border-blue"
                >
                  {DOSE_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              )}
              {/* medida: unidad fija del meta */}
              {item.type === 'medida' && measureMeta && (
                <span className="flex items-center px-3 font-mono text-[13px] text-ink-2 shrink-0">
                  {measureMeta.unit ?? ''}
                </span>
              )}
            </div>
          </div>
        )}

        {isComposite && (
          <p className="text-[13px] leading-relaxed text-ink-2">
            Este registro agrupa varias medidas. Edita sus valores desde <span className="font-semibold text-blue">Inicio → Cambio de medidas</span>; aquí puedes ajustar la hora o la nota.
          </p>
        )}

        {/* severidad — solo efectos adversos (#122) */}
        {item.type === 'efecto-adverso' && (
          <div>
            <label className={LABEL_CLS}>
              Severidad
            </label>
            <div className="flex gap-2" role="radiogroup" aria-label="Severidad del efecto">
              {(['leve', 'moderado', 'severo'] as const).map((s) => {
                const active = severity === s
                const label = s === 'leve' ? 'Leve' : s === 'moderado' ? 'Moderado' : 'Severo'
                const activeCls = s === 'severo'
                  ? 'bg-[color-mix(in_srgb,var(--alert)_12%,transparent)] border-alert text-alert'
                  : s === 'moderado'
                    ? 'bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] border-warn text-warn'
                    : 'bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] border-blue text-blue'
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSeverity(s)}
                    className={`flex-1 h-11 rounded-[8px] border text-[13px] font-semibold transition-colors ${
                      active ? activeCls : 'bg-transparent border-hairline text-ink-2 hover:bg-raised'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* nota (siempre editable) */}
        <div>
          <label className={LABEL_CLS}>
            Nota <span className="normal-case tracking-normal text-ink-3">(opcional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            rows={2}
            placeholder="Observación personal…"
            className="w-full rounded-[8px] border border-hairline bg-raised px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-blue resize-none leading-snug"
          />
          <p className="mt-1 text-right font-mono text-[11px] tabular-nums text-ink-3">{note.length}/120</p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} className="flex-1">
            Guardar
          </Button>
        </div>

        <p className="pb-1 text-center text-[12px] text-ink-3">
          Tu historial se guarda solo en tu dispositivo
        </p>
      </div>
    </Sheet>
  )
}

// ── row de un registro con swipe-to-delete + tap-to-edit (R51 + R52) ─────────

const SWIPE_THRESHOLD = -72

function TimelineRow({
  item,
  presencePct,
  phaseIndex,
  onDelete,
  dispatch,
}: {
  item: LogItem
  presencePct?: number
  phaseIndex?: number | null
  onDelete: (id: string) => void
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  const isSkip = item.type === 'skip'
  const reduce = useReducedMotion()

  // R52: swipe state
  const [dragX, setDragX] = useState(0)
  const revealDelete = dragX < -32

  // R51: edit sheet state
  const [editOpen, setEditOpen] = useState(false)

  // #48: Trash confirmation state — primer tap arma, segundo tap dentro de 3s confirma
  const [trashArmed, setTrashArmed] = useState(false)
  const trashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canEdit = item.type === 'dose' || item.type === 'medida' || item.type === 'skip'

  function handleDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    // Cancelar si el gesto es más vertical que horizontal (scroll accidental)
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      setDragX(0)
      return
    }
    if (info.offset.x < SWIPE_THRESHOLD) {
      onDelete(item.id)
    }
    setDragX(0)
  }

  function handleTrashClick() {
    if (trashArmed) {
      // Segundo tap: confirmar
      if (trashTimerRef.current) clearTimeout(trashTimerRef.current)
      setTrashArmed(false)
      onDelete(item.id)
    } else {
      // Primer tap: armar
      setTrashArmed(true)
      trashTimerRef.current = setTimeout(() => {
        setTrashArmed(false)
        trashTimerRef.current = null
      }, 3000)
    }
  }

  // Limpiar timer al desmontar
  useEffect(
    () => () => { if (trashTimerRef.current) clearTimeout(trashTimerRef.current) },
    [],
  )

  return (
    <>
      <motion.div
        variants={staggerItem}
        className="relative overflow-hidden"
        style={{ borderRadius: 8 }}
      >
        {/* panel rojo reveal (R52) */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-[72px] flex items-center justify-center rounded-r-lg bg-alert transition-opacity"
          style={{ opacity: revealDelete ? 1 : 0 }}
        >
          <Trash2 size={18} className="text-white" />
        </div>

        {/* card deslizable — superficie OPACA (columna impresa) para cubrir el panel rojo */}
        <motion.div
          drag={reduce ? false : 'x'}
          dragConstraints={{ left: -80, right: 0 }}
          dragElastic={0.08}
          onDrag={(_e, info) => setDragX(info.offset.x)}
          onDragEnd={handleDragEnd}
          className={`flex items-start gap-3 px-3 py-3 min-h-[44px] bg-surface transition-opacity ${isSkip ? 'opacity-60' : ''}`}
          style={{ position: 'relative', zIndex: 1, touchAction: 'pan-y' }}
        >
          <ItemIcon item={item} />

          <div className="flex-1 min-w-0">
            {/* nombre */}
            <p className={`text-[15px] font-semibold leading-snug ${isSkip ? 'text-ink-2' : 'text-ink'}`}>
              {isSkip ? 'Dosis saltada (intencional)' : item.n}
            </p>

            {/* valor — readout mono (instrumento) */}
            <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-2">
              {item.u}
            </p>

            {/* nota */}
            {item.note && (
              <p className="mt-1 text-[12px] italic leading-snug text-ink-3">"{item.note}"</p>
            )}

            {/* efecto observado (dose) + intensidad 0–100 si la registró */}
            {item.type === 'dose' && item.effect && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] border border-[color-mix(in_srgb,var(--blue)_20%,transparent)] px-2 py-0.5 font-mono text-[11px] font-medium text-blue">
                {item.effect}
                {item.effectIntensity != null && <span className="tabular-nums opacity-80">· {item.effectIntensity}</span>}
              </span>
            )}

            {/* barra de presencia farmacológica */}
            {item.type === 'dose' && typeof presencePct === 'number' && presencePct > 0 && (
              <div className="mt-1.5">
                <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">Presencia estimada</p>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]">
                  <div className="h-full rounded-full bg-blue" style={{ width: `${presencePct}%` }} />
                </div>
              </div>
            )}

            {/* fase de titulación */}
            {item.type === 'dose' && phaseIndex != null && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] border border-[color-mix(in_srgb,var(--blue)_20%,transparent)] px-2 py-0.5 font-mono text-[11px] font-medium text-blue">
                Fase {phaseIndex + 1}
              </span>
            )}
          </div>

          {/* hora + estado — columna derecha; la hora es numeral SERIF (la voz) */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className="font-serif text-[16px] font-normal tabular-nums leading-none text-ink">{item.t}</span>
            <StatusBadge item={item} />
          </div>

          {/* acciones: editar + eliminar (R51 + R52) */}
          <div className="flex items-center shrink-0 -mr-1.5">
            {/* botón editar (R51) */}
            {canEdit && (
              <button
                type="button"
                aria-label={`Editar ${isSkip ? 'dosis saltada' : item.n}`}
                onClick={() => setEditOpen(true)}
                className="h-11 w-11 flex items-center justify-center rounded-md text-ink-3 hover:text-blue transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Pencil size={13} />
              </button>
            )}
            {/* botón eliminar (R52) — requiere doble tap para confirmar (#48) */}
            <button
              type="button"
              aria-label={trashArmed ? `Confirmar eliminación de ${isSkip ? 'dosis saltada' : item.n}` : `Eliminar ${isSkip ? 'dosis saltada de ' + item.u : item.n}`}
              onClick={handleTrashClick}
              className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${trashArmed ? 'text-alert bg-[color-mix(in_srgb,var(--alert)_12%,transparent)]' : 'text-ink-3 hover:text-alert'}`}
            >
              {trashArmed ? <Check size={13} strokeWidth={3} /> : <Trash2 size={13} />}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* R51: sheet de edición (montado fuera del swipeable para no heredar transform) */}
      <EditLogSheet
        item={item}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        dispatch={dispatch}
      />
    </>
  )
}

// ── estado vacío ─────────────────────────────────────────────────────────────

function EmptyDiario({
  typeFilter,
  productFilter,
  rangeFilter,
  onExpandRange,
  onClearProduct,
  dispatch,
}: {
  typeFilter: TypeFilter
  productFilter: string
  rangeFilter: RangeFilter
  onExpandRange: () => void
  onClearProduct: () => void
  dispatch: ReturnType<typeof useApp>['dispatch']
}) {
  let icon = <Droplet size={32} className="text-blue opacity-60" />
  let title = 'Tu diario está vacío'
  let sub = 'Cada dosis y medida que registres aparecerá aquí.'
  let ctaLabel = 'Registrar dosis'
  let ctaAction = () => dispatch({ t: 'sheet', sheet: 'registrar' })

  if (productFilter !== 'todos') {
    title = `Sin registros de ${productFilter}`
    sub = 'Cambia el rango o limpia el filtro de producto.'
    ctaLabel = 'Ver todos los productos'
    ctaAction = onClearProduct
  } else if (typeFilter === 'dose') {
    title = 'Sin dosis en este rango'
    sub = 'Cambia el período o registra algo nuevo.'
  } else if (typeFilter === 'medida') {
    icon = <Activity size={32} className="text-ink-3" />
    title = 'Sin medidas en este rango'
    sub = 'Cambia el período o registra una medida nueva.'
    ctaLabel = 'Registrar medida'
    ctaAction = () => dispatch({ t: 'sheet', sheet: 'medida' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 py-12 text-center"
    >
      <div className="grid h-16 w-16 place-items-center rounded-full border border-hairline bg-raised">
        {icon}
      </div>
      <div>
        <p className="font-serif text-[20px] font-normal text-ink">{title}</p>
        <p className="mt-1 text-[13px] text-ink-2">{sub}</p>
      </div>
      <Button variant="outline" size="sm" onClick={ctaAction}>{ctaLabel}</Button>
      {rangeFilter === 7 && productFilter === 'todos' && (
        <button
          type="button"
          onClick={onExpandRange}
          className="flex min-h-[44px] items-center text-[13px] text-blue underline underline-offset-2"
        >
          Ampliar a 30 días
        </button>
      )}
    </motion.div>
  )
}

// ── resumen de medidas ───────────────────────────────────────────────────────

function MeasureSummary({
  filtered,
  folioN,
}: {
  filtered: { dateKey: string; items: LogItem[] }[]
  folioN?: number // número § del folio (la secuencia la decide el padre)
}) {
  const stats = useMemo(() => {
    const byName: Record<string, { first: number; last: number; firstTs: number; lastTs: number }> = {}
    for (const g of filtered) {
      for (const it of g.items) {
        if (it.type !== 'medida') continue
        // #50: preferir it.value cuando existe; regex sobre it.u solo como fallback
        let val: number
        if (it.value != null) {
          val = it.value
        } else {
          const numMatch = it.u.match(/^([\d.]+)/)
          if (!numMatch) continue
          val = parseFloat(numMatch[1])
        }
        if (isNaN(val)) continue
        if (!byName[it.n]) {
          byName[it.n] = { first: val, last: val, firstTs: it.ts, lastTs: it.ts }
        } else {
          if (it.ts < byName[it.n].firstTs) { byName[it.n].first = val; byName[it.n].firstTs = it.ts }
          if (it.ts > byName[it.n].lastTs) { byName[it.n].last = val; byName[it.n].lastTs = it.ts }
        }
      }
    }
    return Object.entries(byName).map(([name, { first, last }]) => {
      const delta = last - first
      const meta = MEASURE_META[name]
      const positive = meta?.down ? delta < 0 : delta > 0
      const neutral = Math.abs(delta) < 0.01
      return { name, first, last, delta, positive, neutral }
    })
  }, [filtered])

  if (stats.length === 0) return null

  return (
    <div className="mb-4 flex flex-col gap-3">
      <FolioLabel n={folioN}>Resumen del período</FolioLabel>
      <Glass className="p-4">
        <div className="flex flex-col gap-2">
          {stats.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-2">{s.name}</span>
              {s.neutral ? (
                // Sin cambio en el período (o una sola muestra): solo el valor actual, sin flecha ni delta
                <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink-2">{s.last}</span>
              ) : (
                <>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums text-ink-3">
                    {s.first} → {s.last}
                  </span>
                  {/* estado nunca color-solo: flecha + signo acompañan al color */}
                  <span className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-[13px] font-bold tabular-nums ${s.positive ? 'text-ok' : 'text-alert'}`}>
                    {s.delta > 0 ? '+' : ''}{s.delta.toFixed(1)}
                    {s.positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </Glass>
    </div>
  )
}

// ── componente principal ─────────────────────────────────────────────────────

export function Diario() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // vista interna: Registro (la bitácora) | Semana (resumen semanal embebido).
  // Solo presentación — la pantalla Semana sigue existiendo como destino propio en AppV2.
  const [view, setView] = useState<'registro' | 'semana'>('registro')

  // filtros (persistidos en localStorage)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => readFilters()?.typeFilter ?? 'todo')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>(() => readFilters()?.rangeFilter ?? 7)
  const [productFilter, setProductFilter] = useState<string>(() => readFilters()?.productFilter ?? 'todos')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [groupBy, setGroupBy] = useState<'dia' | 'semana'>('dia')

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify({ typeFilter, rangeFilter, productFilter })) } catch { /* storage no disponible */ }
  }, [typeFilter, rangeFilter, productFilter])

  // al cambiar a medidas limpiar filtro de producto
  useEffect(() => { if (typeFilter === 'medida') setProductFilter('todos') }, [typeFilter])

  // productos con registros
  const products = useMemo(() =>
    [...new Set(state.log.flatMap((g) => g.items.filter((it) => (it.type === 'dose' || it.type === 'skip') && it.product).map((it) => it.product!)))],
    [state.log],
  )

  const showProductFilter = products.length >= 2 && typeFilter !== 'medida'
  const pf = showProductFilter && products.includes(productFilter) ? productFilter : 'todos'

  // cutoff para rango
  const cutoff = useMemo(() => {
    if (rangeFilter === 'all') return 0
    const today = new Date(state.todayTs)
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - rangeFilter)
    return from.getTime()
  }, [rangeFilter, state.todayTs])

  // grupos filtrados
  const filtered = useMemo(() =>
    state.log.map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.ts < cutoff) return false
        if (typeFilter !== 'todo' && it.type !== typeFilter) return false
        if (pf !== 'todos' && ((it.type !== 'dose' && it.type !== 'skip') || it.product !== pf)) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          if (!it.n.toLowerCase().includes(q) && !it.u.toLowerCase().includes(q) && !(it.note?.toLowerCase().includes(q) ?? false)) return false
        }
        return true
      }),
    })).filter((g) => g.items.length > 0),
    [state.log, cutoff, typeFilter, pf, searchQuery],
  )

  const deferredFiltered = useDeferredValue(filtered)
  const isEmpty = deferredFiltered.length === 0
  const totalRecords = deferredFiltered.reduce((acc, g) => acc + g.items.length, 0)

  // Grupos del rango para "Resumen del período" (mismo filtro que recibe MeasureSummary) y si la
  // sección existirá — de eso depende la numeración § de las secciones siguientes (Cronología).
  const summaryGroups = useMemo(
    () =>
      state.log.filter((g) => {
        const ts = new Date(g.dateKey + 'T00:00:00').getTime()
        return ts >= cutoff
      }),
    [state.log, cutoff],
  )
  const hasResumen =
    (typeFilter === 'medida' || typeFilter === 'todo') &&
    !isEmpty &&
    summaryGroups.some((g) => g.items.some((it) => it.type === 'medida'))

  // conteos por tipo (para badges en el header)
  const doseCount = useMemo(() => deferredFiltered.reduce((a, g) => a + g.items.filter((it) => it.type === 'dose').length, 0), [deferredFiltered])
  const medCount = useMemo(() => deferredFiltered.reduce((a, g) => a + g.items.filter((it) => it.type === 'medida').length, 0), [deferredFiltered])

  // reloj propio cada 30 s — IGUAL que Inicio — para que el % de adherencia se recalcule en el mismo
  // instante (si no, cerca de la hora de una toma podían divergir ~medio minuto entre pantallas).
  const [adhNow, setAdhNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAdhNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // racha global: MISMA fuente de verdad que Inicio (protocolStreak — respeta días de descanso y da
  // gracia al día en curso). Antes el filtro 'todos' caminaba días crudos con ≥1 dosis, sin descansos
  // ni gracia → contradecía el número de Inicio cada día de descanso y cada mañana.
  const currentStreak = useMemo(() => {
    if (pf !== 'todos') return productStreak(state, pf, new Date(state.todayTs))
    return protocolStreak(state, new Date(state.todayTs), new Date(adhNow))
  }, [pf, state, adhNow])
  // adherencia: MISMA fuente de verdad que Inicio (adherenceMonth → % del mes en curso), para que
  // el número coincida entre pantallas. Antes Diario promediaba 8 semanas ISO → divergía de Inicio.
  const periodAdherence = useMemo(() => {
    const a = adherenceMonth(state, new Date(adhNow))
    return a ? a.pct : null
  }, [state, adhNow])

  // fase ciclo off para producto filtrado
  const productCycleOff = useMemo(() => {
    if (pf === 'todos') return null
    const proto = state.protocols[pf]
    if (!proto || proto.cadence.mode !== 'ciclo') return null
    const info = cyclePhaseInfo(proto.cadence, new Date(proto.startDate), new Date(state.todayTs))
    if (!info || info.phase !== 'off') return null
    return info
  }, [pf, state.protocols, state.todayTs])

  // presencia farmacológica — instante VIVO (adhNow, tick 30 s), no la medianoche (state.todayTs). Antes
  // divergía de Vida (que usa now real): para péptidos de t½ corta la presencia a las 00:00 ≠ la de la tarde.
  const presenceData = useMemo(() => presenceNow(state, adhNow), [state, adhNow])

  // timeline con gaps
  const timelineEntries = useMemo(() => {
    type Entry = { type: 'group'; group: typeof deferredFiltered[0] } | { type: 'gap'; days: number }
    const entries: Entry[] = []
    for (let i = 0; i < deferredFiltered.length; i++) {
      entries.push({ type: 'group', group: deferredFiltered[i] })
      if (i < deferredFiltered.length - 1) {
        const curr = new Date(deferredFiltered[i].dateKey + 'T00:00:00').getTime()
        const next = new Date(deferredFiltered[i + 1].dateKey + 'T00:00:00').getTime()
        const daysDiff = Math.round((curr - next) / 86400000)
        if (daysDiff > 1) entries.push({ type: 'gap', days: daysDiff - 1 })
      }
    }
    return entries
  }, [deferredFiltered])

  // agrupación por semana
  const groupedBySemana = useMemo(() => {
    if (groupBy === 'dia') return null
    const weeks: { weekKey: string; items: LogItem[] }[] = []
    for (const g of deferredFiltered) {
      const wk = getISOWeekKey(g.dateKey)
      const existing = weeks.find((w) => w.weekKey === wk)
      if (existing) {
        existing.items = [...existing.items, ...g.items].sort((a, b) => b.ts - a.ts)
      } else {
        weeks.push({ weekKey: wk, items: [...g.items] })
      }
    }
    return weeks
  }, [groupBy, deferredFiltered])

  // R52: borrar directamente (sin confirm-delete sheet del shell viejo).
  // deleteLog → setea toast "Registro borrado" + toastUndoId="__undo_delete__<id>" en store.
  // Toast global (AppV2) muestra el botón "Deshacer" durante 5s y llama undoDeleteLog.
  // Al expirar el timer (5s) limpiamos el buffer para liberar memoria.
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDelete = useCallback((id: string) => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    dispatch({ t: 'deleteLog', id })
    // clearDeletedLogBuffer después de 8s (undo extendido, #48)
    deleteTimerRef.current = setTimeout(() => {
      dispatch({ t: 'clearDeletedLogBuffer' })
      deleteTimerRef.current = null
    }, 5500)
  }, [dispatch])

  // Limpiar timer al desmontar
  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current) }, [])

  function handleExport() {
    const allItems = deferredFiltered.flatMap((g) => g.items)
    const csv = buildCsv(allItems)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const rangeLabel = rangeFilter === 'all' ? 'todo' : `${rangeFilter}d`
    const filename = `diario-hacktrack-${rangeLabel}.csv`
    if (typeof navigator.share === 'function') {
      const file = new File([blob], filename, { type: 'text/csv' })
      navigator.share({ files: [file], title: 'Diario Hacktrack' }).catch(() => downloadBlob(blob, filename))
    } else {
      downloadBlob(blob, filename)
    }
  }

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 pb-32 pt-[max(20px,env(safe-area-inset-top))]"
      initial={reduce ? false : 'hidden'}
      animate="show"
      variants={staggerContainer}
    >
      {/* ── masthead editorial ── */}
      <motion.div variants={staggerItem}>
        <SectionHero
          {...HEROES.diario}
          eyebrow="Bitácora · Registro"
          meta={todayLabel(state.todayTs)}
          metaClear
          title="Tu diario"
          subtitle={totalRecords > 0 ? `${totalRecords} registro${totalRecords !== 1 ? 's' : ''}` : undefined}
        />
      </motion.div>

      {/* ── host de vistas: Registro | Semana ── */}
      <motion.div variants={staggerItem}>
        <SegmentedTabs
          options={[
            { value: 'registro', label: 'Registro' },
            { value: 'semana', label: 'Semana' },
          ]}
          value={view}
          onChange={setView}
        />
      </motion.div>

      {view === 'semana' ? (
        <Semana embedded />
      ) : (
        <>
          {/* ── cabecera: conteos + acciones ── */}
          <motion.div variants={staggerItem}>
            <div className="flex items-start justify-between gap-2">
              {/* badges de conteo */}
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                {typeFilter === 'todo' && !isEmpty && (
                  <>
                    {doseCount > 0 && (
                      <span className="rounded-full border border-[color-mix(in_srgb,var(--blue)_25%,transparent)] bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-2.5 py-0.5 font-mono text-[12px] font-medium text-blue">{doseCount} dosis</span>
                    )}
                    {medCount > 0 && (
                      <span className="rounded-full border border-hairline bg-raised px-2.5 py-0.5 font-mono text-[12px] font-medium text-ink-2">{medCount} medidas</span>
                    )}
                  </>
                )}
              </div>

              {/* acciones: exportar + buscar */}
              <div className="flex shrink-0 items-center gap-2">
                {!isEmpty && (
                  <button
                    type="button"
                    aria-label="Exportar diario como CSV"
                    onClick={handleExport}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-[8px] border border-hairline px-3 font-mono text-[13px] font-medium text-ink-2 transition-colors hover:bg-raised hover:text-ink"
                  >
                    <Download size={16} />
                    <span>CSV</span>
                  </button>
                )}
                <button
                  type="button"
                  aria-label={showSearch ? 'Cerrar búsqueda' : 'Buscar en el diario'}
                  onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery('') }}
                  className={`flex h-11 w-11 items-center justify-center rounded-[8px] border transition-colors ${showSearch ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_10%,transparent)] text-blue' : 'border-hairline text-ink-3 hover:bg-raised hover:text-ink'}`}
                >
                  {showSearch ? <X size={16} /> : <Search size={16} />}
                </button>
              </div>
            </div>

            {/* campo de búsqueda */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-3"
                >
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                    <input
                      autoFocus
                      type="search"
                      placeholder="Buscar en el diario…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 w-full rounded-[8px] border border-hairline bg-surface pl-9 pr-10 text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="Limpiar búsqueda"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-ink-3 hover:text-ink"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── § 01 · filtros ── */}
          <motion.div variants={staggerItem}>
            <FolioLabel n={1}>Filtros</FolioLabel>
          </motion.div>

          {/* ── filtros de tipo ── */}
          <motion.div variants={staggerItem} className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map((o) => (
              <Chip key={o.value} active={typeFilter === o.value} onClick={() => setTypeFilter(o.value)}>
                {o.label}
              </Chip>
            ))}
          </motion.div>

          {/* ── filtro de producto ── */}
          {showProductFilter && (
            <motion.div variants={staggerItem} className="flex gap-2 flex-wrap">
              <Chip active={productFilter === 'todos'} onClick={() => setProductFilter('todos')}>Todos</Chip>
              {products.map((p) => (
                <Chip key={p} active={productFilter === p} onClick={() => setProductFilter(p)}>
                  {p}
                </Chip>
              ))}
            </motion.div>
          )}

          {/* ── rango de tiempo ── */}
          <motion.div variants={staggerItem} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {RANGE_OPTIONS.map((o) => (
                <Chip key={String(o.value)} active={rangeFilter === o.value} onClick={() => setRangeFilter(o.value)}>
                  {o.label}
                </Chip>
              ))}
              {!isEmpty && (
                <span className="ml-1 shrink-0 font-mono text-[12px] tabular-nums text-ink-3">
                  {totalRecords} registro{totalRecords !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* toggle día/semana en rangos amplios */}
            {(rangeFilter === 30 || rangeFilter === 90 || rangeFilter === 'all') && !isEmpty && (
              <div className="flex gap-2">
                {(['dia', 'semana'] as const).map((v) => (
                  <Chip key={v} active={groupBy === v} onClick={() => setGroupBy(v)}>
                    {v === 'dia' ? 'Día' : 'Semana'}
                  </Chip>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── racha + adherencia (estado siempre ícono + texto + color) ── */}
          {!isEmpty && (currentStreak > 0 || periodAdherence !== null) && (
            <motion.div variants={staggerItem} className="flex items-center gap-2 flex-wrap">
              {currentStreak > 0 && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[12px] font-medium ${currentStreak >= 7 ? 'text-ok border-[color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]' : 'text-warn border-[color-mix(in_srgb,var(--warn)_28%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]'}`}>
                  <Flame size={12} />
                  {/* rachaLabel: en tienda dice "Racha de registro" (Apple 1.4.3); PWA sin cambio */}
                  {rachaLabel('Racha')} {currentStreak} día{currentStreak !== 1 ? 's' : ''}
                </span>
              )}
              {periodAdherence !== null && (
                /* Chip + "?" agrupados en un solo hijo flex: el TermInfo NO puede envolver huérfano
                   a su propia línea bajo los chips (defecto visto en la captura de verificación). */
                <span className="inline-flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[12px] font-medium ${periodAdherence >= 70 ? 'text-ok border-[color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)]' : 'text-warn border-[color-mix(in_srgb,var(--warn)_28%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]'}`}>
                    <Check size={12} />
                    {periodAdherence}% adherencia este mes
                  </span>
                  {/* jerga a la mano (Ley 2): adherencia explicada en una línea */}
                  <TermInfo term="adherencia">Qué tanto vas al día con las tomas de tu protocolo este mes.</TermInfo>
                </span>
              )}
            </motion.div>
          )}

          {/* ── banner ciclo off ── */}
          {productCycleOff && (
            <motion.div variants={staggerItem}>
              <div className="flex items-center gap-2 rounded-sm border border-hairline bg-raised px-4 py-3 text-[13px] text-ink-2">
                <Clock size={14} className="shrink-0 text-ink-3" />
                Día de descanso ({productCycleOff.day}/{productCycleOff.total}) — período off activo
              </div>
            </motion.div>
          )}

          {/* ── § 02 · resumen de medidas ── */}
          {(typeFilter === 'medida' || typeFilter === 'todo') && !isEmpty && (
            <motion.div variants={staggerItem}>
              <MeasureSummary filtered={summaryGroups} folioN={2} />
            </motion.div>
          )}

          {/* ── aria-live para anunciar cambios de filtro ── */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {isEmpty ? 'Sin registros con el filtro actual' : `${totalRecords} registro${totalRecords !== 1 ? 's' : ''} mostrado${totalRecords !== 1 ? 's' : ''}`}
          </div>

          {/* ── cronología: § 03 tras el resumen, § 02 si el rango no trae medidas ── */}
          <motion.div variants={staggerItem}>
            <FolioLabel n={hasResumen ? 3 : 2}>Cronología</FolioLabel>
          </motion.div>

          {/* ── vacío / timeline ── */}
          <AnimatePresence mode="wait">
            {!mounted ? null : isEmpty ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyDiario
                  typeFilter={typeFilter}
                  productFilter={pf}
                  rangeFilter={rangeFilter}
                  onExpandRange={() => setRangeFilter(30)}
                  onClearProduct={() => setProductFilter('todos')}
                  dispatch={dispatch}
                />
              </motion.div>
            ) : (
              <motion.div
                key="timeline"
                initial={reduce ? false : 'hidden'}
                animate="show"
                variants={staggerContainer}
                role="list"
                aria-label={rangeFilter === 'all' ? 'Todos los registros' : `Registros de los últimos ${rangeFilter} días`}
              >
                {groupBy === 'semana' && groupedBySemana ? (
                  groupedBySemana.map((week) => (
                    <motion.div key={week.weekKey} variants={staggerItem} className="mb-6">
                      {/* encabezado de semana — folio editorial */}
                      <FolioLabel className="mb-2">
                        {week.weekKey} · {week.items.length}
                      </FolioLabel>
                      <Glass className="p-0 overflow-hidden">
                        <div className="divide-y divide-hairline">
                          {week.items.map((it) => (
                            <TimelineRow
                              key={it.id}
                              item={it}
                              onDelete={handleDelete}
                              dispatch={dispatch}
                            />
                          ))}
                        </div>
                      </Glass>
                    </motion.div>
                  ))
                ) : (
                  timelineEntries.map((entry, idx) => {
                    if (entry.type === 'gap') {
                      return (
                        <div key={`gap-${idx}`} className="my-2 mb-4 flex items-center gap-3 px-1">
                          <div className="h-px flex-1 bg-hairline" />
                          <span className="shrink-0 font-mono text-[11px] text-ink-3">
                            {entry.days} día{entry.days !== 1 ? 's' : ''} sin registros
                          </span>
                          <div className="h-px flex-1 bg-hairline" />
                        </div>
                      )
                    }

                    const { group } = entry
                    const label = groupLabel(group.dateKey, state.todayTs)

                    return (
                      <motion.div key={group.dateKey} variants={staggerItem} className="mb-6">
                        {/* encabezado de día — folio + acción */}
                        <div className="mb-2 flex items-center gap-3">
                          <FolioLabel className="min-w-0 flex-1">
                            {label} · {group.items.length}
                          </FolioLabel>
                          <button
                            type="button"
                            aria-label={`Agregar dosis al día ${label}`}
                            onClick={() => {
                              // #72: precargar la FECHA del día histórico (mediodía) vía draftDose.ts,
                              // sin contaminar el producto (sheetArg se usa como producto en RegistrarSheet).
                              dispatch({ t: 'setDraftDose', draft: { ts: new Date(group.dateKey + 'T12:00:00').getTime() } })
                              dispatch({ t: 'sheet', sheet: 'registrar' })
                            }}
                            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-3 font-mono text-[12px] font-medium text-blue"
                          >
                            + Dosis
                          </button>
                        </div>

                        <Glass className="p-0 overflow-hidden" role="listitem">
                          <div className="divide-y divide-hairline">
                            {group.items.map((it) => {
                              const phaseIdx = it.type === 'dose' && it.product
                                ? phaseForDate(state, new Date(it.ts), it.product)
                                : null
                              const pct = it.type === 'dose' && it.product
                                ? (presenceData.find((p) => p.product === it.product)?.pct ?? 0)
                                : 0
                              return (
                                <TimelineRow
                                  key={it.id}
                                  item={it}
                                  onDelete={handleDelete}
                                  phaseIndex={phaseIdx}
                                  presencePct={pct > 0 ? pct : undefined}
                                  dispatch={dispatch}
                                />
                              )
                            })}
                          </div>
                        </Glass>
                      </motion.div>
                    )
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── microcopy de privacidad ── */}
      <motion.div variants={staggerItem} className="flex items-center justify-center gap-1.5 py-4">
        <Shield size={12} className="text-ink-3" />
        <p className="text-center text-[12px] text-ink-3">
          Tu historial se guarda solo en tu dispositivo
        </p>
      </motion.div>
    </motion.div>
  )
}
