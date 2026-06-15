# Hacktrack

App/PWA de seguimiento de protocolos de péptidos. **React + Vite + TypeScript + Motion (UI) + Remotion (hero/video).**
Identidad "Quiet Signal" (verde kelp `#0E5A52`, light-first). es-MX.

> El prototipo HTML navegable original vive en el vault: `businesses/Hacktrack/prototype/hacktrack-prototype.html`.
> Este proyecto es el front-end real donde se integran (a) la salida de **Google Stitch**, (b) **Motion** y (c) **Remotion**.

## Correr

```bash
cd ~/hacktrack
npm install        # ya ejecutado en el scaffold
npm run dev        # app en http://localhost:5173
npm run remotion   # Remotion Studio (editar/renderizar el hero/video)
npm run build      # build de producción
```

## Estructura

- `src/tokens.css` — design tokens Quiet Signal (paleta, tipografía, componentes base).
- `src/App.tsx` — shell + transiciones de pantalla con **Motion** (`AnimatePresence`).
- `src/screens/` — pantallas (Splash, Onboarding, Home…). **Aquí se pegan las pantallas generadas en Google Stitch** (exportar a React → componente por pantalla → reemplazar/añadir aquí, usando los tokens).
- `src/remotion/Hero.tsx` — composición **Remotion** (hero "señal" animado); embebida en Onboarding vía `@remotion/player`, y renderizable a video (preview de tienda / marketing) con `npm run remotion`.
- `src/remotion/Root.tsx` — registro de composiciones para Remotion Studio / render.

## Cómo entra cada herramienta

| Herramienta | Rol | Dónde |
|---|---|---|
| **Google Stitch** | Generar/refinar las pantallas (UI) | exportas a React → `src/screens/` |
| **Motion** (framer-motion) | Animación interactiva de la UI (transiciones, gestos, micro-interacciones) | `src/App.tsx`, screens |
| **Remotion** | Video/motion-graphics (hero animado, explainer, preview de tienda) | `src/remotion/` |

## Pendiente (port del prototipo)

Portar el resto de pantallas del prototipo (diario, protocolo con cadencias, registrar dosis + calculadora, ajustes, PIN, quickstart) a `src/screens/` — idealmente generándolas en Stitch y cableando la lógica del prototipo. Integrar también los fixes del audit multiagente.
