// RecetarioSheet v2 — design system "Precision × Accessible"
// Biblioteca de platillos frecuentes (FoodFav): ver, agregar 1-tap y crear nuevos.
// Compliance: sin claims médicos, privacidad local, es-MX, tap targets ≥44px.
import { useState, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Plus, Shield, UtensilsCrossed, X } from 'lucide-react'
import { useApp } from '../../lib/store'
import type { FoodFav } from '../../lib/types'
import { Sheet } from '../ui/Sheet'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { DataPlate } from '../ui/DataPlate'

// ── Sub-componente: tarjeta de platillo favorito ──────────────────────────────

function FavCard({
  fav,
  onAdd,
  onDelete,
}: {
  fav: FoodFav
  onAdd: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/8 bg-raised px-4 py-4">
      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{fav.label}</p>
        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-[var(--teal-bright)]">
          {fav.kcal} kcal
        </p>
        {/* Macros opcionales */}
        {(fav.protein != null || fav.carbs != null || fav.fat != null) && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {fav.protein != null && <span className="mr-2">P {fav.protein} g</span>}
            {fav.carbs != null && <span className="mr-2">C {fav.carbs} g</span>}
            {fav.fat != null && <span>G {fav.fat} g</span>}
          </p>
        )}
        {fav.usoCount > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Usado {fav.usoCount} {fav.usoCount === 1 ? 'vez' : 'veces'}
          </p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex shrink-0 flex-col gap-2">
        {/* Agregar 1-tap */}
        <button
          type="button"
          aria-label={`Agregar ${fav.label}`}
          onClick={() => onAdd(fav.id)}
          className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground active:scale-95"
        >
          <Plus size={18} />
        </button>
        {/* Eliminar favorito */}
        <button
          type="button"
          aria-label={`Eliminar ${fav.label} de favoritos`}
          onClick={() => onDelete(fav.id)}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/6 text-muted-foreground active:scale-95"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Formulario para crear nuevo platillo ──────────────────────────────────────

interface NewDishForm {
  label: string
  kcalStr: string
  proteinStr: string
  carbsStr: string
  fatStr: string
}

const EMPTY_FORM: NewDishForm = {
  label: '',
  kcalStr: '',
  proteinStr: '',
  carbsStr: '',
  fatStr: '',
}

function parseOptNum(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'))
  return isNaN(v) || v < 0 ? null : v
}

// ── Componente principal ──────────────────────────────────────────────────────

export function RecetarioSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { state, dispatch } = useApp()
  const reduce = useReducedMotion()

  // ── Vista activa: lista de favoritos o crear nuevo ─────────────────────────
  type View = 'list' | 'create'
  const [view, setView] = useState<View>('list')

  // ── Búsqueda en favoritos ─────────────────────────────────────────────────
  const [q, setQ] = useState('')

  // ── Formulario de nuevo platillo ──────────────────────────────────────────
  const [form, setForm] = useState<NewDishForm>(EMPTY_FORM)

  // Resetear al cerrar/abrir
  if (!open && view !== 'list') {
    setView('list')
    setQ('')
    setForm(EMPTY_FORM)
  }

  // ── Platillos filtrados ───────────────────────────────────────────────────
  const filtered: FoodFav[] = q.trim()
    ? state.foodLibrary.filter((f) =>
        f.label.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : [...state.foodLibrary].sort((a, b) => b.usoCount - a.usoCount)

  // ── Acciones ──────────────────────────────────────────────────────────────

  const handleAddFav = useCallback(
    (id: string) => {
      dispatch({ t: 'addFavMeal', id })
      dispatch({ t: 'toast', msg: 'Platillo agregado' })
      onClose()
    },
    [dispatch, onClose],
  )

  const handleDeleteFav = useCallback(
    (id: string) => {
      dispatch({ t: 'delFav', id })
    },
    [dispatch],
  )

  const handleCreate = useCallback(() => {
    const label = form.label.trim()
    const kcal = parseFloat(form.kcalStr.replace(',', '.'))
    if (!label || isNaN(kcal) || kcal <= 0) return

    dispatch({
      t: 'createFav',
      fav: {
        label,
        kcal: Math.round(kcal),
        protein: parseOptNum(form.proteinStr),
        carbs: parseOptNum(form.carbsStr),
        fat: parseOptNum(form.fatStr),
        hourBucket: {},
        defaultMultiplier: 1,
      },
    })
    dispatch({ t: 'toast', msg: 'Platillo guardado' })
    setForm(EMPTY_FORM)
    setView('list')
  }, [form, dispatch])

  const formValid =
    form.label.trim().length > 0 &&
    parseFloat(form.kcalStr.replace(',', '.')) > 0

  // ── Helpers de campo numérico ─────────────────────────────────────────────
  function numField(
    key: keyof NewDishForm,
    label: string,
    required = false,
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`rf-${key}`}
          className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
          {!required && (
            <span className="ml-1 font-normal normal-case text-muted-foreground/70">
              · opcional
            </span>
          )}
        </label>
        <input
          id={`rf-${key}`}
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={form[key]}
          onChange={(e) => {
            const v = e.target.value.replace(',', '.')
            if (/^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, [key]: v }))
          }}
          className="h-11 rounded-lg border border-white/10 bg-raised px-3 text-[14px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
        />
      </div>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Recetario">
      <div className="flex flex-col gap-4">

        {/* ── Tabs: Mis platillos / Crear ── */}
        <div className="flex gap-1 rounded-full bg-white/6 p-1">
          {(['list', 'create'] as View[]).map((v) => {
            const active = view === v
            const label = v === 'list' ? 'Mis platillos' : 'Crear nuevo'
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => setView(v)}
                className={[
                  'relative flex h-10 flex-1 items-center justify-center rounded-full text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                  active ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {active && (
                  <motion.span
                    layoutId="recetario-pill"
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 320, damping: 30 }
                    }
                    className="absolute inset-0 rounded-full bg-card shadow-[0_1px_0_rgba(255,255,255,.06)_inset,0_8px_20px_rgba(0,0,0,.4)]"
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            )
          })}
        </div>

        {/* ── Vista: lista de favoritos ── */}
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3"
            >
              {/* Buscador */}
              {state.foodLibrary.length > 4 && (
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Buscar platillo…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="h-11 w-full rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                  />
                  {q && (
                    <button
                      type="button"
                      aria-label="Limpiar búsqueda"
                      onClick={() => setQ('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Lista */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <UtensilsCrossed size={32} className="text-muted-foreground/40" />
                  <p className="text-[14px] text-muted-foreground">
                    {q
                      ? `Sin resultados para "${q}"`
                      : 'Aún no tienes platillos guardados'}
                  </p>
                  {!q && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView('create')}
                    >
                      Crear mi primer platillo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((fav) => (
                    <FavCard
                      key={fav.id}
                      fav={fav}
                      onAdd={handleAddFav}
                      onDelete={handleDeleteFav}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Vista: crear nuevo platillo ── */}
          {view === 'create' && (
            <motion.div
              key="create"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-4"
            >
              {/* Nombre del platillo */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rf-label"
                  className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Nombre del platillo
                </label>
                <input
                  id="rf-label"
                  type="text"
                  placeholder="Ej. Avena con fruta"
                  maxLength={80}
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  autoFocus
                  className="h-11 rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
              </div>

              {/* kcal — requerido */}
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Calorías
                </p>
                <DataPlate className="flex items-center justify-center px-4 py-4">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Calorías (kcal)"
                    value={form.kcalStr}
                    onChange={(e) => {
                      const v = e.target.value.replace(',', '.')
                      if (/^\d*\.?\d*$/.test(v)) setForm((f) => ({ ...f, kcalStr: v }))
                    }}
                    className="w-full bg-transparent text-center font-mono text-[36px] font-bold tabular-nums text-[var(--teal-bright)] placeholder:text-muted-foreground focus:outline-none"
                  />
                </DataPlate>
                <p className="text-center text-[12px] text-muted-foreground">kcal</p>
              </div>

              {/* Macros opcionales */}
              <div className="grid grid-cols-3 gap-3">
                {numField('proteinStr', 'Proteína (g)')}
                {numField('carbsStr', 'Carbos (g)')}
                {numField('fatStr', 'Grasa (g)')}
              </div>

              {/* Chips de macros rápidos — atajos visuales */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Solo kcal', action: () => setForm((f) => ({ ...f, proteinStr: '', carbsStr: '', fatStr: '' })) },
                ].map((s) => (
                  <Chip key={s.label} active={false} onClick={s.action}>
                    {s.label}
                  </Chip>
                ))}
              </div>

              {/* CTA guardar */}
              <Button
                variant="primary"
                size="full"
                disabled={!formValid}
                onClick={handleCreate}
              >
                Guardar platillo
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Privacidad ── */}
        <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
          <Shield size={12} className="shrink-0" />
          Tu historial se guarda solo en tu dispositivo
        </p>

      </div>
    </Sheet>
  )
}
