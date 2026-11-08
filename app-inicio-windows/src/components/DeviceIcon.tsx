import type { ReactNode } from 'react';
import type { DeviceKind } from './deviceKind';

/**
 * Íconos de dispositivo dibujados en SVG (trazo de línea, sin dependencias).
 * Usan `currentColor`, así toman el color del texto o del CSS que los rodee.
 */

const PATHS: Record<DeviceKind, ReactNode> = {
  // Monitor (tarjeta de video / pantalla)
  gpu: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 8.5a15 15 0 0 1 20 0" />
      <path d="M5 12a10 10 0 0 1 14 0" />
      <path d="M8.5 15.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </>
  ),
  // Red cableada: tres equipos conectados
  ethernet: (
    <>
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v4M5 16v-4h14v4" />
    </>
  ),
  bluetooth: <path d="M7 7l10 10-5 5V2l5 5L7 17" />,
  // Parlante
  audio: (
    <>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </>
  ),
  usb: (
    <>
      <circle cx="12" cy="20" r="2" />
      <path d="M12 18V3M9 6l3-3 3 3" />
      <path d="M12 14l-5-3V8M12 12l5-3V6" />
      <rect x="15.5" y="4" width="3" height="2" />
      <circle cx="7" cy="7" r="1" />
    </>
  ),
  // Disco duro
  storage: (
    <>
      <rect x="2" y="13" width="20" height="8" rx="2" />
      <path d="M5.5 13L8 4h8l2.5 9" />
      <path d="M6 17h.01M10 17h.01" />
    </>
  ),
  camera: (
    <>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </>
  ),
  // Teclado / mouse
  input: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  // Chip genérico (sistema, chipset, procesador)
  chip: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
};

const LABELS: Record<DeviceKind, string> = {
  gpu: 'Video',
  wifi: 'Wi-Fi',
  ethernet: 'Red',
  bluetooth: 'Bluetooth',
  audio: 'Audio',
  usb: 'USB',
  storage: 'Almacenamiento',
  camera: 'Cámara',
  input: 'Teclado / mouse',
  chip: 'Sistema',
};

/** Ícono dentro de un recuadro, como en la lista de drivers. */
export function DeviceIcon({ kind, muted = false }: { kind: DeviceKind; muted?: boolean }) {
  return (
    <span className={`device-icon device-icon--${kind}${muted ? ' device-icon--muted' : ''}`} title={LABELS[kind]}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {PATHS[kind]}
      </svg>
    </span>
  );
}

/** Íconos pequeños para la barra superior. */
export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
    </svg>
  );
}
