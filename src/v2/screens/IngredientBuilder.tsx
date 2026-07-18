// IngredientBuilder — arma un platillo desde ingredientes (g/ml) y guarda totales.
// Vestido "Bitácora": pozos cálidos + hairline, readouts mono en tinta, total serif ámbar
// sobre placa de instrumento. Reusa el RAW DATA de ingredientes del catálogo (INGREDIENTS).
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

// Foco azul vía color-mix (el alfa sobre var(--x) no se emite en este setup).
const FOCUS_RING = 'focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--blue)_45%,transparent)]'

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
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Agregar ingrediente (pollo, arroz…)"
          className={`h-11 w-full rounded-[8px] border border-hairline bg-raised pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-3 ${FOCUS_RING}`}
        />
      </div>

      {/* Resultados de búsqueda — columna impresa con reglas hairline */}
      {results.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-[8px] border border-hairline bg-surface">
          {results.map((ing) => (
            <button
              key={ing.name}
              type="button"
              onClick={() => addIng(ing.name)}
              className="flex min-h-[44px] items-center justify-between gap-3 border-b border-hairline px-3 py-2 text-left last:border-0 transition-colors hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="truncate text-[14px] text-ink">{ing.name}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-3">
                {ing.kcal} kcal · P {ing.protein}/{ing.per}{ing.unit}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Chips rápidos cuando no hay filas */}
      {rows.length === 0 && results.length === 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-ink-2">Empieza agregando un ingrediente:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => addIng(n)}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-hairline bg-surface px-3.5 font-mono text-[12px] font-medium text-ink-2 transition-colors hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
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
              <div key={row.name} className="flex items-center gap-2 rounded-sm border border-hairline bg-raised px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{ing.name}</p>
                  <p className="font-mono text-[12px] tabular-nums text-ink-2">{rowKcal} kcal</p>
                </div>
                {/* Stepper de gramos (targets 44px) */}
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="−5g" disabled={row.grams <= 5} onClick={() => setGrams(row.name, row.grams - 5)} className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-surface text-ink-2 active:scale-95 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
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
                    className={`h-11 w-12 rounded-[8px] border border-hairline bg-surface text-center font-mono text-[13px] tabular-nums text-ink ${FOCUS_RING}`}
                  />
                  <span className="font-mono text-[11px] text-ink-3">{ing.unit}</span>
                  <button type="button" aria-label="+5g" onClick={() => setGrams(row.name, row.grams + 5)} className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-surface text-ink-2 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    <Plus size={14} />
                  </button>
                </div>
                <button type="button" aria-label={`Quitar ${ing.name}`} onClick={() => removeRow(row.name)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:text-alert focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Totales — placa de instrumento, numeral serif ámbar (energía) */}
      {rows.length > 0 && (
        <DataPlate className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[12px] font-medium uppercase tracking-[0.12em] opacity-70">Total</span>
            <span className="font-serif text-[28px] font-normal tabular-nums text-amber">
              {r0(totals.kcal)} <span className="font-mono text-[13px] font-normal text-[#F2EDE3] opacity-60">kcal</span>
            </span>
          </div>
          <div className="flex gap-4 font-mono text-[12px] tabular-nums opacity-80">
            <span>P {r0(totals.protein)} g</span>
            <span>C {r0(totals.carbs)} g</span>
            <span>G {r0(totals.fat)} g</span>
          </div>
        </DataPlate>
      )}

      {/* Nombre del platillo */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ib-name" className="font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-ink-2">Nombre del platillo</label>
          <input
            id="ib-name"
            type="text"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={autoName}
            className={`h-11 rounded-[8px] border border-hairline bg-raised px-3 text-[15px] text-ink placeholder:text-ink-3 ${FOCUS_RING}`}
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
