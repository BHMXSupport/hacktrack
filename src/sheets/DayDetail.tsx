// DayDetail — bottom-sheet de detalle del día. Sin props, usa useApp().
// Items: 302 (editar registro completo con lápiz), 303 (editar solo hora con TimeWheel inline),
//        304 (borrado de log → undo 5s vía toast), 325 (agrupar registros por producto),
//        326 (resumen adherencia de semana en header)
// Compliance: sin jeringas (Glyph 'dose'/IcDrop), sin promesas de resultado, <Disclaimer kind="dose"/> presente.
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { tapHaptic } from '../lib/haptics'
import { Glyph, GlyphCircle } from '../components/glyphs'
import { IcCheck } from '../components/icons'
import { TimeWheel } from '../components/TimeWheel'
import { useApp, isoKey } from '../lib/store'
import { dayProducts, doseTakenOnProduct, loggedItemsForDay, phaseForDate, weekAdherencePct } from '../lib/calendar'
import { fmtDate, fmtTime, weekStrip } from '../lib/cadence'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'

// ── helpers ───────────────────────────────────────────────────────────────────

function doseTsForDay(state: ReturnType<typeof useApp>['state'], d: Date, product?: string): number {
  const rt = (product && state.protocols[product]?.reminderTime) || state.protocol?.reminderTime || '08:00'
  const [hh, mm] = rt.split(':').map(Number)
  const at = new Date(d)
  at.setHours(hh ?? 0, mm ?? 0, 0, 0)
  return at.getTime()
}

function glyphForItem(ic: string): string {
  if (ic === 'dose') return 'hidratacion'
  return ic
}

// item 325: agrupar items por producto
function groupByProduct(items: ReturnType<typeof loggedItemsForDay>): Map<string, typeof items> {
  const map = new Map<string, typeof items>()
  for (const it of items) {
    const key = it.n  // product name or measure name
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  return map
}

// Parsea etiqueta de TimeWheel a ts del día d
function parseWheelToTs(label: string, d: Date): number | null {
  if (label === 'Ahora') return null
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10) % 12
  if (/pm/i.test(m[3])) h += 12
  const at = new Date(d)
  at.setHours(h, parseInt(m[2], 10), 0, 0)
  return at.getTime()
}

// item 302: tipo de modal de edición en pantalla
type EditMode = null | { id: string; mode: 'time' | 'full' }

// ── componente ────────────────────────────────────────────────────────────────

