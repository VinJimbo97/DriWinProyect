import type { OsEnvironment } from '../api/types';

/**
 * Dispositivo tal como lo reporta Windows (Get-PnpDevice / Administrador de
 * dispositivos). Es el formato "crudo" que entregará el escáner real del .exe.
 */
export interface RawPnpDevice {
  /** Ej: PCI\VEN_10DE&DEV_2504&SUBSYS_88C61043&REV_A1\4&1A2B3C4D&0&0008 */
  instance_id: string;
  friendly_name: string;
  /** Clase de Windows: Display, Net, MEDIA, USB, System... */
  device_class: string;
  driver_version: string;
}

/** Dispositivo ya interpretado: lo que la app necesita para pedir drivers. */
export interface DetectedDevice {
  instance_id: string;
  name: string;
  category: string;
  ven_id: string;
  dev_id: string;
  current_version: string;
}

export interface ScanResult {
  os_environment: OsEnvironment;
  devices: DetectedDevice[];
}

/** Un "PC de mentira" para probar la app sin leer hardware real. */
export interface HardwareFixture {
  id: string;
  label: string;
  description: string;
  os_environment: OsEnvironment;
  devices: RawPnpDevice[];
}
