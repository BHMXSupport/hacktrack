import { describe, it, expect } from 'vitest'
import { selectClient, type WindowClientLike } from '../sw-clients'

// Selección de cliente en notificationclick (hallazgo SW-2): matchAll devuelve TODO el origen;
// el SW solo debe enfocar clientes del APP SHELL (dentro del scope y fuera del denylist).
const SCOPE = 'https://bhmxsupport.github.io/hacktrack/'

const win = (url: string, extra: Partial<WindowClientLike> = {}): WindowClientLike => ({ url, ...extra })

describe('selectClient — solo clientes del app shell dentro del scope', () => {
  it('sin clientes → undefined (el SW debe abrir ventana nueva)', () => {
    expect(selectClient([], SCOPE)).toBeUndefined()
  })

  it('elige la pestaña de la app aunque otra del mismo origen esté primero (más recién enfocada)', () => {
    const promo = win(SCOPE + 'promo/hero.mp4')
    const app = win(SCOPE + '?goto=registrar%3Abpc')
    expect(selectClient([promo, app], SCOPE)).toBe(app)
  })

  it('pestaña solo de /promo/ → undefined (no tiene listener de NOTIF_GOTO)', () => {
    expect(selectClient([win(SCOPE + 'promo/index.html')], SCOPE)).toBeUndefined()
  })

  it('pestaña solo de aviso-privacidad.html → undefined (fuera del app shell aunque esté en el scope)', () => {
    expect(selectClient([win(SCOPE + 'aviso-privacidad.html')], SCOPE)).toBeUndefined()
  })

  it('otro proyecto de GitHub Pages en el mismo origen (fuera del scope) → undefined', () => {
    expect(selectClient([win('https://bhmxsupport.github.io/otro-proyecto/')], SCOPE)).toBeUndefined()
  })

  it('la raíz exacta del scope cuenta como app shell', () => {
    const app = win(SCOPE)
    expect(selectClient([app], SCOPE)).toBe(app)
  })

  it('prefiere el cliente enfocado sobre el visible y sobre el primero', () => {
    const background = win(SCOPE, { visibilityState: 'hidden' })
    const visible = win(SCOPE + '?a=1', { visibilityState: 'visible' })
    const focused = win(SCOPE + '?a=2', { focused: true, visibilityState: 'visible' })
    expect(selectClient([background, visible, focused], SCOPE)).toBe(focused)
    expect(selectClient([background, visible], SCOPE)).toBe(visible)
    expect(selectClient([background], SCOPE)).toBe(background)
  })

  it('mezcla realista: privacidad enfocada + app en segundo plano → gana la app', () => {
    const privacidad = win(SCOPE + 'aviso-privacidad.html', { focused: true, visibilityState: 'visible' })
    const app = win(SCOPE, { visibilityState: 'hidden' })
    expect(selectClient([privacidad, app], SCOPE)).toBe(app)
  })

  it('URL inparseable nunca matchea', () => {
    // startsWith podría pasar con un scope vacío; el guard de new URL() lo descarta.
    expect(selectClient([win('no-es-una-url')], '')).toBeUndefined()
  })
})
