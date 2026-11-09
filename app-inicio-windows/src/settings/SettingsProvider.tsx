import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createTranslator } from '../i18n/translate';
import {
  parseSettings,
  resolveTheme,
  SETTINGS_STORAGE_KEY,
  type Language,
  type PremiumFeature,
  type Settings,
  type ThemePreference,
} from './settings';
import { SettingsContext, type SettingsContextValue } from './settingsContext';

/**
 * Suscripción Premium del equipo. Todavía no existen cuentas ni compras:
 * queda en false hasta implementar la licencia firmada por el servidor.
 */
const PREMIUM_ACTIVE = false;

const DARK_QUERY = '(prefers-color-scheme: dark)';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return parseSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return parseSettings(null);
  }
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const prefersDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark);
  const resolvedTheme = resolveTheme(settings.theme, prefersDark);

  // Guardar en este equipo.
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* sin almacenamiento local las preferencias duran sólo esta sesión */
    }
  }, [settings]);

  // Aplicar al documento antes de pintar, para que no parpadee el tema anterior.
  // El CSS lee data-theme; lang ayuda a los lectores de pantalla.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.lang = settings.language;
  }, [resolvedTheme, settings.language]);

  const setLanguage = useCallback((language: Language) => setSettings((prev) => ({ ...prev, language })), []);
  const setTheme = useCallback((theme: ThemePreference) => setSettings((prev) => ({ ...prev, theme })), []);
  const setPremiumFeature = useCallback(
    (feature: PremiumFeature, enabled: boolean) =>
      setSettings((prev) => ({ ...prev, premiumFeatures: { ...prev.premiumFeatures, [feature]: enabled } })),
    [],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      resolvedTheme,
      premiumActive: PREMIUM_ACTIVE,
      t: createTranslator(settings.language),
      setLanguage,
      setTheme,
      setPremiumFeature,
      isFeatureEnabled: (feature) => PREMIUM_ACTIVE && settings.premiumFeatures[feature],
    }),
    [settings, resolvedTheme, setLanguage, setTheme, setPremiumFeature],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
