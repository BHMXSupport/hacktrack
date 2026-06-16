// Popup al marcar una dosis programada con desfase ≥1h respecto a la hora actual:
// pregunta si se aplicó a la hora programada o justo ahora, y registra en el diario la hora elegida.
import { Sheet } from '../components/Sheet'
import { useApp } from '../lib/store'
import { fmtTime } from '../lib/cadence'
import { tapHaptic } from '../lib/haptics'

interface Payload { product: string; value: number | null; unit: string; doseMg?: number; scheduledTs: number; nowTs: number }

export function DoseConfirm() {
  const { state, dispatch } = useApp()
  const close = () => dispatch({ t: 'sheet', sheet: null })
  let p: Payload | null = null
  try { p = state.sheetArg ? (JSON.parse(state.sheetArg) as Payload) : null } catch { p = null }
  if (!p) return <Sheet title="Registrar dosis" onClose={close}><div style={{ padding: '0 20px 32px' }} /></Sheet>
  const { product, value, unit, doseMg, scheduledTs, nowTs } = p

  function log(ts: number) {
    tapHaptic()
    // logDose ya cierra el sheet (sheet:null) y emite el toast con "Deshacer"
    dispatch({ t: 'logDose', product, value, unit, ts, doseMg })
  }

  const btn = { height: 60, borderRadius: 16, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 2 }

  return (
    <Sheet title="¿A qué hora te la aplicaste?" onClose={close}>
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
          <strong>{product}</strong>{value != null ? ` · ${value} ${unit}` : ''}. Tu hora programada no coincide con la hora actual — elige cuándo te la pusiste.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-brand" style={btn} onClick={() => log(scheduledTs)}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>A mi hora programada</span>
            <span className="sm mono" style={{ opacity: 0.85 }}>{fmtTime(new Date(scheduledTs))}</span>
          </button>
          <button className="btn btn-outline" style={btn} onClick={() => log(nowTs)}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Ahora mismo</span>
            <span className="sm mono" style={{ color: 'var(--ink-400)' }}>{fmtTime(new Date(nowTs))}</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}
