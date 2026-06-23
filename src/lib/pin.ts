// PIN local de bloqueo. SHA-256 hex con prefijo fijo. NO es cifrado: los datos en localStorage siguen en
// claro y un PIN de 4 dígitos es fuerza-bruteable (10k combos) — es un bloqueo CASUAL de privacidad (que un
// tercero no abra la app de un vistazo), no seguridad criptográfica. Se documenta así en la UI.
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`hacktrack-pin-v1:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
