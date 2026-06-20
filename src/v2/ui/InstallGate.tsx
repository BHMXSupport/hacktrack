// Gate de instalación: si la app NO corre instalada (standalone), no deja pasar y muestra
// instrucciones según el sistema operativo para agregarla a la pantalla de inicio.
// Caso clave: el link suele abrirse en el navegador embebido de WhatsApp/Instagram, donde NO se
// puede instalar → ahí se indica abrirla en Safari/Chrome primero.
import { useState, type ReactNode } from 'react'
import { Share, Plus, MoreVertical, Download, Check, Smartphone, Link2 } from 'lucide-react'
import { detectPlatform, useInstallAvailable, useInstalled, promptInstall } from '../../lib/install'

const LOGO = `${import.meta.env.BASE_URL}pwa-512.png`

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal/15 font-mono text-[12px] font-semibold text-teal">{n}</span>
      <p className="text-[14px] leading-relaxed text-secondary-foreground">{children}</p>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-3.5 rounded-2xl border border-white/10 bg-raised p-5 text-left">{children}</div>
}

export function InstallGate() {
  const p = detectPlatform()
  const installAvail = useInstallAvailable()
  const installed = useInstalled()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleInstall() {
    setBusy(true)
    try { await promptInstall() } finally { setBusy(false) }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }

  const navegador = p.isIOS ? 'Safari' : 'Chrome'

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto bg-void px-7 pb-10 pt-[max(44px,env(safe-area-inset-top))] text-center">
      <div className="flex w-full max-w-[400px] flex-1 flex-col items-center justify-center gap-6">
        <img src={LOGO} alt="Hacktrack" className="h-20 w-20 rounded-[22px] shadow-[0_12px_40px_rgba(0,0,0,.5),0_0_0_1px_rgba(95,201,184,.18)]" />

        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Instala Hacktrack</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-secondary-foreground">
            Para usarla, agrégala a tu pantalla de inicio. Funciona como app: rápida, sin tienda y siempre a la mano.
          </p>
        </div>

        {installed ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-teal/25 bg-teal/[0.08] p-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-teal/15 text-teal"><Check size={26} strokeWidth={2.5} /></span>
            <p className="text-[15px] font-semibold text-foreground">¡Listo, ya está instalada!</p>
            <p className="text-[13px] text-secondary-foreground">Ábrela desde el ícono de <span className="font-semibold text-foreground">Hacktrack</span> en tu pantalla de inicio.</p>
          </div>
        ) : p.inApp ? (
          // Navegador embebido (WhatsApp/Instagram/…): aquí no se puede instalar
          <Panel>
            <p className="text-[14px] font-semibold text-foreground">Primero, ábrela en tu navegador</p>
            <p className="text-[13px] text-secondary-foreground">Estás dentro de otra app y aquí no se puede instalar. Ábrela en <span className="font-semibold text-foreground">{navegador}</span>:</p>
            <Step n={1}>Toca el menú <MoreVertical size={14} className="mb-0.5 inline" /> (arriba a la derecha).</Step>
            <Step n={2}>Elige <span className="font-semibold text-foreground">«Abrir en {navegador}»</span>.</Step>
            <Step n={3}>Ahí sigue los pasos para agregarla a tu inicio.</Step>
            <button
              type="button"
              onClick={copyLink}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-[14px] font-semibold text-teal"
            >
              {copied ? <Check size={16} /> : <Link2 size={16} />}
              {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
            </button>
          </Panel>
        ) : p.isIOS ? (
          <Panel>
            <Step n={1}>Toca <span className="font-semibold text-foreground">Compartir</span> <Share size={14} className="mb-0.5 inline text-teal" /> en la barra de {navegador}.</Step>
            <Step n={2}>Baja y elige <span className="font-semibold text-foreground">«Agregar a inicio»</span> <Plus size={14} className="mb-0.5 inline text-teal" />.</Step>
            <Step n={3}>Abre <span className="font-semibold text-foreground">Hacktrack</span> desde el nuevo ícono.</Step>
          </Panel>
        ) : p.isAndroid && installAvail ? (
          <div className="flex w-full flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleInstall}
              disabled={busy}
              aria-busy={busy}
              className="flex h-14 w-full max-w-[340px] items-center justify-center gap-2 rounded-2xl bg-teal text-[16px] font-semibold text-[#04211c] shadow-[0_8px_24px_rgba(95,201,184,.28)] active:scale-[.98] disabled:opacity-70"
            >
              <Download size={20} /> {busy ? 'Instalando…' : 'Instalar app'}
            </button>
            <p className="text-[12px] text-muted-foreground">o desde el menú <MoreVertical size={12} className="mb-0.5 inline" /> → «Instalar app»</p>
          </div>
        ) : p.isAndroid ? (
          <Panel>
            <Step n={1}>Toca el menú <span className="font-semibold text-foreground">⋮</span> <MoreVertical size={14} className="mb-0.5 inline" /> (arriba a la derecha).</Step>
            <Step n={2}>Elige <span className="font-semibold text-foreground">«Instalar app»</span> o <span className="font-semibold text-foreground">«Agregar a pantalla de inicio»</span>.</Step>
            <Step n={3}>Abre <span className="font-semibold text-foreground">Hacktrack</span> desde el ícono.</Step>
          </Panel>
        ) : (
          <Panel>
            <div className="flex items-center gap-2 text-secondary-foreground"><Smartphone size={16} className="text-teal" /><span className="text-[14px]">Ábrela en tu teléfono para instalarla.</span></div>
            <p className="text-[13px] text-secondary-foreground">Escanea o abre <span className="break-all font-semibold text-foreground">{window.location.host}/hacktrack</span> en {navegador} (iPhone o Android) y agrégala a tu pantalla de inicio.</p>
          </Panel>
        )}
      </div>

      <p className="mt-6 max-w-[360px] text-[11px] leading-relaxed text-muted-foreground">
        Hacktrack es una herramienta de seguimiento personal de bienestar. No reemplaza consejo médico.
      </p>
    </div>
  )
}
