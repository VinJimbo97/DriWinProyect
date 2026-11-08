/**
 * Lo único que DriWin acepta eliminar. Es la última barrera: aunque la API o la
 * interfaz estén comprometidas, la app sólo quita apps de la Microsoft Store de
 * esta lista, sólo para el usuario actual (sin permisos de administrador) y
 * nunca ejecuta comandos que vengan de afuera.
 *
 * Debe coincidir con `package_names` de db/migrations/004_bloatware_por_perfil.sql.
 * Una regla nueva en la BD con paquetes que no estén aquí aparece como
 * "no disponible en esta versión" hasta que se publique una app que los incluya.
 *
 * Fuera a propósito (riesgo ALTO): la Tienda, Edge, WebView2, Defender,
 * Windows Update, Xbox Identity Provider / TCUI (inicio de sesión de juegos).
 */
export const ALLOWED_PACKAGES: ReadonlySet<string> = new Set([
  // Riesgo BAJO
  'Microsoft.BingNews',
  'Microsoft.BingWeather',
  'Microsoft.MicrosoftSolitaireCollection',
  'king.com.*',
  'Microsoft.GetHelp',
  'Microsoft.Getstarted',
  'Microsoft.WindowsFeedbackHub',
  'Microsoft.WindowsMaps',
  'Microsoft.ZuneVideo',
  'Microsoft.People',
  'Microsoft.SkypeApp',
  'Microsoft.Microsoft3DViewer',
  'Microsoft.MixedReality.Portal',
  'Clipchamp.Clipchamp',
  'Microsoft.Windows.DevHome',
  // Riesgo MEDIO
  'Microsoft.XboxGamingOverlay',
  'Microsoft.GamingApp',
  'Microsoft.XboxApp',
  'Microsoft.Copilot',
  'MicrosoftTeams',
  'MSTeams',
  'Microsoft.OutlookForWindows',
  'Microsoft.Todos',
  'Microsoft.MicrosoftOfficeHub',
  'Microsoft.YourPhone',
  'Microsoft.PowerAutomateDesktop',
  'MicrosoftCorporationII.QuickAssist',
  'Microsoft.ZuneMusic',
]);

/** Mismo patrón que ck_bloatware_package_names: sin comillas, espacios ni ;. */
const PACKAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._*-]{1,99}$/;

const MAX_PACKAGES_PER_REQUEST = 60;

export function isAllowedPackage(name: unknown): name is string {
  return typeof name === 'string' && PACKAGE_PATTERN.test(name) && ALLOWED_PACKAGES.has(name);
}

/**
 * Separa lo pedido en permitido / no permitido. Devuelve null si la petición
 * ni siquiera tiene la forma esperada (no es una lista de textos).
 */
export function splitRequestedPackages(
  requested: unknown,
): { allowed: string[]; rejected: string[] } | null {
  if (!Array.isArray(requested) || requested.length > MAX_PACKAGES_PER_REQUEST) {
    return null;
  }
  if (!requested.every((name) => typeof name === 'string')) {
    return null;
  }
  const unique = [...new Set(requested as string[])];
  return {
    allowed: unique.filter(isAllowedPackage),
    rejected: unique.filter((name) => !isAllowedPackage(name)),
  };
}
