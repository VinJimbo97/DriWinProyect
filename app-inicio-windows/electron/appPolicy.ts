/**
 * Lo único que DriWin acepta instalar o abrir desde la pestaña de apps. Es la
 * última barrera: aunque la API o la interfaz estén comprometidas, la app sólo
 * le pide a winget estos identificadores exactos y sólo abre estas páginas.
 *
 * Debe coincidir con db/migrations/006_apps_winget.sql. Un id nuevo en la BD
 * que no esté aquí aparece como "no disponible en esta versión".
 */
export const ALLOWED_WINGET_IDS: ReadonlySet<string> = new Set([
  // Gamer
  'Valve.Steam',
  'EpicGames.EpicGamesLauncher',
  'Discord.Discord',
  'seerge.g-helper',
  'Opera.OperaGX',
  // Creator
  'KDE.Krita',
  'BlenderFoundation.Blender',
  'Celsys.ClipStudioPaint',
  // Developer
  'Microsoft.VisualStudioCode',
  'Git.Git',
  'Docker.DockerDesktop',
  'Postman.Postman',
  'OpenJS.NodeJS.LTS',
  // Office
  'TheDocumentFoundation.LibreOffice',
  '7zip.7zip',
  'Adobe.Acrobat.Reader.64-bit',
  'VideoLAN.VLC',
  'SumatraPDF.SumatraPDF',
]);

/** Apps que no están en winget: se abre su página oficial en el navegador. */
export const ALLOWED_OFFICIAL_PAGES: ReadonlySet<string> = new Set([
  'https://static.makehumancommunity.org/makehuman.html',
  'https://www.blackmagicdesign.com/products/davinciresolve',
]);

/** Mismo patrón que chk_app_winget_id: sin espacios, comillas ni separadores de comandos. */
const WINGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+_-]{1,99}$/;

const MAX_IDS_PER_REQUEST = 40;

export function isAllowedWingetId(id: unknown): id is string {
  return typeof id === 'string' && WINGET_ID_PATTERN.test(id) && ALLOWED_WINGET_IDS.has(id);
}

export function isAllowedOfficialPage(url: unknown): url is string {
  return typeof url === 'string' && ALLOWED_OFFICIAL_PAGES.has(url);
}

/**
 * Separa lo pedido en permitido / no permitido. Devuelve null si la petición
 * ni siquiera tiene la forma esperada (no es una lista de textos).
 */
export function splitRequestedIds(requested: unknown): { allowed: string[]; rejected: string[] } | null {
  if (!Array.isArray(requested) || requested.length > MAX_IDS_PER_REQUEST) {
    return null;
  }
  if (!requested.every((id) => typeof id === 'string')) {
    return null;
  }
  const unique = [...new Set(requested as string[])];
  return {
    allowed: unique.filter(isAllowedWingetId),
    rejected: unique.filter((id) => !isAllowedWingetId(id)),
  };
}
