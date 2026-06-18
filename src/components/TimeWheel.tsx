import { useEffect, useRef, useState } from 'react'

// Selector de hora tipo "scroll" (rueda con snap). 3 columnas: hora · minuto · AM/PM.
const ITEM = 40
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINS = Array.from({ length: 12 }, (_, i) => i * 5) // paso de 5
const APS = ['AM', 'PM']

function Column({
  items,
  index,
  onIndex,
  fmt,
  label,
}: {
  items: (number | string)[]
  index: number
  onIndex: (i: number) => void
  fmt?: (v: number | string) => string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const raf = useRef<number>()

  // posiciona el scroll en el índice inicial
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onScroll() {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM)))
      if (i !== index) onIndex(i)
    })
  }

  // a11y: teclado (antes era un div con solo onScroll → invisible para teclado y lectores de pantalla)
  function goTo(i: number) {
    const clamped = Math.max(0, Math.min(items.length - 1, i))
    if (ref.current) ref.current.scrollTop = clamped * ITEM
    if (clamped !== index) onIndex(clamped)
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); goTo(index + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); goTo(index - 1) }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0) }
    else if (e.key === 'End') { e.preventDefault(); goTo(items.length - 1) }
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={items.length - 1}
      aria-valuenow={index}
      aria-valuetext={String(fmt ? fmt(items[index]) : items[index])}
      style={{
        height: ITEM * 3,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        flex: 1,
        textAlign: 'center',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        borderRadius: 12,
      }}
    >
      <div style={{ height: ITEM }} aria-hidden />
      {items.map((v, i) => (
        <div
          key={String(v)}
          style={{
            height: ITEM,
            lineHeight: `${ITEM}px`,
            scrollSnapAlign: 'center',
            fontFamily: 'JetBrains Mono',
            fontSize: i === index ? 22 : 18,
            fontWeight: i === index ? 700 : 500,
            color: i === index ? 'var(--ink-900)' : 'var(--ink-300)',
            transition: 'font-size .12s, color .12s',
          }}
        >
          {fmt ? fmt(v) : v}
        </div>
      ))}
      <div style={{ height: ITEM }} aria-hidden />
    </div>
  )
}

export function TimeWheel({ initial, onChange }: { initial?: Date; onChange: (label: string) => void }) {
  const base = initial ?? new Date()
  const h24 = base.getHours()
  const [hi, setHi] = useState(((h24 % 12) || 12) - 1)
  const [mi, setMi] = useState(Math.round(base.getMinutes() / 5) % 12)
  const [ai, setAi] = useState(h24 >= 12 ? 1 : 0)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return } // no emitir en el montaje (preserva "Ahora")
    const label = `${HOURS[hi]}:${String(MINS[mi]).padStart(2, '0')} ${APS[ai]}`
    onChange(label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hi, mi, ai])

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 4, background: 'var(--ink-100)', borderRadius: 16, padding: '0 12px' }}>
      {/* banda central que marca la selección */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 8, right: 8, top: ITEM, height: ITEM,
          borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          pointerEvents: 'none',
        }}
      />
      <Column items={HOURS} index={hi} onIndex={setHi} label="Hora" />
      <div style={{ lineHeight: `${ITEM * 3}px`, fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--ink-400)' }}>:</div>
      <Column items={MINS} index={mi} onIndex={setMi} fmt={(v) => String(v).padStart(2, '0')} label="Minutos" />
      <Column items={APS} index={ai} onIndex={setAi} label="AM o PM" />
    </div>
  )
}
