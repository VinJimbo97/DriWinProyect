/** Tipos de ícono que puede tener un dispositivo en la lista de drivers. */
export type DeviceKind =
  | 'gpu'
  | 'wifi'
  | 'ethernet'
  | 'bluetooth'
  | 'audio'
  | 'usb'
  | 'storage'
  | 'camera'
  | 'input'
  | 'chip';

/**
 * Decide el ícono a partir de la categoría que entrega el escáner
 * (GPU, Network, Audio...) y, si hace falta, del nombre del dispositivo.
 * Ej: la categoría "Network" puede ser Wi-Fi o cable; el nombre lo aclara.
 */
export function deviceKind(category: string, name: string): DeviceKind {
  const cat = category.toLowerCase();
  const n = name.toLowerCase();

  if (cat === 'bluetooth' || n.includes('bluetooth')) return 'bluetooth';
  if (cat === 'gpu' || cat === 'display' || /graphics|geforce|radeon|display/.test(n)) return 'gpu';
  if (cat === 'network' || cat === 'net') {
    return /wi-?fi|wireless|wlan|802\.11/.test(n) ? 'wifi' : 'ethernet';
  }
  if (cat === 'audio' || cat === 'media' || /audio|sound|speaker|headset/.test(n)) return 'audio';
  if (cat === 'camera' || cat === 'image' || /camera|webcam/.test(n)) return 'camera';
  if (/diskdrive|scsiadapter|hdc|storage/.test(cat) || /nvme|ssd|sata|storage/.test(n)) return 'storage';
  if (/keyboard|mouse|hidclass/.test(cat) || /keyboard|mouse|touchpad/.test(n)) return 'input';
  if (cat === 'usb') return 'usb';
  return 'chip';
}
