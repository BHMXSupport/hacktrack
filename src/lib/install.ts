// Detección de plataforma + captura del prompt de instalación PWA para el asistente de instalación.
import { useEffect, useState } from 'react'

// ── Captura temprana del evento beforeinstallprompt (Android/Chrome) ──────────────
// Se dispara muy temprano (a veces antes de montar React), por eso lo capturamos a nivel módulo.
let deferred: (Event & { prompt: () => void; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }) | null = null
let installed = false
const listeners = new Set<() => void>()
function notify() { listeners.forEach((l) => l()) }

export function initInstallCapture(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // evita el mini-infobar nativo; lo disparamos nosotros desde el botón
    deferred = e as never
    notify()
  })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; notify() })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable'
  deferred.prompt()
  const { outcome } = await deferred.userChoice
  if (outcome === 'accepted') deferred = null
  return outcome
}

// Hook: ¿hay prompt nativo de instalación disponible? (Android Chrome que cumple criterios)
export function useInstallAvailable(): boolean {
  const [avail, setAvail] = useState(() => !!deferred)
  useEffect(() => {
    const cb = () => setAvail(!!deferred)
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }, [])
  return avail
}

// Hook: ¿ya se instaló? (evento appinstalled) → para mostrar el estado de éxito
export function useInstalled(): boolean {
  const [done, setDone] = useState(() => installed)
  useEffect(() => {
    const cb = () => setDone(installed)
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }, [])
  return done
}

// ── Detección de plataforma / contexto ────────────────────────────────────────────
export interface PlatformInfo {
  isIOS: boolean
  isAndroid: boolean
  isStandalone: boolean   // ya instalada (corre desde el ícono)
  inApp: boolean          // navegador embebido (WhatsApp/Instagram/Facebook/…): NO puede instalar PWA
  iosSafari: boolean      // iOS + Safari real (única forma de "Agregar a inicio" en iPhone)
  isDesktop: boolean
}

export function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent || ''
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /android/i.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|Line\/|Twitter|WhatsApp|TikTok/i.test(ua)
    || (isAndroid && /; wv\)/.test(ua)) // Android WebView
  const iosSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) && !inApp
  return { isIOS, isAndroid, isStandalone, inApp, iosSafari, isDesktop: !isIOS && !isAndroid }
}

// ¿Mostrar el asistente? Sí siempre que NO esté instalada (corriendo desde el navegador), EXCEPTO en
// escritorio: ahí no hay "instalar PWA" claro, así que forzarlo dejaba al usuario (revisor, colaborador,
// Jan en Chrome de escritorio) en un callejón sin salida. En móvil se mantiene el gate sin escape a navegador.
export function shouldShowInstallGate(): boolean {
  const p = detectPlatform()
  return !p.isStandalone && !p.isDesktop
}
