// ¿Conviene autoreproducir media pesada (hero video ~MB)? Respeta Save-Data y conexiones lentas.
export function canAutoplayHeavyMedia(): boolean {
  try {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (c?.saveData) return false
    if (c?.effectiveType && /(^|\b)(slow-2g|2g)\b/.test(c.effectiveType)) return false
  } catch {
    /* sin Network Information API → asumimos OK */
  }
  return true
}
