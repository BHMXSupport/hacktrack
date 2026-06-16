// Háptica diferenciada por tipo de acción — items 487 + 488.
// No-op donde navigator.vibrate no está disponible (iOS Safari, desktop).

function vib(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern) } catch { /* sin soporte */ }
}

// ── Primitivos por nivel de acción (item 487) ─────────────────────────────────
/** Chips, toggles, taps sutiles — 5 ms */
export function lightHaptic(): void  { vib(5) }

/** Registro confirmado, guardar — 12 ms */
export function mediumHaptic(): void { vib(12) }

/** Acción destructiva (borrar, forzar) — 20 ms */
export function heavyHaptic(): void  { vib(20) }

/** Celebración / logro / racha — patrón corto-corto-largo */
export function celebrateHaptic(): void { vib([10, 40, 10, 40, 80]) }

// ── Patrones semánticos de confirmación sin mirar la pantalla (item 488) ──────
/**
 * Dosis registrada: largo-corto-corto
 * Patrón reconocible para confirmar sin vista.
 */
export function doseConfirmHaptic(): void { vib([60, 80, 20, 80, 20]) }

/**
 * Medida guardada: corto-largo
 * Patrón distinto al de dosis para diferenciar tipos de registro.
 */
export function measureSavedHaptic(): void { vib([20, 60, 60]) }

/**
 * Error / acción bloqueada (p.ej. borrar sin confirmación, PIN incorrecto)
 * Doble pulso corto — item 336 (shake+haptic de error).
 */
export function errorHaptic(): void { vib([15, 50, 15]) }

// ── Alias de compatibilidad (uso previo en App + sheets) ──────────────────────
/** @deprecated Usa mediumHaptic() para nueva UI. Conservado para compatibilidad. */
export function tapHaptic(): void { mediumHaptic() }
