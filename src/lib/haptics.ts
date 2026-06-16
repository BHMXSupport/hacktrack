// Háptica sutil para confirmar gestos (registrar dosis, deshacer). No-op donde no hay soporte.
export function tapHaptic(): void {
  try {
    navigator.vibrate?.(10)
  } catch {
    /* sin soporte de vibración */
  }
}
