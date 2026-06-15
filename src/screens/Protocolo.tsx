import { useState } from 'react'
import { useApp } from '../lib/store'
import { PEPTIDES, CATEGORY_COLOR, WDS } from '../lib/catalog'
import {
  rhythmLabel,
  rhythmBadge,
  weekStrip,
  diaTocaCadence,
  proximasCadence,
  fmtDate,
} from '../lib/cadence'
import { Chip, Disclaimer } from '../components/controls'
import { IcDrop } from '../components/icons'

export function Protocolo() {
  const { state, dispatch } = useApp()
  const { protocol, todayTs } = state
  const today = new Date(todayTs)

  // ── Estado local: picker de producto (estado vacío) ────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── ESTADO VACÍO ────────────────────────────────────────────────────────────
  if (!protocol) {
    return (
      <div className="scroll has-nav">
        {/* Card de estado vacío */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            padding: 32,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          <IcDrop size={40} style={{ color: 'var(--brand-500)', opacity: 0.7 }} />
          <div>
            <div className="h2" style={{ marginBottom: 8 }}>
              Aun no tienes un protocolo
            </div>
            <div className="sm">
              Importa tus productos de una tienda asociada o elige uno del catálogo para empezar.
            </div>
          </div>

          {/* Btn principal: importar de tienda asociada */}
          <button
            className="btn btn-brand"
            onClick={() => dispatch({ t: 'go', screen: 's-import' })}
          >
            Importar de tienda asociada
          </button>

          {/* Btn outline: picker del catálogo */}
          <button
            className="btn btn-outline"
            onClick={() => setPickerOpen((v) => !v)}
          >
            {pickerOpen ? 'Cerrar catálogo' : 'Elegir del catálogo'}
          </button>

          {/* Picker de chips desde PEPTIDES */}
          {pickerOpen && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'center',
                marginTop: 4,
              }}
            >
              {Object.keys(PEPTIDES).map((name) => {
                const color = CATEGORY_COLOR[PEPTIDES[name].cat]
                return (
                  <Chip
                    key={name}
                    label={name}
                    color={color}
                    onClick={() => {
                      dispatch({ t: 'setProtocol', product: name })
                      setPickerOpen(false)
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>

        <Disclaimer kind="proto" />
      </div>
    )
  }

  // ── CON PROTOCOLO ───────────────────────────────────────────────────────────
  const { product, cadence, progOn, progN, curPhase, startDate } = protocol
  const peptide = PEPTIDES[product]
  const catColor = peptide ? CATEGORY_COLOR[peptide.cat] : 'var(--brand-500)'
  const label = peptide ? rhythmLabel(peptide) : 'Por uso'
  const badge = peptide ? rhythmBadge(peptide) : 'por uso'

  // Tira de semana
  const strip = weekStrip(today)
  const startDateObj = new Date(startDate)

  // Próximas tomas
  const proximas = proximasCadence(cadence, startDateObj, today, 3)

  // Fases (titulación)
  const phaseWeeks = peptide && progN === (peptide.phases ?? 0) ? peptide.phaseWeeks : undefined

  return (
    <div className="scroll has-nav">
      {/* Nombre del producto */}
      <div className="h1" style={{ marginBottom: 6 }}>{product}</div>

      {/* Ritmo — chip de label + badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <Chip label={label} color={catColor} />
        <span className="badge badge-mint">{badge}</span>
      </div>

      {/* Tira semanal */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sm" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Esta semana
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 4,
          }}
        >
          {strip.map((d, i) => {
            const isOn = diaTocaCadence(d, cadence, startDateObj)
            const isToday =
              d.getFullYear() === today.getFullYear() &&
              d.getMonth() === today.getMonth() &&
              d.getDate() === today.getDate()
            const initial = WDS[i][0]
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div
                  className="sm"
                  style={{ fontSize: 11, textAlign: 'center', color: 'var(--ink-400)' }}
                >
                  {initial}
                </div>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isOn ? catColor : 'var(--ink-100)',
                    color: isOn ? '#fff' : 'var(--ink-300)',
                    border: isToday ? `2px solid var(--ink-900)` : '2px solid transparent',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {isOn ? <IcDrop size={14} /> : '·'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Próximas tomas */}
      {proximas.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sm" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Próximas tomas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proximas.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: i < proximas.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <IcDrop size={16} style={{ color: catColor, flexShrink: 0 }} />
                <span className="body" style={{ fontWeight: 600 }}>
                  {fmtDate(d, today)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fases de titulación (si progOn está activo) */}
      {progOn && progN > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sm" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Fases de titulación
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: progN }, (_, i) => {
              const isActive = i === curPhase
              const faseLabel =
                phaseWeeks
                  ? `Fase ${i + 1} · sem ${i * phaseWeeks + 1}-${(i + 1) * phaseWeeks}`
                  : `Fase ${i + 1}`
              return (
                <Chip
                  key={i}
                  label={faseLabel}
                  active={isActive}
                  color={isActive ? undefined : catColor}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <Disclaimer kind="proto" />
    </div>
  )
}
