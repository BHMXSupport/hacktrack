import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppV2 as App } from './v2/AppV2'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initInstallCapture } from './lib/install'
import './styles/globals.css'  // rebuild "Precision × Accessible" (Tailwind + tokens)

// Captura el evento beforeinstallprompt ANTES de montar React (se dispara muy temprano).
initInstallCapture()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary allowReset scope="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
