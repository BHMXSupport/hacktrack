import { useState, useEffect } from 'react'
import { Scale, Ruler, Percent, Activity } from 'lucide-react'
import { useApp } from '../../lib/store'
import type { Profile } from '../../lib/types'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'

// "Cambio de medidas" — captura las medidas de composición (peso, altura, % grasa, % músculo) DE UNA VEZ,
// la misma pantalla que el onboarding (Baseline) pero post-onboarding. Despacha saveMedidas, que AGREGA un
// registro nuevo al diario + muestras al historial (no sobreescribe lo anterior) y recalcula el IMC.
const RANGES: Record<'peso' | 'est' | 'grasa' | 'musculo', [number, number]> = {
  peso: [20, 300], est: [100, 250], grasa: [1, 60], musculo: [1, 60],
}

function validate(v: string, [min, max]: [number, number]): string | undefined {
  if (v.trim() === '') return undefined // todos opcionales
  const n = parseFloat(v)
  if (isNaN(n) || n < min || n > max) return `Debe estar entre ${min} y ${max}`
  return undefined
}

function NumField({ icon: Icon, label, id, placeholder, unit, value, onChange, error }: {
  icon: typeof Scale; label: string; id: string; placeholder: string; unit: string
  value: string; onChange: (v: string) => void; error?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-medium text-secondary-foreground">
        <Icon size={14} className="text-teal" aria-hidden /> {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { const v = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(v)) onChange(v) }}
          aria-invalid={!!error}
          className={`h-14 w-full rounded-lg border bg-raised px-4 pr-14 text-[22px] font-bold tabular-nums text-foreground placeholder:text-[16px] placeholder:font-normal placeholder:text-secondary-foreground/70 focus:outline-none focus:ring-2 transition-colors ${error ? 'border-alert/70 focus:ring-alert/20' : 'border-white/10 focus:border-teal/60 focus:ring-teal/20'}`}
        />
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-secondary-foreground">{unit}</span>
      </div>
      {error && <p role="alert" className="text-[12px] text-alert">{error}</p>}
    </div>
  )
}

export function CambioMedidasSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp()
  const p = state.profile
  const [peso, setPeso] = useState('')
  const [est, setEst] = useState('')
  const [grasa, setGrasa] = useState('')
  const [musculo, setMusculo] = useState('')
  const [errs, setErrs] = useState<Record<string, string | undefined>>({})
  const [savedDelta, setSavedDelta] = useState<string | null>(null) // feedback "−1.5 kg · IMC 25.3" tras guardar (#62)

  // Al abrir, pre-llena con los valores actuales (registras el cambio desde lo último).
  useEffect(() => {
    if (!open) return
    setPeso(p.peso != null ? String(p.peso) : '')
    setEst(p.est != null ? String(p.est) : '')
    setGrasa(p.grasa != null ? String(p.grasa) : '')
    setMusculo(p.musculo != null ? String(p.musculo) : '')
    setErrs({})
    setSavedDelta(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pesoN = parseFloat(peso), estN = parseFloat(est)
  const imc = pesoN >= 20 && pesoN <= 300 && estN >= 100 && estN <= 250
    ? (pesoN / ((estN / 100) ** 2)).toFixed(1) : null

  function guardar() {
    const e = {
      peso: validate(peso, RANGES.peso), est: validate(est, RANGES.est),
      grasa: validate(grasa, RANGES.grasa), musculo: validate(musculo, RANGES.musculo),
    }
    if (Object.values(e).some(Boolean)) { setErrs(e); return }
    const values: Partial<Pick<Profile, 'peso' | 'est' | 'grasa' | 'musculo'>> = {}
    if (peso.trim()) values.peso = parseFloat(peso)
    if (est.trim()) values.est = parseFloat(est)
    if (grasa.trim()) values.grasa = parseFloat(grasa)
    if (musculo.trim()) values.musculo = parseFloat(musculo)
    if (Object.keys(values).length === 0) { onClose(); return }

    // Delta vs. el registro anterior (capturar el perfil PREVIO antes de despachar). El reducer ya no cierra
    // la hoja (#62) → la cerramos aquí tras mostrar el feedback ~1.8s, igual que MedidaSheet.
    const fmt = (d: number, unit: string) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(Math.abs(d) % 1 === 0 ? 0 : 1)}${unit}`
    const fieldParts: string[] = []
    if (values.peso != null && p.peso != null && values.peso !== p.peso) fieldParts.push(fmt(values.peso - p.peso, ' kg'))
    if (values.grasa != null && p.grasa != null && values.grasa !== p.grasa) fieldParts.push(fmt(values.grasa - p.grasa, '% grasa'))
    if (values.musculo != null && p.musculo != null && values.musculo !== p.musculo) fieldParts.push(fmt(values.musculo - p.musculo, '% músc.'))
    const hadPrev = p.peso != null || p.grasa != null || p.musculo != null
    const delta = fieldParts.length ? [...fieldParts, imc ? `IMC ${imc}` : ''].filter(Boolean).join(' · ') : ''

    dispatch({ t: 'saveMedidas', values }) // agrega registro al diario + historial
    if (delta) {
      setSavedDelta(delta)
      setTimeout(() => { setSavedDelta(null); onClose() }, 1800)
    } else if (!hadPrev) {
      setSavedDelta('Primer registro · punto de partida')
      setTimeout(() => { setSavedDelta(null); onClose() }, 1800)
    } else {
      onClose()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Cambio de medidas">
      <p className="-mt-1 mb-4 text-[13px] leading-relaxed text-secondary-foreground">
        Registra tus medidas de composición de una sola vez. Se guarda como un registro nuevo en tu diario; no borra los anteriores.
      </p>
      <div className="flex flex-col gap-4">
        <NumField icon={Scale} label="Peso" id="cm-peso" placeholder="ej. 78" unit="kg" value={peso} onChange={setPeso} error={errs.peso} />
        <NumField icon={Ruler} label="Altura" id="cm-est" placeholder="ej. 175" unit="cm" value={est} onChange={setEst} error={errs.est} />
        <NumField icon={Percent} label="% grasa" id="cm-grasa" placeholder="ej. 20" unit="%" value={grasa} onChange={setGrasa} error={errs.grasa} />
        <NumField icon={Activity} label="% músculo" id="cm-musc" placeholder="ej. 40" unit="%" value={musculo} onChange={setMusculo} error={errs.musculo} />
        {imc && (
          <p className="text-[13px] text-secondary-foreground">IMC estimado: <span className="font-semibold text-foreground">{imc}</span></p>
        )}
        {savedDelta && (
          <p className="text-center text-[13px] font-semibold text-teal" role="status" aria-live="polite">{savedDelta}</p>
        )}
        <Button size="full" onClick={guardar} disabled={savedDelta != null}>Guardar registro</Button>
      </div>
    </Sheet>
  )
}
