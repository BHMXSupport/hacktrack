/**
 * ProtocolSetup.tsx — v2 flow · ScreenId 's-protocol'
 *
 * Paso de onboarding que arma el protocolo del usuario para que termine YA configurado
 * (producto + cadencia + días + recordatorio). Va entre s-measures y s-account.
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
import { PEPTIDES, CATEGORY_COLOR, SUGGEST_BY_GOAL } from '../../lib/catalog'
import { cadenceLabel } from '../../lib/cadence'
import { Button } from '../ui/Button'
import { ProtocoloEditSheet } from '../screens/ProtocoloEditSheet'

const fade = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0, 0, 0.2, 1] as [number, number, number, number] } },
}

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
      {/* App bar */}
      <header className="flex flex-shrink-0 items-center gap-4 px-4" style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}>
        <button
          aria-label="Atrás"
          onClick={() => (picker && tracked.length > 0 ? setPicker(false) : dispatch({ t: 'go', screen: 's-measures' }))}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-secondary-foreground hover:text-foreground"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-secondary-foreground">Paso 4 de 5</span>
          <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={4} aria-valuemin={1} aria-valuemax={5} aria-label="Paso 4 de 5">
            <div className="h-full w-[80%] rounded-full bg-teal" />
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
        <motion.div variants={fade}>
          <p className="mb-1 text-[12px] font-semibold text-secondary-foreground">
            Arma tu protocolo
            <span className="ml-2 text-teal">
              {picker ? '· 1/2 Elige productos' : '· 2/2 Configura cada uno'}
            </span>
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            {picker ? 'Elige tus productos' : 'Configura tu protocolo'}
          </h1>
          <p className="mt-2 text-[14px] text-secondary-foreground">
            {picker
              ? `${state.curGoal ? `Sugeridos para ${state.curGoal.toLowerCase()}.` : 'Selecciona lo que quieres rastrear.'} Lo dejamos listo con días y recordatorio.`
              : 'Ajusta días, cadencia y hora de recordatorio de cada uno.'}
          </p>
        </motion.div>

        {picker ? (
          <>
            {/* Buscar */}
            <motion.div variants={fade} className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar péptido…"
                className="h-12 w-full rounded-lg border border-white/20 bg-card pl-9 pr-3 text-[15px] text-foreground placeholder:text-secondary-foreground focus:border-teal/60 focus:outline-none focus:ring-2 focus:ring-teal/20"
              />
            </motion.div>

            {!query && suggested.length > 0 && (
              <motion.div variants={fade} className="-mb-2 flex flex-col gap-1">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-secondary-foreground">
                  Sugeridos para tu objetivo
                </p>
                <p className="text-[11px] leading-relaxed text-secondary-foreground">
                  Solo para organizar tu seguimiento. No es recomendación médica ni de dosificación.
                </p>
              </motion.div>
            )}

            <motion.div variants={fade} className="flex flex-col gap-2">
              {results.length === 0 && (
                <p className="py-6 text-center text-[14px] text-secondary-foreground">Sin resultados. Prueba otro nombre.</p>
              )}
              {results.map((n) => {
                const on = selected.has(n)
                const color = CATEGORY_COLOR[PEPTIDES[n].cat] ?? '#5FC9B8'
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    aria-pressed={on}
                    className={`flex min-h-[52px] items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${on ? 'border-teal bg-teal/10' : 'border-white/20 bg-card hover:border-white/40'}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                    <span className="flex flex-1 flex-col">
                      <span className="text-[15px] font-medium text-foreground">{n}</span>
                      <span className="text-[12px] text-secondary-foreground">{PEPTIDES[n].cat}</span>
                    </span>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? 'border-teal bg-teal text-primary-foreground' : 'border-white/20 text-transparent'}`}>
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
            <motion.div variants={fade} className="flex flex-col gap-2">
              {tracked.map((p) => {
                const cad = state.protocols[p].cadence
                const color = CATEGORY_COLOR[PEPTIDES[p]?.cat] ?? '#5FC9B8'
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditProduct(p)}
                    className="flex items-center gap-3 rounded-xl border border-white/20 bg-card px-4 py-3 text-left hover:border-white/40"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold text-foreground">{p}</span>
                      <span className="text-[12px] text-teal">{cad ? cadenceLabel(cad) : 'Configurar cadencia'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-secondary-foreground">
                      <Pencil size={13} /> Editar
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-dashed border-teal/40 text-[14px] font-semibold text-teal hover:bg-teal/8"
              >
                <Plus size={16} /> Agregar otro producto
              </button>
            </motion.div>
          </>
        )}
      </motion.div>
      </div>

      {/* Footer FIJO — siempre visible, fuera del scroll (que en iOS puede fallar) → nunca te quedas atascado. */}
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-white/10 bg-void px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
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
