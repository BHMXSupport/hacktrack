// Hacktrack — calendario mensual de dosis (componente sin props, usa useApp)
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, trackedProtocols, productsOnDay } from '../lib/store'
import { monthMatrix } from '../lib/cadence'
import { PEPTIDES, CATEGORY_COLOR, WDS } from '../lib/catalog'
import { rhythmLabel } from '../lib/cadence'
import { IcBack, IcChevron } from '../components/icons'

const stagger = { animate: { transition: { staggerChildren: 0.04 } } }
const item = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } }

function monthName(month: number): string {
  const names = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return names[month] ?? ''
}

export function DoseCalendar() {
  const { state } = useApp()
  const today = new Date(state.todayTs)

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const tracked = trackedProtocols(state)
  const matrix = monthMatrix(year, month)

  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return (
    <div style={{ padding: '0 0 16px' }}>
      {/* Cabecera: mes/año + navegación */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 8px',
        }}
      >
        <button
          className="iconbtn"
          onClick={prevMonth}
          aria-label="Mes anterior"
          style={{ color: 'var(--ink-700)' }}
        >
          <IcBack size={20} />
        </button>
        <span className="h2" style={{ color: 'var(--ink-900)', fontWeight: 600 }}>
          {monthName(month)} {year}
        </span>
        <button
          className="iconbtn"
          onClick={nextMonth}
          aria-label="Mes siguiente"
          style={{ color: 'var(--ink-700)' }}
        >
          <IcChevron size={20} />
        </button>
      </div>

      {/* Fila de iniciales de día */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 12px',
          marginBottom: 4,
        }}
      >
        {WDS.map(([label]) => (
          <div
            key={label}
            className="sm"
            style={{
              textAlign: 'center',
              color: 'var(--ink-400)',
              fontWeight: 600,
              padding: '4px 0',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grilla del mes */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${year}-${month}`}
          variants={stagger}
          initial="initial"
          animate="animate"
          style={{ padding: '0 12px' }}
        >
          {matrix.map((week, wi) => (
            <div
              key={wi}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}
            >
              {week.map((d, di) => {
                if (!d) {
                  return (
                    <motion.div
                      key={`empty-${wi}-${di}`}
                      variants={item}
                      style={{ minHeight: 52 }}
                    />
                  )
                }
                const dNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
                const isToday = dNorm === todayNorm
                const prods = productsOnDay(d, tracked)
                const visible = prods.slice(0, 3)
                const extra = prods.length - visible.length

                return (
                  <motion.div
                    key={d.getTime()}
                    variants={item}
                    style={{
                      minHeight: 52,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: 6,
                      paddingBottom: 4,
                      borderRadius: 8,
                      border: isToday
                        ? '2px solid var(--brand-700)'
                        : '2px solid transparent',
                      background: isToday ? 'rgba(14,90,82,0.07)' : 'transparent',
                    }}
                  >
                    <span
                      className="sm mono"
                      style={{
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? 'var(--brand-700)' : 'var(--ink-700)',
                        lineHeight: 1,
                        marginBottom: 4,
                      }}
                    >
                      {d.getDate()}
                    </span>

                    {/* Puntos de productos */}
                    {prods.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'center',
                          gap: 2,
                          maxWidth: 36,
                        }}
                      >
                        {visible.map(p => (
                          <span
                            key={p}
                            title={p}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: CATEGORY_COLOR[PEPTIDES[p]?.cat ?? 'Explorar'],
                              flexShrink: 0,
                            }}
                          />
                        ))}
                        {extra > 0 && (
                          <span
                            className="sm"
                            style={{
                              fontSize: 8,
                              lineHeight: '10px',
                              color: 'var(--ink-400)',
                            }}
                          >
                            +{extra}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Leyenda o estado vacío */}
      {tracked.length === 0 ? (
        <div
          className="card"
          style={{
            margin: '16px 16px 0',
            padding: '20px 16px',
            textAlign: 'center',
          }}
        >
          <p className="body" style={{ color: 'var(--ink-400)', margin: 0 }}>
            Agrega un producto en Progreso para ver tu calendario.
          </p>
        </div>
      ) : (
        <div style={{ margin: '16px 16px 0' }}>
          <p className="sm" style={{ color: 'var(--ink-400)', marginBottom: 8 }}>
            Leyenda
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tracked.map(t => {
              const entry = PEPTIDES[t.product]
              const color = entry ? CATEGORY_COLOR[entry.cat] : 'var(--ink-300)'
              const rhythm = entry ? rhythmLabel(entry) : '—'
              return (
                <div key={t.product} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span className="body" style={{ color: 'var(--ink-900)', flex: 1 }}>
                    {t.product}
                  </span>
                  <span className="sm" style={{ color: 'var(--ink-400)' }}>
                    {rhythm}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
