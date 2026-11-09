/**
 * Preferencias del usuario guardadas en este equipo (localStorage).
 * Sólo datos de interfaz: no hay datos personales aquí.
 */

export type Language = 'es' | 'en';
export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/** Funciones de DriWin Premium que el usuario puede activar o desactivar. */
export const PREMIUM_FEATURES = [
  'installAll',
  'highRiskCleanup',
  'driverBackup',
  'removeGhostDevices',
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export interface Settings {
  language: Language;
  theme: ThemePreference;
  premiumFeatures: Record<PremiumFeature, boolean>;
}

export const SETTINGS_STORAGE_KEY = 'driwin_settings';

export const LANGUAGES: Language[] = ['es', 'en'];
export const THEME_PREFERENCES: ThemePreference[] = ['system', 'dark', 'light'];

export function defaultSettings(): Settings {
  return {
    language: 'es',
    theme: 'system',
    premiumFeatures: Object.fromEntries(PREMIUM_FEATURES.map((feature) => [feature, true])) as Record<
      PremiumFeature,
      boolean
    >,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Convierte lo guardado (o cualquier valor) en preferencias válidas.
 * Un valor desconocido o dañado vuelve al predeterminado sin romper la app.
 */
export function parseSettings(raw: unknown): Settings {
  const settings = defaultSettings();
  if (!isRecord(raw)) {
    return settings;
  }
  if (LANGUAGES.includes(raw.language as Language)) {
    settings.language = raw.language as Language;
  }
  if (THEME_PREFERENCES.includes(raw.theme as ThemePreference)) {
    settings.theme = raw.theme as ThemePreference;
  }
  if (isRecord(raw.premiumFeatures)) {
    for (const feature of PREMIUM_FEATURES) {
      const value = raw.premiumFeatures[feature];
      if (typeof value === 'boolean') {
        settings.premiumFeatures[feature] = value;
      }
    }
  }
  return settings;
}

/** Tema que se pinta: "igual que Windows" sigue al sistema. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}
