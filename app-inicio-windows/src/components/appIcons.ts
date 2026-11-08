import {
  si7zip,
  siBlender,
  siDavinciresolve,
  siDiscord,
  siDocker,
  siEpicgames,
  siGit,
  siKrita,
  siLibreoffice,
  siNodedotjs,
  siOperagx,
  siPostman,
  siSteam,
  siVlcmediaplayer,
} from 'simple-icons';

/**
 * Logo de cada app del catálogo (`recommended_apps.app_name`).
 * Los logos vienen de Simple Icons (licencia CC0, se empaquetan con la app:
 * no se descarga nada en tiempo de ejecución). Las marcas que no están en
 * Simple Icons usan sus iniciales sobre el color de la marca.
 */
export type AppIconSpec =
  | { type: 'logo'; path: string; color: string }
  | { type: 'initials'; text: string; color: string };

const logo = (icon: { path: string; hex: string }): AppIconSpec => ({ type: 'logo', path: icon.path, color: `#${icon.hex}` });
const initials = (text: string, color: string): AppIconSpec => ({ type: 'initials', text, color });

const APP_ICONS: Record<string, AppIconSpec> = {
  'steam': logo(siSteam),
  'epic games launcher': logo(siEpicgames),
  'discord': logo(siDiscord),
  'opera gx': logo(siOperagx),
  'krita': logo(siKrita),
  'blender': logo(siBlender),
  'davinci resolve': logo(siDavinciresolve),
  'git for windows': logo(siGit),
  'docker desktop': logo(siDocker),
  'postman': logo(siPostman),
  'node.js lts': logo(siNodedotjs),
  'libreoffice': logo(siLibreoffice),
  '7-zip': logo(si7zip),
  'vlc media player': logo(siVlcmediaplayer),
  // Sin logo en Simple Icons (algunas marcas pidieron retirarlo)
  'visual studio code': initials('VS', '#007ACC'),
  'adobe acrobat reader': initials('A', '#EC1C24'),
  'clip studio paint': initials('CS', '#2E3B4E'),
  'makehuman': initials('MH', '#4A7C59'),
  'sumatrapdf': initials('S', '#FFD400'),
  'g-helper': initials('G', '#4B4B4B'),
};

/** Colores para apps nuevas que aún no tienen ícono asignado. */
const FALLBACK_COLORS = ['#00ADB5', '#5865F2', '#E87D0D', '#18A303', '#EE2950', '#2496ED'];

function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('') || '?';
}

export function appIcon(appName: string): AppIconSpec {
  const known = APP_ICONS[appName.trim().toLowerCase()];
  if (known) {
    return known;
  }
  // Mismo nombre → mismo color, para que no cambie entre aperturas.
  let hash = 0;
  for (const char of appName) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return initials(initialsOf(appName), FALLBACK_COLORS[hash % FALLBACK_COLORS.length]);
}

/** Texto/logo blanco sobre colores oscuros y negro sobre colores claros. */
export function foregroundFor(hexColor: string): string {
  const value = parseInt(hexColor.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1b1f24' : '#ffffff';
}
