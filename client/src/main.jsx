import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Installable app + background notifications (production only, so dev reloads stay simple)
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
