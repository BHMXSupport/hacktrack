import { useApp } from '../lib/store'
import { BiohackmxFlask } from './BiohackmxFlask'

// Botón de conexión con BiohackMX — opción principal de auth (crear cuenta / iniciar sesión).
// OAuth mediado: el usuario inicia sesión en el sitio de BiohackMX; Hacktrack nunca ve la contraseña.
export function BiohackmxConnect() {
  const { dispatch } = useApp()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        className="btn btn-brand"
        style={{ height: 52, borderRadius: 16, fontSize: 16, gap: 10 }}
        onClick={() => dispatch({ t: 'go', screen: 's-import' })}
      >
        <BiohackmxFlask size={20} style={{ filter: 'brightness(0) invert(1)' }} />
        Continuar con BiohackMX
      </button>
      <p className="sm" style={{ textAlign: 'center', color: 'var(--ink-400)', margin: 0, fontSize: 12 }}>
        Inicias sesión en su sitio; nunca vemos tu contraseña.
      </p>
    </div>
  )
}
