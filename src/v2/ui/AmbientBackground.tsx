// Fondo ambiental "Bitácora" — glow cálido casi invisible detrás de la UI, SOLO en Tinta
// (en Papel la ref canónica es papel plano: [data-theme="light"] .ambient-bg lo oculta).
// Se eliminó el video/poster teal del rebuild (gate de marca: cero teal). Queda la capa CSS
// .ambient-drift (ámbar = energía + azul = datos) — GPU-only (transform/opacity); bajo
// prefers-reduced-motion el keyframe se apaga en globals.css y queda un glow estático tenue.
export function AmbientBackground() {
  return (
    <div aria-hidden className="ambient-bg pointer-events-none absolute inset-0 overflow-hidden">
      <div className="ambient-drift absolute inset-0" />
    </div>
  )
}
