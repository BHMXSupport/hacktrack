// ErrorBoundary — evita la "pantalla en blanco" cuando un render lanza una excepción.
// Sin esto, cualquier throw durante el render desmonta todo el árbol (React) → blanco total.
// Aquí: captura, muestra un fallback recuperable (Reintentar / Recargar), persiste el error en
// localStorage('ht:lastError') para diagnóstico y lo enseña bajo "detalle técnico".
// resetKey: al cambiar (p.ej. cambiar de tab) limpia el error y reintenta render → la nav sigue usable.
import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode; resetKey?: unknown; scope?: string; allowReset?: boolean }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      localStorage.setItem('ht:lastError', JSON.stringify({
        scope: this.props.scope ?? '',
        msg: error.message,
        stack: (error.stack ?? '').slice(0, 1400),
        comp: (info.componentStack ?? '').slice(0, 900),
        at: Date.now(),
      }))
    } catch { /* storage no disponible */ }
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', this.props.scope ?? '', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    // Al navegar (cambia resetKey) se limpia el error: el usuario puede salir de la pantalla rota.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private hardReset = (): void => {
    if (!window.confirm('Esto borra los datos locales de la app en este dispositivo y reinicia. ¿Continuar?')) return
    try {
      localStorage.removeItem('hacktrack:v2')
      localStorage.removeItem('ht:lastError')
    } catch { /* noop */ }
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div
        role="alert"
        style={{
          position: 'absolute', inset: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: 24, paddingTop: 'max(24px, env(safe-area-inset-top))',
          textAlign: 'center', background: 'var(--bg)',
        }}
      >
        <AlertTriangle size={40} aria-hidden="true" style={{ color: 'var(--ink-400)' }} />
        <div className="h2" style={{ color: 'var(--ink-900)' }}>Algo se atoró aquí</div>
        <p className="sm" style={{ color: 'var(--ink-400)', maxWidth: 300, margin: 0 }}>
          Tu información está a salvo. Vuelve a intentar o cambia de pestaña abajo.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button className="btn btn-brand" style={{ width: 'auto', padding: '0 22px', height: 46 }}
            onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
          <button className="btn btn-outline" style={{ width: 'auto', padding: '0 22px', height: 46 }}
            onClick={() => window.location.reload()}>
            Recargar app
          </button>
        </div>
        <details style={{ marginTop: 8, maxWidth: 330, width: '100%' }}>
          <summary className="sm" style={{ color: 'var(--ink-300)', cursor: 'pointer' }}>Detalle técnico</summary>
          <pre style={{
            fontSize: 10.5, color: 'var(--ink-400)', whiteSpace: 'pre-wrap', textAlign: 'left',
            background: 'var(--ink-100)', borderRadius: 10, padding: 10, marginTop: 8, overflowX: 'auto',
          }}>
            {this.props.scope ? `[${this.props.scope}]\n` : ''}{error.message}
          </pre>
        </details>
        {this.props.allowReset && (
          <button className="btn-link" style={{ marginTop: 4, color: 'var(--ink-300)' }} onClick={this.hardReset}>
            Sigue fallando — restablecer datos
          </button>
        )}
      </div>
    )
  }
}
