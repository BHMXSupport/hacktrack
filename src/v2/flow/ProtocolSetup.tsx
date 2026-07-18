/**
 * ProtocolSetup.tsx — v2 flow · ScreenId 's-protocol'
 *
 * Paso de onboarding que arma el protocolo del usuario para que termine YA configurado
 * (producto + cadencia + días + recordatorio). Va entre s-measures y s-account.
 * Estética "Bitácora": filas de columna impresa, tick ámbar por producto, azul interactivo.
 * Reusa ProtocoloEditSheet (editor completo de cadencia/recordatorio/titulación/stock) por producto.
 *
 * Dispatch:
 *   { t: 'importProducts', names }            — crea un protocolo por producto (preset de cadencia)
 *   { t: 'go', screen: 's-account' }          — continuar (con o sin protocolo)
 *   { t: 'go', screen: 's-measures' }         — atrás
 */
import { useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, Search, Check, Plus, Pencil, ChevronRight } from 'lucide-react'
import { useApp } from '../../lib/store'
import { PEPTIDES, SUGGEST_BY_GOAL } from '../../lib/catalog'
import { cadenceLabel } from '../../lib/cadence'
import { Button } from '../ui/Button'
import { FolioLabel } from '../ui/FolioLabel'
import { fadeUp } from '../lib/motion'
import { ProtocoloEditSheet } from '../screens/ProtocoloEditSheet'

