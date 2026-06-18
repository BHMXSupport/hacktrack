// Asistente de instalación (Opción B) — pantalla de bienvenida que aparece cuando se abre el link en el
// navegador y la app NO está instalada. Detecta plataforma: Android → botón nativo de instalar (1 toque);
// iPhone → guía visual Compartir → Agregar a inicio; navegador embebido (WhatsApp/IG) → "abre en Safari/Chrome".
import { useState } from 'react'
import { detectPlatform, promptInstall, useInstallAvailable, useInstalled } from '../lib/install'

// Resuelve respecto a la base del documento (/hacktrack/ en prod, / en dev) sin depender de import.meta
const APP_ICON = new URL('pwa-192.png', document.baseURI).href

// Ícono de "Compartir" de iOS (cuadro con flecha hacia arriba)
function IosShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" /><path d="m8 8 4-4 4 4" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}
function PlusSquareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
      <span style={{
        flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'var(--brand-700)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
      }}>{n}</span>
      <span className="body" style={{ color: 'var(--ink-700)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{children}</span>
    </div>
  )
}

export function InstallGate() {
  const p = detectPlatform()
  const installAvailable = useInstallAvailable()
  const installed = useInstalled()
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* noop */ }
  }

  // ── Contenido según plataforma/contexto ──
  let body: React.ReactNode
  if (installed) {
    // Android tras aceptar la instalación: el tab actual sigue en el navegador → guíalo al ícono
    body = (
      <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>
        ✅ ¡Instalada! Cierra esta pestaña y abre <b>Hacktrack</b> desde el ícono en tu pantalla de inicio.
      </p>
    )
  } else if (p.inApp) {
    // Navegador embebido (WhatsApp/Instagram/…): no puede instalar PWA
    body = (
      <>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>
          Abriste el link dentro de otra app. Para instalar Hacktrack, ábrelo en {p.isIOS ? 'Safari' : 'Chrome'}.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
          <Step n={1}>Toca el menú <b>⋯</b> (arriba a la derecha)</Step>
          <Step n={2}>Elige <b>“Abrir en {p.isIOS ? 'Safari' : 'Chrome'}”</b></Step>
        </div>
        <button className="btn btn-outline" onClick={copyLink}>{copied ? '¡Link copiado!' : 'Copiar link'}</button>
      </>
    )
  } else if (p.isAndroid) {
    body = installAvailable ? (
      <>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>Instálala en tu teléfono para abrirla a pantalla completa, con su ícono.</p>
        <button className="btn btn-brand" style={{ gap: 8 }} onClick={async () => { const r = await promptInstall(); if (r === 'unavailable') { /* fallback abajo */ } }}>
          <PlusSquareIcon size={20} /> Instalar app
        </button>
      </>
    ) : (
      <>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>Para instalarla en tu teléfono:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Step n={1}>Toca el menú <b>⋮</b> de Chrome (arriba a la derecha)</Step>
          <Step n={2}>Elige <b>“Instalar app”</b> o <b>“Agregar a pantalla principal”</b></Step>
        </div>
      </>
    )
  } else if (p.isIOS) {
    body = p.iosSafari ? (
      <>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>Instálala en tu iPhone para abrirla a pantalla completa, con su ícono:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Step n={1}>Toca <IosShareIcon size={20} /> <b>Compartir</b> (barra de abajo de Safari)</Step>
          <Step n={2}>Baja y elige <PlusSquareIcon size={18} /> <b>“Agregar a inicio”</b></Step>
          <Step n={3}>Toca <b>“Agregar”</b> arriba a la derecha</Step>
        </div>
      </>
    ) : (
      <>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>
          En iPhone, la instalación solo funciona en <b>Safari</b>. Abre este link en Safari y vuelve a intentar.
        </p>
        <button className="btn btn-outline" onClick={copyLink}>{copied ? '¡Link copiado!' : 'Copiar link'}</button>
      </>
    )
  } else {
    // Desktop
    body = (
      <>
        <p className="body" style={{ color: 'var(--ink-700)', margin: 0 }}>Hacktrack es una app para tu celular. Ábrela en tu teléfono (iPhone con Safari o Android con Chrome) para instalarla.</p>
        <button className="btn btn-outline" onClick={copyLink}>{copied ? '¡Link copiado!' : 'Copiar link'}</button>
      </>
    )
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar Hacktrack"
      style={{
        position: 'absolute', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 18, textAlign: 'center',
        padding: 'max(28px, calc(env(safe-area-inset-top,0px) + 24px)) 26px max(28px, calc(env(safe-area-inset-bottom,0px) + 24px))',
      }}
    >
      <img src={APP_ICON} alt="Hacktrack" width={84} height={84} style={{ borderRadius: 20, boxShadow: 'var(--e2)' }} />
      <div>
        <div className="h1" style={{ color: 'var(--ink-900)' }}>Instala Hacktrack</div>
        <p className="sm" style={{ color: 'var(--ink-400)', marginTop: 6 }}>Tu progreso, en una sola pantalla.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 340 }}>
        {body}
      </div>
    </div>
  )
}
