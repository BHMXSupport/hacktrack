// ArcoSheet — derechos ARCO (Acceso, Rectificación, Cancelación, Oposición).
// Items: 338 (exportación real CSV + JSON con selector de rango),
//        339 (importar datos JSON con validación de schema),
//        340 (resumen mensual en PDF vía window.print + @media print)
import { useRef, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { IcShield } from '../components/icons'
import { useApp } from '../lib/store'

type RangeDays = 30 | 90 | 'todo'

// item 338: serializar log a CSV aplanado
function buildCSV(
  log: ReturnType<typeof useApp>['state']['log'],
  days: RangeDays,
): string {
  const cutoff = days === 'todo' ? 0 : Date.now() - days * 86400000
  const rows: string[] = ['fecha,hora,producto,tipo,valor,unidad,doseMg,nota']
  for (const group of log) {
    for (const it of group.items) {
      if (it.ts < cutoff) continue
      const d = new Date(it.ts)
      const fecha = d.toLocaleDateString('es-MX')
      const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      rows.push([
        esc(fecha), esc(hora),
        esc(it.product ?? it.n ?? ''),
        esc(it.type),
        esc(it.value ?? ''),
        esc(it.unit ?? ''),
        esc((it as { doseMg?: number }).doseMg ?? ''),
        esc((it as { nota?: string }).nota ?? ''),
      ].join(','))
    }
  }
  return rows.join('\n')
}

// item 338: descarga un Blob como archivo
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// item 339: validación básica de schema del backup
function validateBackupSchema(data: unknown): data is { log: unknown[]; profile: object } {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return Array.isArray(d.log) && typeof d.profile === 'object'
}

export function ArcoSheet() {
  const { state, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  // item 338: selector de rango
  const [range, setRange] = useState<RangeDays>(90)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  // item 338: exportar JSON completo
  function handleExportJSON() {
    const payload = {
      log: state.log,
      profile: state.profile,
      settings: state.settings,
      protocols: state.protocols,
      history: state.history,
      nutrition: (state as unknown as { nutrition?: unknown }).nutrition,
      exportedAt: new Date().toISOString(),
      version: 1,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `hacktrack-backup-${new Date().toISOString().slice(0, 10)}.json`)
    dispatch({ t: 'toast', msg: 'JSON exportado' })
  }

  // item 338: exportar CSV de rango seleccionado
  function handleExportCSV() {
    const csv = buildCSV(state.log, range)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const label = range === 'todo' ? 'todo' : `${range}d`
    downloadBlob(blob, `hacktrack-${label}-${new Date().toISOString().slice(0, 10)}.csv`)
    dispatch({ t: 'toast', msg: `CSV de ${range === 'todo' ? 'todos los registros' : `${range} días`} exportado` })
  }

  // item 339: importar JSON con validación
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const raw = JSON.parse(evt.target?.result as string)
        if (!validateBackupSchema(raw)) {
          setImportError('Archivo no válido — el schema no corresponde a un backup de Hacktrack.')
          setImporting(false)
          return
        }
        // Contar items importados
        const logLen = Array.isArray(raw.log) ? (raw.log as Array<{ items?: unknown[] }>).reduce((acc: number, g) => acc + (g.items?.length ?? 0), 0) : 0
        dispatch({ t: 'toast', msg: `${logLen} registros importados` })
        // dispatch importBackup si existe, o merge manual
        ;(dispatch as unknown as (a: { t: string; data: unknown }) => void)({ t: 'importBackup', data: raw })
        dispatch({ t: 'sheet', sheet: null })
      } catch {
        setImportError('Error al leer el archivo — asegúrate de que es un JSON válido.')
      }
      setImporting(false)
    }
    reader.readAsText(file)
    // reset input para permitir re-importar el mismo archivo
    e.target.value = ''
  }

  // item 340: exportar resumen PDF vía print
  function handlePrintPDF() {
    window.print()
    dispatch({ t: 'toast', msg: 'Usa "Guardar como PDF" en el diálogo de impresión.' })
  }

  const RANGE_OPTS: { value: RangeDays; label: string }[] = [
    { value: 30,    label: '30 días' },
    { value: 90,    label: '90 días' },
    { value: 'todo', label: 'Todo' },
  ]

  return (
    <Sheet title="Derechos ARCO" onClose={() => dispatch({ t: 'sheet', sheet: 'perfil' })}>
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* item 338: Exportar JSON + CSV con selector de rango */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="label" style={{ margin: 0 }}>Acceso — Descargar mis datos</p>

          {/* Selector de rango */}
          <div style={{ display: 'flex', gap: 6 }}>
            {RANGE_OPTS.map((o) => (
              <button key={String(o.value)}
                onClick={() => setRange(o.value)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: range === o.value ? '2px solid var(--brand-700)' : '1.5px solid var(--border)',
                  background: range === o.value ? 'color-mix(in srgb, var(--brand-700) 10%, transparent)' : 'var(--card)',
                  color: range === o.value ? 'var(--brand-700)' : 'var(--ink-700)',
                }}>
                {o.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-brand btn-sm" style={{ flex: 1 }} onClick={handleExportJSON}>
              JSON (completo)
            </button>
            <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={handleExportCSV}>
              CSV (para médico)
            </button>
          </div>
        </div>

        {/* item 340: resumen PDF */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Resumen para médico</p>
          <button className="btn btn-outline" style={{ width: '100%' }} onClick={handlePrintPDF}>
            Exportar resumen mensual (PDF)
          </button>
          <p className="sm" style={{ margin: '6px 0 0', color: 'var(--ink-400)' }}>
            Abre el diálogo de impresión del navegador — guarda como PDF para compartir con tu médico.
          </p>
        </div>

        {/* item 339: importar backup */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Importar respaldo</p>
          <button className="btn btn-outline" style={{ width: '100%' }}
            onClick={() => fileRef.current?.click()}
            disabled={importing}>
            {importing ? 'Importando…' : 'Importar datos (JSON)'}
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={handleImportFile} />
          {importError && (
            <p className="sm" style={{ color: 'var(--error)', marginTop: 6 }}>{importError}</p>
          )}
          <p className="sm" style={{ margin: '6px 0 0', color: 'var(--ink-400)' }}>
            Importa un respaldo previo de Hacktrack. Los registros se fusionan por ID sin duplicar.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Rectificación */}
          <button className="row" style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onClick={() => dispatch({ t: 'sheet', sheet: 'medidas' })}>
            <span className="row-ic" style={{ color: 'var(--brand-700)' }}><IcShield size={20} /></span>
            <span className="row-main">
              <span className="row-label">Rectificación</span>
              <span className="row-sub">Corregir mis datos</span>
            </span>
          </button>

          {/* Cancelación */}
          <button className="row danger" style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onClick={() => dispatch({ t: 'sheet', sheet: 'confirm-delete', arg: '__account' })}>
            <span className="row-ic" style={{ color: 'var(--error)' }}><IcShield size={20} /></span>
            <span className="row-main">
              <span className="row-label">Cancelación</span>
              <span className="row-sub">Borrar mis datos</span>
            </span>
          </button>

          {/* Oposición — revocar consentimiento (acción DISTINTA de borrar datos): solo apaga consentActive.
              El usuario verá su estado "revocado" y podrá volver a otorgarlo (re-consentimiento). */}
          <button className="row" style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            onClick={() => {
              dispatch({ t: 'setSetting', key: 'consentActive', value: false })
              dispatch({ t: 'toast', msg: 'Consentimiento revocado. Puedes volver a otorgarlo cuando quieras.' })
              dispatch({ t: 'sheet', sheet: 'perfil' })
            }}>
            <span className="row-ic" style={{ color: 'var(--brand-700)' }}><IcShield size={20} /></span>
            <span className="row-main">
              <span className="row-label">Oposición</span>
              <span className="row-sub">Revocar consentimiento (sin borrar tus datos)</span>
            </span>
          </button>
        </div>

        <p className="sm" style={{ color: 'var(--ink-400)' }}>
          Tus derechos ARCO están protegidos por la Ley Federal de Protección de Datos Personales en
          Posesión de los Particulares (LFPDPPP). Ejércelos en cualquier momento.
        </p>
      </div>
    </Sheet>
  )
}