export function DayDetail() {
  const { state, dispatch } = useApp()

  const key = state.sheetArg
  if (!key) return null

  const d = new Date(key + 'T00:00:00')
  const now = new Date()
  const today = isoKey(state.todayTs)
  const isPastOrToday = key <= today

  const prods = dayProducts(state, d)
  const items = loggedItemsForDay(state, d)
  const phases = prods
    .map((p) => {
      const phase = phaseForDate(state, d, p)
      return phase == null ? null : { product: p, phase, dose: state.protocols[p]?.phaseDoses?.[phase] }
    })
    .filter((x): x is { product: string; phase: number; dose: number | null | undefined } => x != null)

  const isPastDue = (product: string) => now.getTime() > doseTsForDay(state, d, product)
  const isEmpty = prods.length === 0 && items.length === 0

  // item 326: adherencia de la semana
  const weekDays = weekStrip(now)
  const weekAdh = weekAdherencePct(state, weekDays, now)
  const takenCount = weekDays.reduce((acc, wd) => {
    return acc + dayProducts(state, wd).filter((p) => doseTakenOnProduct(state, wd, p)).length
  }, 0)
  const totalCount = weekDays.reduce((acc, wd) => acc + dayProducts(state, wd).length, 0)

  // item 303: estado de edición de hora inline
  const [editMode, setEditMode] = useState<EditMode>(null)
  const [editWheelHora, setEditWheelHora] = useState<string | null>(null)
  // item 302: estado de edición completa
  const [editFull, setEditFull] = useState<{ id: string; value: string; unit: string; note: string } | null>(null)

  function handleClose() { dispatch({ t: 'sheet', sheet: null }) }

  // item 304: borrar → undo 5s via toast (ya manejado por store: deletedLogBuffer + toastUndoId)
  function handleDelete(id: string) {
    dispatch({ t: 'deleteLog', id })
    // toast ya se muestra por el store con toastUndoId
  }

  function handleQuickLog(product: string) {
    const ts = doseTsForDay(state, d, product)
    tapHaptic()
    dispatch({ t: 'logDose', product, value: null, unit: 'mg', ts })
  }

  function handleDetailLog(product: string) {
    dispatch({ t: 'sheet', sheet: 'registrar', arg: product })
  }

  // item 303: confirmar edición de hora
  function confirmTimeEdit() {
    if (!editMode || editMode.mode !== 'time' || !editWheelHora) return
    const ts = parseWheelToTs(editWheelHora, d)
    if (ts) {
      dispatch({ t: 'editLogTime', id: editMode.id, ts })
      dispatch({ t: 'toast', msg: 'Hora actualizada' })
    }
    setEditMode(null)
  }

  // item 302: confirmar edición completa
  function confirmFullEdit() {
    if (!editFull) return
    const val = parseFloat(editFull.value)
    dispatch({ t: 'editLog', id: editFull.id, patch: {
      value: isNaN(val) ? null : val,
      unit: editFull.unit || null,
      note: editFull.note.trim() || null,
    } })
    dispatch({ t: 'toast', msg: 'Registro actualizado' })
    setEditFull(null)
    setEditMode(null)
  }

  // item 325: grupos de registros
  const grouped = groupByProduct(items)

  return (
    <Sheet title={fmtDate(d, now)} onClose={handleClose}>
      <div style={{ padding: '0 2px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── item 326: resumen de adherencia de la semana ── */}
        {totalCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', borderRadius: 'var(--r-sm)',
            background: 'color-mix(in srgb, var(--brand-700) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--brand-700) 20%, transparent)',
          }}>
            <span className="sm" style={{ color: 'var(--ink-700)' }}>
              Esta semana: <strong>{takenCount} de {totalCount}</strong> dosis tomadas
            </span>
            {weekAdh != null && (
              <span className="sm mono" style={{ fontWeight: 700, color: weekAdh >= 80 ? 'var(--success)' : weekAdh >= 50 ? 'var(--warning)' : 'var(--error)' }}>
                {weekAdh}%
              </span>
            )}
          </div>
        )}

        {/* ── ESTADO VACÍO ── */}
        {isEmpty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0 8px' }}>
            <Glyph name="cat-explorar" size={36} color="var(--ink-200)" />
            <p className="sm" style={{ textAlign: 'center', margin: 0, color: 'var(--ink-300)' }}>
              Nada programado este día
            </p>
          </div>
        )}

        {/* ── § 1 PROGRAMADO ── */}
        {prods.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Programado</p>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--e2)' }}>
              {prods.map((product, idx) => {
                const taken = doseTakenOnProduct(state, d, product)
                const catColor = CATEGORY_COLOR[PEPTIDES[product]?.cat ?? 'Explorar'] ?? 'var(--ink-300)'
                const missed = !taken && isPastDue(product)
                const showActions = !taken && isPastOrToday

                return (
                  <div key={product} style={{ padding: '14px 16px', borderBottom: idx < prods.length - 1 ? '1px solid var(--border)' : undefined, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: taken ? 'var(--success)' : missed ? 'var(--warning)' : catColor }} />
                      <span className="body" style={{ flex: 1, fontWeight: 600, color: 'var(--ink-900)' }}>{product}</span>
                      {taken ? (
                        <span className="sm" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600 }}>
                          <IcCheck size={15} style={{ stroke: 'var(--success)' }} />
                          Registrada
                        </span>
                      ) : (
                        <span className="sm" style={{ color: missed ? 'var(--warning)' : 'var(--ink-300)' }}>
                          {missed ? 'Pendiente' : 'Programada'}
                        </span>
                      )}
                    </div>
                    {showActions && (
                      <div style={{ display: 'flex', gap: 8, paddingLeft: 20 }}>
                        <button className="btn btn-brand btn-sm" style={{ flex: 1, height: 40, fontSize: 14, borderRadius: 'var(--r-sm)' }} onClick={() => handleQuickLog(product)}>
                          Registrar
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ flex: 1, height: 40, fontSize: 14, borderRadius: 'var(--r-sm)' }} onClick={() => handleDetailLog(product)}>
                          Con detalle
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── § 2 FASE DE TITULACIÓN ── */}
        {phases.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Fase de titulación</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {phases.map(({ product, phase, dose }) => (
                <div key={product} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: 'var(--e2)' }}>
                  <GlyphCircle name="cat-metabolismo" color="var(--brand-500)" size={18} box={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="body" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{product}</span>
                    <span className="sm" style={{ marginLeft: 8, color: 'var(--ink-400)' }}>
                      Fase {phase + 1}{dose != null ? ` · ${dose} mg` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── § 3 REGISTROS DEL DÍA (item 325: agrupados por producto) ── */}
        {items.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Registros del día</p>

            {/* item 325: si hay múltiples productos, agrupar */}
            {grouped.size > 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...grouped.entries()].map(([productKey, groupItems]) => (
                  <div key={productKey}>
                    <p className="sm" style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--ink-700)' }}>
                      {productKey}
                    </p>
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--e2)' }}>
                      {groupItems.map((item, idx) => (
                        <ItemRow
                          key={item.id} item={item} idx={idx} total={groupItems.length}
                          editMode={editMode} editFull={editFull}
                          editWheelHora={editWheelHora}
                          d={d}
                          onDelete={handleDelete}
                          onEditTime={(id) => { setEditMode({ id, mode: 'time' }); setEditWheelHora(null) }}
                          onEditFull={(id, v, u, n) => { setEditMode({ id, mode: 'full' }); setEditFull({ id, value: v, unit: u, note: n }) }}
                          onConfirmTime={confirmTimeEdit}
                          onConfirmFull={confirmFullEdit}
                          onCancelEdit={() => { setEditMode(null); setEditFull(null) }}
                          onWheelChange={(l) => setEditWheelHora(l)}
                          onEditFullChange={(f) => setEditFull(f)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Un solo producto o mezcla: lista plana
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: 'var(--e2)' }}>
                {items.map((item, idx) => (
                  <ItemRow
                    key={item.id} item={item} idx={idx} total={items.length}
                    editMode={editMode} editFull={editFull}
                    editWheelHora={editWheelHora}
                    d={d}
                    onDelete={handleDelete}
                    onEditTime={(id) => { setEditMode({ id, mode: 'time' }); setEditWheelHora(null) }}
                    onEditFull={(id, v, u, n) => { setEditMode({ id, mode: 'full' }); setEditFull({ id, value: v, unit: u, note: n }) }}
                    onConfirmTime={confirmTimeEdit}
                    onConfirmFull={confirmFullEdit}
                    onCancelEdit={() => { setEditMode(null); setEditFull(null) }}
                    onWheelChange={(l) => setEditWheelHora(l)}
                    onEditFullChange={(f) => setEditFull(f)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <Disclaimer kind="dose" />
      </div>
    </Sheet>
  )
}

// ── Sub-componente de fila de registro ───────────────────────────────────────

// Use the same shape as lib/types.ts LogItem (note?: string, not nota)
interface LogItem {
  id: string; ic: string; cat: string; n: string; u?: string; t: string; type?: string; value?: number | null; unit?: string | null; note?: string; product?: string
}

interface ItemRowProps {
  item: LogItem
  idx: number
  total: number
  editMode: EditMode
  editFull: { id: string; value: string; unit: string; note: string } | null
  editWheelHora: string | null
  d: Date
  onDelete: (id: string) => void
  onEditTime: (id: string) => void
  onEditFull: (id: string, value: string, unit: string, note: string) => void
  onConfirmTime: () => void
  onConfirmFull: () => void
  onCancelEdit: () => void
  onWheelChange: (label: string) => void
  onEditFullChange: (f: { id: string; value: string; unit: string; note: string }) => void
}

function ItemRow({
  item, idx, total, editMode, editFull, editWheelHora, d,
  onDelete, onEditTime, onEditFull,
  onConfirmTime, onConfirmFull, onCancelEdit,
  onWheelChange, onEditFullChange,
}: ItemRowProps) {
  const isEditingTime = editMode?.id === item.id && editMode.mode === 'time'
  const isEditingFull = editMode?.id === item.id && editMode.mode === 'full'

  // item 302: solo últimos 7 días (integridad)
  const daysAgo = (Date.now() - d.getTime()) / 86400000
  const canEdit = daysAgo <= 7

  return (
    <div style={{ borderBottom: idx < total - 1 ? '1px solid var(--border)' : undefined }}>
      {/* Fila principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <GlyphCircle name={glyphForItem(item.ic)} color={item.cat} size={16} box={34} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.3 }}>{item.n}</div>
          {item.u && <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 1 }}>{item.u}</div>}
          {/* item 302: mostrar nota si existe */}
          {item.note && (
            <div className="sm" style={{ color: 'var(--ink-300)', marginTop: 2, fontStyle: 'italic' }}>
              {item.note}
            </div>
          )}
        </div>

        <span className="mono sm" style={{ color: 'var(--ink-300)', flexShrink: 0, fontSize: 12 }}>{item.t}</span>

        {/* item 302: botón editar completo */}
        {canEdit && (
          <button className="iconbtn" style={{ flexShrink: 0, width: 30, height: 30, color: 'var(--ink-400)' }}
            aria-label={`Editar ${item.n}`}
            onClick={() => onEditFull(item.id, String(item.value ?? ''), item.unit ?? '', item.note ?? '')}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}

        {/* Botón borrar */}
        <button className="iconbtn" style={{ flexShrink: 0, width: 30, height: 30 }}
          aria-label={`Borrar ${item.n}`}
          onClick={() => onDelete(item.id)}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* item 303: TimeWheel inline para editar hora */}
      <AnimatePresence>
        {isEditingTime && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', padding: '0 16px 12px' }}
          >
            <p className="sm" style={{ margin: '0 0 8px', color: 'var(--ink-400)' }}>Elige la hora correcta</p>
            <TimeWheel onChange={onWheelChange} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-brand btn-sm" style={{ flex: 1 }}
                disabled={!editWheelHora}
                onClick={onConfirmTime}>
                Actualizar hora
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onCancelEdit}>Cancelar</button>
            </div>
          </motion.div>
        )}

        {/* item 302: editor completo inline */}
        {isEditingFull && editFull && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <p className="sm" style={{ margin: 0, color: 'var(--ink-400)' }}>Editar registro</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field mono" type="number" inputMode="decimal"
                placeholder="Valor"
                value={editFull.value}
                onChange={(e) => onEditFullChange({ ...editFull, value: e.target.value })}
                style={{ flex: 1, fontSize: 16, fontWeight: 600 }} />
              <input className="field" type="text"
                placeholder="Unidad"
                value={editFull.unit}
                onChange={(e) => onEditFullChange({ ...editFull, unit: e.target.value })}
                style={{ width: 60 }} />
            </div>
            <input className="field" type="text"
              placeholder="Nota (opcional)"
              maxLength={200}
              value={editFull.note}
              onChange={(e) => onEditFullChange({ ...editFull, note: e.target.value })}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-brand btn-sm" style={{ flex: 1 }} onClick={onConfirmFull}>
                Guardar cambios
              </button>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { onCancelEdit(); onEditTime(item.id) }}
                title="Solo editar hora">
                Solo hora
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onCancelEdit}>✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
