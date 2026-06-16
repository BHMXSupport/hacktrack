// DayDetail — bottom-sheet de detalle del día. Sin props, usa useApp().
// Compliance: sin jeringas (Glyph 'dose'/IcDrop), el usuario teclea su dosis,
// sin promesas de resultado, <Disclaimer kind="dose"/> presente.
import { Sheet } from '../components/Sheet'
import { Disclaimer } from '../components/controls'
import { Glyph, GlyphCircle } from '../components/glyphs'
import { IcCheck } from '../components/icons'
import { useApp, isoKey } from '../lib/store'
import { dayProducts, doseTakenOnProduct, loggedItemsForDay, phaseForDate } from '../lib/calendar'
import { fmtDate, fmtTime } from '../lib/cadence'
import { PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'

// ── helpers ────────────────────────────────────────────────────────────────────

// Construye el ts de registro para una toma del día 'd' a la hora reminderTime DEL producto
function doseTsForDay(state: ReturnType<typeof useApp>['state'], d: Date, product?: string): number {
  const rt = (product && state.protocols[product]?.reminderTime) || state.protocol?.reminderTime || '08:00'
  const [hh, mm] = rt.split(':').map(Number)
  const at = new Date(d)
  at.setHours(hh ?? 0, mm ?? 0, 0, 0)
  return at.getTime()
}

// Glyph correcto por tipo de item del diario (sin jeringa)
function glyphForItem(ic: string): string {
  if (ic === 'dose') return 'hidratacion'  // agua = suministro líquido, sin jeringa
  return ic
}

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
  // fase de titulación POR producto ese día (cada producto puede estar en una fase distinta)
  const phases = prods
    .map((p) => {
      const phase = phaseForDate(state, d, p)
      return phase == null ? null : { product: p, phase, dose: state.protocols[p]?.phaseDoses?.[phase] }
    })
    .filter((x): x is { product: string; phase: number; dose: number | null | undefined } => x != null)

  // ¿ya pasó la hora de toma de este día para UN producto? (cada producto tiene su hora)
  const isPastDue = (product: string) => now.getTime() > doseTsForDay(state, d, product)

  const isEmpty = prods.length === 0 && items.length === 0

  function handleClose() {
    dispatch({ t: 'sheet', sheet: null })
  }

  // 1-tap: registra dosis a la hora reminderTime del día
  function handleQuickLog(product: string) {
    const ts = doseTsForDay(state, d, product)
    dispatch({ t: 'logDose', product, value: null, unit: 'mg', ts })
  }

  // Registrar con detalle — abre el sheet de registro EN ese producto
  function handleDetailLog(product: string) {
    dispatch({ t: 'sheet', sheet: 'registrar', arg: product })
  }

  // Borrar registro — delega a confirm-delete
  function handleDelete(id: string) {
    dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: id })
  }

  return (
    <Sheet title={fmtDate(d, now)} onClose={handleClose}>
      <div style={{ padding: '0 2px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── ESTADO VACÍO ──────────────────────────────────────────────── */}
        {isEmpty && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '32px 0 8px',
          }}>
            <Glyph name="cat-explorar" size={36} color="var(--ink-200)" />
            <p className="sm" style={{ textAlign: 'center', margin: 0, color: 'var(--ink-300)' }}>
              Nada programado este día
            </p>
          </div>
        )}

        {/* ── § 1 PROGRAMADO ────────────────────────────────────────────── */}
        {prods.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Programado</p>
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--e2)',
            }}>
              {prods.map((product, idx) => {
                const taken = doseTakenOnProduct(state, d, product)
                const catColor = CATEGORY_COLOR[PEPTIDES[product]?.cat ?? 'Explorar'] ?? 'var(--ink-300)'
                const missed = !taken && isPastDue(product)
                const showActions = !taken && isPastOrToday

                return (
                  <div
                    key={product}
                    style={{
                      padding: '14px 16px',
                      borderBottom: idx < prods.length - 1 ? '1px solid var(--border)' : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {/* Fila: punto · nombre · estado */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* punto de color del producto */}
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: taken ? 'var(--success)' : missed ? 'var(--warning)' : catColor,
                      }} />
                      <span
                        className="body"
                        style={{ flex: 1, fontWeight: 600, color: 'var(--ink-900)' }}
                      >
                        {product}
                      </span>

                      {/* Estado: tomada o no */}
                      {taken ? (
                        <span
                          className="sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontWeight: 600 }}
                        >
                          <IcCheck size={15} style={{ stroke: 'var(--success)' }} />
                          Registrada
                        </span>
                      ) : (
                        <span className="sm" style={{ color: missed ? 'var(--warning)' : 'var(--ink-300)' }}>
                          {missed ? 'Pendiente' : 'Programada'}
                        </span>
                      )}
                    </div>

                    {/* Acciones — solo si no está tomada y el día ya llegó */}
                    {showActions && (
                      <div style={{ display: 'flex', gap: 8, paddingLeft: 20 }}>
                        {/* 1-tap */}
                        <button
                          className="btn btn-brand btn-sm"
                          style={{ flex: 1, height: 40, fontSize: 14, borderRadius: 'var(--r-sm)' }}
                          onClick={() => handleQuickLog(product)}
                        >
                          Registrar
                        </button>
                        {/* con detalle */}
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ flex: 1, height: 40, fontSize: 14, borderRadius: 'var(--r-sm)' }}
                          onClick={() => handleDetailLog(product)}
                        >
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

        {/* ── § 2 FASE DE TITULACIÓN (por producto) ─────────────────────── */}
        {phases.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Fase de titulación</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {phases.map(({ product, phase, dose }) => (
                <div key={product} style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: 'var(--e2)',
                }}>
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

        {/* ── § 3 REGISTROS DEL DÍA ─────────────────────────────────────── */}
        {items.length > 0 && (
          <section>
            <p className="label" style={{ marginBottom: 8 }}>Registros del día</p>
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--e2)',
            }}>
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  {/* Icono del registro (sin jeringa) */}
                  <GlyphCircle
                    name={glyphForItem(item.ic)}
                    color={item.cat}
                    size={16}
                    box={34}
                  />

                  {/* Nombre + detalle */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="body" style={{ fontWeight: 600, color: 'var(--ink-900)', lineHeight: 1.3 }}>
                      {item.n}
                    </div>
                    {item.u && (
                      <div className="sm" style={{ color: 'var(--ink-400)', marginTop: 1 }}>
                        {item.u}
                      </div>
                    )}
                  </div>

                  {/* Hora */}
                  <span
                    className="mono sm"
                    style={{ color: 'var(--ink-300)', flexShrink: 0, fontSize: 12 }}
                  >
                    {item.t}
                  </span>

                  {/* Borrar */}
                  <button
                    className="iconbtn"
                    style={{ flexShrink: 0, width: 30, height: 30 }}
                    aria-label={`Borrar ${item.n}`}
                    onClick={() => handleDelete(item.id)}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── DISCLAIMER ────────────────────────────────────────────────── */}
        <Disclaimer kind="dose" />

      </div>
    </Sheet>
  )
}
