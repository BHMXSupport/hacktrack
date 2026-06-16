import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../lib/store'
import { IcBack, IcCheck } from '../components/icons'
import { BiohackmxFlask } from '../components/BiohackmxFlask'
import { Disclaimer } from '../components/controls'
import { MOCK_BIOHACKMX_PURCHASES, PEPTIDES, CATEGORY_COLOR } from '../lib/catalog'
import { spring, sharedAxisX, staggerParent, staggerItem } from '../lib/motion'

// Conectar cuenta BiohackMX → elegir de TUS compras cuáles estás usando y quieres trackear (puntos 1 + 3).
export function Import() {
  const { dispatch } = useApp()
  const [phase, setPhase] = useState<'connect' | 'orders'>('connect')
  const [consent, setConsent] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())

  const back = () => dispatch({ t: 'go', screen: 's-app' })
  const toggle = (p: string) =>
    setSel((s) => {
      const n = new Set(s)
      n.has(p) ? n.delete(p) : n.add(p)
      return n
    })

  function importSelected() {
    dispatch({ t: 'importProducts', names: [...sel] })
    dispatch({ t: 'tab', tab: 'inicio' })
    dispatch({ t: 'go', screen: 's-app' })
    dispatch({ t: 'toast', msg: `${sel.size} producto(s) importado(s)` })
  }

  const total = MOCK_BIOHACKMX_PURCHASES.length

  return (
    <div className="scroll" style={{ paddingBottom: 32 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px 8px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <button className="iconbtn" onClick={back} aria-label="Regresar"><IcBack /></button>
        <span className="h2" style={{ margin: 0 }}>Conectar BiohackMX</span>
      </div>

      <div style={{ padding: '8px 20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AnimatePresence mode="wait">
          {phase === 'connect' && (
            <motion.div key="connect" variants={sharedAxisX} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', padding: 28 }}>
                <div style={{ background: 'color-mix(in srgb, var(--brand-300) 16%, transparent)', borderRadius: 18, padding: 14 }}>
                  <BiohackmxFlask size={40} />
                </div>
                <div className="h2">Conecta tu cuenta de BiohackMX</div>
                <p className="body" style={{ margin: 0, color: 'var(--ink-700)' }}>
                  Trae tus compras para precargar tus productos. Inicias sesión en el sitio de BiohackMX;
                  nosotros nunca vemos tu contraseña.
                </p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-describedby="consent-desc"
                  style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: 'var(--brand-700)', cursor: 'pointer' }}
                />
                <span id="consent-desc" className="sm" style={{ color: 'var(--ink-700)', lineHeight: 1.5 }}>
                  Doy mi consentimiento para transferir los datos de mis compras de forma segura.
                </span>
              </label>

              <Disclaimer kind="general" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn btn-brand" disabled={!consent} onClick={() => setPhase('orders')}
                  style={{ opacity: consent ? 1 : 0.45, cursor: consent ? 'pointer' : 'not-allowed', gap: 10 }}>
                  <BiohackmxFlask size={20} style={{ filter: 'brightness(0) invert(1)' }} />
                  Conectar con BiohackMX
                </button>
                <button className="btn btn-outline" onClick={back}>Lo agrego manualmente</button>
              </div>
            </motion.div>
          )}

          {phase === 'orders' && (
            <motion.div key="orders" variants={sharedAxisX} initial="initial" animate="animate" exit="exit" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <div className="h2" style={{ marginBottom: 4 }}>Tus compras en BiohackMX</div>
                <p className="sm" style={{ margin: 0 }}>
                  Elige las que estás usando y quieres seguir. Omite las que ya se acabaron o ya no usas.
                </p>
              </div>

              <div aria-live="polite" className="sm" style={{ color: 'var(--ink-400)' }}>
                Seleccionadas: {sel.size} de {total}
              </div>

              {MOCK_BIOHACKMX_PURCHASES.length === 0 ? (
                <p className="sm" style={{ color: 'var(--ink-400)', margin: 0 }}>No encontramos compras recientes.</p>
              ) : (
                <motion.div className="rowlist card" style={{ padding: 0 }} variants={staggerParent} initial="initial" animate="animate">
                  {MOCK_BIOHACKMX_PURCHASES.map((o) => {
                    const on = sel.has(o.product)
                    const color = PEPTIDES[o.product] ? CATEGORY_COLOR[PEPTIDES[o.product].cat] : 'var(--brand-500)'
                    return (
                      <motion.button key={o.product + o.orderId} className="row" onClick={() => toggle(o.product)} aria-pressed={on} variants={staggerItem}>
                        <span className="row-ic"><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 999, background: color }} /></span>
                        <span className="row-main">
                          <span className="row-label">{o.product}</span>
                          <span className="row-sub">Orden {o.orderId} · {o.date}</span>
                        </span>
                        <span className="row-end" style={{ display: 'flex', alignItems: 'center' }}>
                          <motion.span
                            style={{
                              width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                              border: on ? '0' : '1.5px solid var(--ink-200)',
                              background: on ? 'var(--brand-700)' : 'transparent',
                              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            animate={{ scale: on ? 1 : 0.85, opacity: on ? 1 : 0 }}
                            transition={spring.ui}
                          >
                            {on && <IcCheck size={16} />}
                          </motion.span>
                        </span>
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}

              <Disclaimer kind="general" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn btn-brand" disabled={sel.size === 0} onClick={importSelected}
                  style={{ opacity: sel.size ? 1 : 0.45, cursor: sel.size ? 'pointer' : 'not-allowed' }}>
                  Seguir {sel.size > 0 ? `${sel.size} ` : ''}seleccionada{sel.size === 1 ? '' : 's'}
                </button>
                <button className="btn btn-outline" onClick={back}>Lo agrego manualmente</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
