import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initInstallCapture } from './lib/install'
import './tokens.css'

// Captura el evento beforeinstallprompt ANTES de montar React (se dispara muy temprano).
initInstallCapture()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary allowReset scope="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
