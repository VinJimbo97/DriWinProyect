import { createContext, useContext } from 'react';
import type { Translate } from '../i18n/translate';
import type { Language, PremiumFeature, ResolvedTheme, Settings, ThemePreference } from './settings';

export interface SettingsContextValue {
  settings: Settings;
  /** Tema que se está pintando (resuelve "igual que Windows"). */
  resolvedTheme: ResolvedTheme;
  /** true cuando el equipo tiene una suscripción Premium activa. */
  premiumActive: boolean;
  t: Translate;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  setPremiumFeature: (feature: PremiumFeature, enabled: boolean) => void;
  /** Si una función Premium se puede usar ahora: suscripción activa y activada por el usuario. */
  isFeatureEnabled: (feature: PremiumFeature) => boolean;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error('useSettings debe usarse dentro de <SettingsProvider>.');
  }
  return value;
}
