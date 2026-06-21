// IngredientBuilder — arma un platillo desde ingredientes (g/ml) y guarda totales. (v2)
// Reusa el RAW DATA de ingredientes del catálogo (INGREDIENTS); diseño nuevo del rebuild.
import { useMemo, useState } from 'react'
import { Search, Plus, Minus, X, Check } from 'lucide-react'
import { useApp } from '../../lib/store'
import { INGREDIENTS } from '../../lib/catalog'
import { Button } from '../ui/Button'
import { DataPlate } from '../ui/DataPlate'

const ING_MAP = new Map(INGREDIENTS.map((i) => [i.name, i]))
const QUICK = ['Tofu firme', 'Arroz blanco cocido', 'Lentejas cocidas', 'Brócoli', 'Avena en hojuelas cruda', 'Aguacate']
  .filter((n) => ING_MAP.has(n))

const r0 = (n: number) => Math.round(n)

export function IngredientBuilder({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { dispatch } = useApp()
  const [rows, setRows] = useState<{ name: string; grams: number }[]>([])
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    const picked = new Set(rows.map((r) => r.name))
    return INGREDIENTS.filter((i) => !picked.has(i.name) && i.name.toLowerCase().includes(q)).slice(0, 10)
  }, [query, rows])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          const ing = ING_MAP.get(r.name)
          if (!ing) return acc
          const f = r.grams / ing.per
          return {
            kcal: acc.kcal + ing.kcal * f,
            protein: acc.protein + ing.protein * f,
            carbs: acc.carbs + ing.carbs * f,
            fat: acc.fat + ing.fat * f,
          }
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [rows],
  )

  const autoName =
    name.trim() ||
    (rows.length
      ? `${rows[0].name}${rows.length > 1 ? ` +${rows.length - 1}` : ''}`
      : '')
  const valid = rows.length > 0 && totals.kcal > 0

  const addIng = (n: string) => {
    setRows((rs) => (rs.some((r) => r.name === n) ? rs : [...rs, { name: n, grams: 100 }]))
    setQuery('')
  }
  const setGrams = (n: string, g: number) =>
    setRows((rs) => rs.map((r) => (r.name === n ? { ...r, grams: Math.max(1, g) } : r)))
  const removeRow = (n: string) => setRows((rs) => rs.filter((r) => r.name !== n))

  function save() {
    if (!valid) return
    dispatch({
      t: 'createFav',
      fav: {
        label: autoName || 'Platillo',
        kcal: r0(totals.kcal),
        protein: r0(totals.protein),
        carbs: r0(totals.carbs),
        fat: r0(totals.fat),
        hourBucket: {},
        defaultMultiplier: 1,
      },
    })
    dispatch({ t: 'toast', msg: 'Platillo guardado' })
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Buscar ingrediente */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Agregar ingrediente (pollo, arroz…)"
          className="h-11 w-full rounded-lg border border-white/10 bg-raised pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
        />
      </div>

      {/* Resultados de búsqueda */}
      {results.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-raised">
          {results.map((ing) => (
            <button
              key={ing.name}
              type="button"
              onClick={() => addIng(ing.name)}
              className="flex min-h-[44px] items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2 text-left last:border-0 hover:bg-white/5"
            >
              <span className="truncate text-[14px] text-foreground">{ing.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {ing.kcal} kcal · P {ing.protein}/{ing.per}{ing.unit}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Chips rápidos cuando no hay filas */}
      {rows.length === 0 && results.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-muted-foreground">Empieza agregando un ingrediente:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => addIng(n)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-white/12 bg-white/5 px-3 text-[12px] font-semibold text-secondary-foreground hover:bg-white/10"
              >
                <Plus size={12} /> {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filas de ingredientes */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const ing = ING_MAP.get(row.name)!
            const f = row.grams / ing.per
            const rowKcal = r0(ing.kcal * f)
            return (
              <div key={row.name} className="flex items-center gap-2 rounded-xl border border-white/8 bg-raised px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-foreground">{ing.name}</p>
                  <p className="font-mono text-[11px] text-[var(--teal-bright)]">{rowKcal} kcal</p>
                </div>
                {/* Stepper de gramos */}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" aria-label="−5g" disabled={row.grams <= 5} onClick={() => setGrams(row.name, row.grams - 5)} className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-secondary-foreground active:scale-95 disabled:opacity-40">
                    <Minus size={14} />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`Gramos de ${ing.name}`}
                    value={row.grams}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '')
                      setGrams(row.name, v === '' ? 0 : parseInt(v, 10))
                    }}
                    className="h-9 w-12 rounded-md border border-white/10 bg-void text-center font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
                  />
                  <span className="text-[11px] text-muted-foreground">{ing.unit}</span>
                  <button type="button" aria-label="+5g" onClick={() => setGrams(row.name, row.grams + 5)} className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-secondary-foreground active:scale-95">
                    <Plus size={14} />
                  </button>
                </div>
                <button type="button" aria-label={`Quitar ${ing.name}`} onClick={() => removeRow(row.name)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-alert">
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Totales */}
      {rows.length > 0 && (
        <DataPlate className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="font-mono text-[24px] font-bold tabular-nums text-[var(--teal-bright)]">{r0(totals.kcal)} <span className="text-[13px] font-normal text-muted-foreground">kcal</span></span>
          </div>
          <div className="flex gap-4 font-mono text-[12px]">
            <span style={{ color: 'var(--teal-bright)' }}>P {r0(totals.protein)} g</span>
            <span style={{ color: '#D97706' }}>C {r0(totals.carbs)} g</span>
            <span style={{ color: '#6B7BE8' }}>G {r0(totals.fat)} g</span>
          </div>
        </DataPlate>
      )}

      {/* Nombre del platillo */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ib-name" className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Nombre del platillo</label>
          <input
            id="ib-name"
            type="text"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={autoName}
            className="h-11 rounded-lg border border-white/10 bg-raised px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal/50"
          />
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="flex-1">
          <X size={14} /> Cancelar
        </Button>
        <Button variant="primary" size="sm" disabled={!valid} onClick={save} className="flex-1">
          <Check size={14} /> Guardar platillo
        </Button>
      </div>
    </div>
  )
}
