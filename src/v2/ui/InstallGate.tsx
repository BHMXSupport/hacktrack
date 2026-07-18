// Gate de instalación: si la app NO corre instalada (standalone), no deja pasar y muestra
// instrucciones según el sistema operativo para agregarla a la pantalla de inicio.
// Caso clave: el link suele abrirse en el navegador embebido de WhatsApp/Instagram, donde NO se
// puede instalar → ahí se indica abrirla en Safari/Chrome primero.
// Estética "Bitácora": papel cálido, titular serif, pasos numerados en azul, columnas impresas.
import { useState, type ReactNode } from 'react'
import { Share, Plus, MoreVertical, Download, Check, Smartphone, Link2 } from 'lucide-react'
import { detectPlatform, useInstallAvailable, useInstalled, promptInstall } from '../../lib/install'

const LOGO = `${import.meta.env.BASE_URL}pwa-512.png`

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--blue)_12%,transparent)] font-mono text-[12px] font-semibold text-blue">{n}</span>
      <p className="text-[14px] leading-relaxed text-ink-2">{children}</p>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  // Columna impresa: superficie + hairline + sombra susurro, radio 10
  return <div className="flex w-full flex-col gap-3.5 rounded-sm border border-hairline bg-surface p-5 text-left shadow-[0_1px_2px_rgba(26,23,18,.05)]">{children}</div>
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
    <div className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto bg-paper px-7 pb-10 pt-[max(44px,env(safe-area-inset-top))] text-center">
      <div className="flex w-full max-w-[400px] flex-1 flex-col items-center justify-center gap-6">
        <img src={LOGO} alt="Hacktrack" className="h-20 w-20 rounded-[22px] border border-hairline shadow-[0_12px_40px_rgba(26,23,18,.25)]" />

        <div>
          <p className="mb-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.16em] text-ink-2">
            Hacktrack · Tu bitácora
          </p>
          <h1 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-ink">Instala Hacktrack</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Para usarla, agrégala a tu pantalla de inicio. Funciona como app: rápida, sin tienda y siempre a la mano.
          </p>
        </div>

        {installed ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-surface p-6 shadow-[0_1px_2px_rgba(26,23,18,.05)]">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok"><Check size={26} strokeWidth={2.5} /></span>
            <p className="text-[15px] font-semibold text-ink">¡Listo, ya está instalada!</p>
            <p className="text-[13px] text-ink-2">Ábrela desde el ícono de <span className="font-semibold text-ink">Hacktrack</span> en tu pantalla de inicio.</p>
          </div>
        ) : p.inApp ? (
          // Navegador embebido (WhatsApp/Instagram/…): aquí no se puede instalar
          <Panel>
            <p className="text-[14px] font-semibold text-ink">Primero, ábrela en tu navegador</p>
            <p className="text-[13px] text-ink-2">Estás dentro de otra app y aquí no se puede instalar. Ábrela en <span className="font-semibold text-ink">{navegador}</span>:</p>
            <Step n={1}>Toca el menú <MoreVertical size={14} className="mb-0.5 inline" /> (arriba a la derecha).</Step>
            <Step n={2}>Elige <span className="font-semibold text-ink">«Abrir en {navegador}»</span>.</Step>
            <Step n={3}>Ahí sigue los pasos para agregarla a tu inicio.</Step>
            <button
              type="button"
              onClick={copyLink}
              className="mt-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border border-blue bg-[color-mix(in_srgb,var(--blue)_8%,transparent)] px-4 py-2.5 text-[14px] font-semibold text-blue"
            >
              {copied ? <Check size={16} /> : <Link2 size={16} />}
              {copied ? '¡Enlace copiado!' : 'Copiar enlace'}
            </button>
          </Panel>
        ) : p.isIOS ? (
          <Panel>
            <Step n={1}>Toca <span className="font-semibold text-ink">Compartir</span> <Share size={14} className="mb-0.5 inline text-blue" /> en la barra de {navegador}.</Step>
            <Step n={2}>Baja y elige <span className="font-semibold text-ink">«Agregar a inicio»</span> <Plus size={14} className="mb-0.5 inline text-blue" />.</Step>
            <Step n={3}>Abre <span className="font-semibold text-ink">Hacktrack</span> desde el nuevo ícono.</Step>
          </Panel>
        ) : p.isAndroid && installAvail ? (
          <div className="flex w-full flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleInstall}
              disabled={busy}
              aria-busy={busy}
              className="flex h-14 w-full max-w-[340px] items-center justify-center gap-2 rounded-[10px] bg-blue text-[16px] font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(26,23,18,.20)] active:scale-[.98] disabled:opacity-70"
            >
              <Download size={20} /> {busy ? 'Instalando…' : 'Instalar app'}
            </button>
            <p className="text-[12px] text-ink-3">o desde el menú <MoreVertical size={12} className="mb-0.5 inline" /> → «Instalar app»</p>
          </div>
        ) : p.isAndroid ? (
          <Panel>
            <Step n={1}>Toca el menú <span className="font-semibold text-ink">⋮</span> <MoreVertical size={14} className="mb-0.5 inline" /> (arriba a la derecha).</Step>
            <Step n={2}>Elige <span className="font-semibold text-ink">«Instalar app»</span> o <span className="font-semibold text-ink">«Agregar a pantalla de inicio»</span>.</Step>
            <Step n={3}>Abre <span className="font-semibold text-ink">Hacktrack</span> desde el ícono.</Step>
          </Panel>
        ) : (
          <Panel>
            <div className="flex items-center gap-2 text-ink-2"><Smartphone size={16} className="text-blue" /><span className="text-[14px]">Ábrela en tu teléfono para instalarla.</span></div>
            <p className="text-[13px] text-ink-2">Escanea o abre <span className="break-all font-semibold text-ink">{window.location.host}/hacktrack</span> en {navegador} (iPhone o Android) y agrégala a tu pantalla de inicio.</p>
          </Panel>
        )}
      </div>

      <p className="mt-6 max-w-[360px] text-[12px] leading-relaxed text-ink-3">
        Hacktrack es una herramienta de seguimiento personal de bienestar. No reemplaza consejo médico.
      </p>
    </div>
  )
}
