import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { desktop } from './desktop/bridge'
import { AccountProvider } from './account/AccountProvider'
import { SettingsProvider } from './settings/SettingsProvider'

// En el .exe la interfaz ocupa toda la ventana (ver .is-desktop en theme.css).
if (desktop) {
  document.documentElement.classList.add('is-desktop')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </AccountProvider>
  </StrictMode>,
)
