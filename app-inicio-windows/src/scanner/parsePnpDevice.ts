import type { DetectedDevice, RawPnpDevice } from './types';

/** Clase de dispositivo de Windows → categoría de hardware_components. */
const CATEGORY_BY_CLASS: Record<string, string> = {
  display: 'GPU',
  net: 'Network',
  media: 'Audio',
  usb: 'USB',
  bluetooth: 'Bluetooth',
};

/**
 * Extrae fabricante (VEN) y modelo (DEV) del Instance ID de Windows.
 *   PCI:     PCI\VEN_10DE&DEV_2504&...          → 10DE / 2504
 *   HDAUDIO: HDAUDIO\FUNC_01&VEN_10EC&DEV_0256  → 10EC / 0256
 *   USB:     USB\VID_046D&PID_C52B\...          → 046D / C52B
 * Devuelve null para dispositivos virtuales (ROOT\...) que no tienen firma.
 */
export function parsePnpDevice(raw: RawPnpDevice): DetectedDevice | null {
  const id = raw.instance_id.toUpperCase();
  const match =
    /VEN_([0-9A-F]{4}).*?DEV_([0-9A-F]{4})/.exec(id) ??
    /VID_([0-9A-F]{4}).*?PID_([0-9A-F]{4})/.exec(id);

  if (!match) {
    return null;
  }

  return {
    instance_id: raw.instance_id,
    name: raw.friendly_name,
    category: CATEGORY_BY_CLASS[raw.device_class.toLowerCase()] ?? raw.device_class,
    ven_id: match[1],
    dev_id: match[2],
    current_version: raw.driver_version,
  };
}