export function ProtocolSetup() {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  const goals = useMemo(
    () => [state.curGoal, ...(state.secondaryGoals ?? [])].filter(Boolean) as string[],
    [state.curGoal, state.secondaryGoals],
  )
  const tracked = useMemo(
    () => Object.keys(state.protocols).filter((p) => !state.protocols[p].archived),
    [state.protocols],
  )

  const allNames = useMemo(() => Object.keys(PEPTIDES), [])
  // Sugeridos MULTI-SEGMENTO: un producto puede aparecer bajo varios objetivos (mapa SUGGEST_BY_GOAL).
  // Orden = por objetivo elegido (curGoal primero) y, dentro de cada uno, por relevancia; dedup entre objetivos.
  const suggested = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const g of goals) {
      for (const n of SUGGEST_BY_GOAL[g] ?? []) {
        if (PEPTIDES[n] && !seen.has(n)) { seen.add(n); out.push(n) }
      }
    }
    // Fallback de compatibilidad: si ningún objetivo trae sugerencias, usa la categoría primaria.
    if (out.length === 0) return allNames.filter((n) => goals.includes(PEPTIDES[n].cat))
    return out
  }, [allNames, goals])

  // Vista: picker (elegir productos) o lista (configurar lo elegido)
  const [picker, setPicker] = useState(tracked.length === 0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editProduct, setEditProduct] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? allNames.filter((n) => n.toLowerCase().includes(q)) : suggested
    return base.filter((n) => !tracked.includes(n)).slice(0, 24)
  }, [query, allNames, suggested, tracked])

  const toggle = (n: string) =>
    setSelected((s) => { const next = new Set(s); next.has(n) ? next.delete(n) : next.add(n); return next })

  const addSelected = () => {
    const names = [...selected].filter((n) => !state.protocols[n])
    if (names.length) dispatch({ t: 'importProducts', names })
    setSelected(new Set()); setQuery(''); setPicker(false)
  }
  // Continuar a crear cuenta. NO bloqueamos si no hay protocolo (Welcome ya invita a agregar el
  // primer producto); un window.confirm aquí podía dejar al usuario atorado sin poder crear cuenta.
  const goAccount = () => dispatch({ t: 'go', screen: 's-account' })

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* App bar — folio editorial */}
      <header className="flex flex-shrink-0 items-center gap-4 px-4" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}>
        <button
          aria-label="Atrás"
          onClick={() => (picker && tracked.length > 0 ? setPicker(false) : dispatch({ t: 'go', screen: 's-measures' }))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-2 hover:text-ink"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex flex-1 flex-col gap-1.5">
          <FolioLabel n={4}>Paso 4 de 5</FolioLabel>
          <div className="h-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={4} aria-valuemin={1} aria-valuemax={5} aria-label="Paso 4 de 5">
            <div className="h-full w-[80%] rounded-full bg-blue" />
          </div>
        </div>
        <div className="w-11" />
      </header>

      {/* Scroller PLANO (no framer-motion): en iOS un contenedor con transform/animación no hace
          touch-scroll. El motion.div con la animación de entrada va ADENTRO. */}
      <div className="ios-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">
      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.03 } } }}
        className="flex flex-col gap-5"
      >
        <motion.div variants={fadeUp}>
          <p className="mb-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">
            Arma tu protocolo
            <span className="ml-2 text-blue">
              {picker ? '· 1/2 Elige productos' : '· 2/2 Configura cada uno'}
            </span>
          </p>
          <h1 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">
            {picker ? 'Elige tus productos' : 'Configura tu protocolo'}
          </h1>
          <p className="mt-2 text-[14px] text-ink-2">
            {picker
              ? `${state.curGoal ? `Sugeridos para ${state.curGoal.toLowerCase()}.` : 'Selecciona lo que quieres rastrear.'} Lo dejamos listo con días y recordatorio.`
              : 'Ajusta días, cadencia y hora de recordatorio de cada uno.'}
          </p>
        </motion.div>

        {picker ? (
          <>
            {/* Buscar */}
            <motion.div variants={fadeUp} className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar péptido…"
                className="h-12 w-full rounded-[10px] border border-hairline bg-surface pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-blue focus:outline-none focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--blue)_18%,transparent)] transition-[border-color,box-shadow]"
              />
            </motion.div>

            {!query && suggested.length > 0 && (
              <motion.div variants={fadeUp} className="-mb-2 flex flex-col gap-1">
                <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
                  Sugeridos para tu objetivo
                </p>
                <p className="text-[12px] leading-relaxed text-ink-2">
                  Solo para organizar tu seguimiento. No es recomendación médica ni de dosificación.
                </p>
              </motion.div>
            )}

            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              {results.length === 0 && (
                <p className="py-6 text-center text-[14px] text-ink-2">Sin resultados. Prueba otro nombre.</p>
              )}
              {results.map((n) => {
                const on = selected.has(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    aria-pressed={on}
                    className={`flex min-h-[52px] items-center gap-3 rounded-sm border px-4 py-2.5 text-left transition-[border-color,background-color,box-shadow] ${on ? 'border-blue bg-[color-mix(in_srgb,var(--blue)_7%,var(--surface))] shadow-[0_0_0_1px_var(--blue)]' : 'border-hairline bg-surface hover:border-ink-3'}`}
                  >
                    {/* Tick ámbar cuadrado — la marca editorial del ítem (no color-código) */}
                    <span className="h-1.5 w-1.5 shrink-0 bg-amber" aria-hidden />
                    <span className="flex flex-1 flex-col">
                      <span className="text-[15px] font-medium text-ink">{n}</span>
                      <span className="font-mono text-[12px] text-ink-3">{PEPTIDES[n].cat}</span>
                    </span>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? 'border-blue bg-blue text-primary-foreground' : 'border-hairline text-transparent'}`}>
                      <Check size={14} strokeWidth={3} />
                    </span>
                  </button>
                )
              })}
            </motion.div>
          </>
        ) : (
          <>
            {/* Lista de productos configurables */}
            <motion.div variants={fadeUp} className="flex flex-col gap-2">
              {tracked.map((p) => {
                const cad = state.protocols[p].cadence
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditProduct(p)}
                    className="flex items-center gap-3 rounded-sm border border-hairline bg-surface px-4 py-3 text-left shadow-[0_1px_2px_rgba(26,23,18,.05)] transition-[border-color] hover:border-ink-3"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 bg-amber" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold text-ink">{p}</span>
                      <span className="font-mono text-[12px] text-blue">{cad ? cadenceLabel(cad) : 'Configurar cadencia'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-2">
                      <Pencil size={13} /> Editar
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-sm border border-dashed border-blue text-[14px] font-semibold text-blue hover:bg-[color-mix(in_srgb,var(--blue)_8%,transparent)]"
              >
                <Plus size={16} /> Agregar otro producto
              </button>
            </motion.div>
          </>
        )}
      </motion.div>
      </div>

      {/* Footer FIJO — siempre visible, fuera del scroll (que en iOS puede fallar) → nunca te quedas atascado. */}
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-hairline bg-paper px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        {picker ? (
          <>
            <Button size="full" disabled={selected.size === 0} onClick={addSelected}>
              Agregar {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
            <Button
              size="full"
              variant="outline"
              onClick={goAccount}
              aria-label="Omitir protocolo y configurarlo después (sin dosis que registrar todavía)"
            >
              Configurar mi protocolo después
            </Button>
          </>
        ) : (
          <Button size="full" onClick={goAccount}>
            Continuar <ChevronRight size={16} />
          </Button>
        )}
      </div>

      {/* Editor completo por producto (cadencia / días / recordatorio / titulación / stock) */}
      <ProtocoloEditSheet open={editProduct != null} onClose={() => setEditProduct(null)} product={editProduct} />
    </div>
  )
}
