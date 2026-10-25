import type { HardwareFixture } from './types';

/**
 * Hardware Mock Fixtures: equipos simulados con el MISMO formato que entrega
 * Windows (Get-PnpDevice). Las firmas VEN/DEV coinciden con la semilla de
 * db/init.sql (hardware_components 1..4) para que la API encuentre drivers.
 *
 * Cada equipo cubre un escenario distinto de POST /recommendations/driver:
 *   - 200: hardware catalogado con driver para el perfil
 *   - 404: hardware que no está en el catálogo (Logitech, Intel)
 *   - 422: hardware catalogado, pero sin driver para ese perfil o ese Windows
 */
export const HARDWARE_FIXTURES: HardwareFixture[] = [
  {
    id: 'laptop-gamer',
    label: 'Laptop Gamer (Windows 11)',
    description: 'AMD Vega + NVIDIA RTX 3060, Wi-Fi MediaTek y audio Realtek. Todo catalogado.',
    os_environment: 'Win11_x64',
    devices: [
      {
        instance_id: 'PCI\\VEN_10DE&DEV_2504&SUBSYS_88C61043&REV_A1\\4&1A2B3C4D&0&0008',
        friendly_name: 'NVIDIA GeForce RTX 3060 Laptop GPU',
        device_class: 'Display',
        driver_version: '512.15',
      },
      {
        instance_id: 'PCI\\VEN_1002&DEV_1638&SUBSYS_88C61043&REV_C5\\4&2B3C4D5E&0&0041',
        friendly_name: 'AMD Radeon(TM) Graphics',
        device_class: 'Display',
        driver_version: '23.11.1',
      },
      {
        instance_id: 'PCI\\VEN_14C3&DEV_7961&SUBSYS_4C501A3B&REV_00\\4&3C4D5E6F&0&00E2',
        friendly_name: 'MediaTek Wi-Fi 6 MT7921 Wireless LAN Card',
        device_class: 'Net',
        driver_version: '3.0.1.1100',
      },
      {
        instance_id: 'HDAUDIO\\FUNC_01&VEN_10EC&DEV_0256&SUBSYS_104312A0&REV_1000\\4&4D5E6F70&0&0001',
        friendly_name: 'Realtek High Definition Audio',
        device_class: 'MEDIA',
        driver_version: '6.0.9239.1',
      },
      {
        // No catalogado en DriWin → la API responde 404.
        instance_id: 'USB\\VID_046D&PID_C52B\\5&1F2E3D4C&0&2',
        friendly_name: 'Logitech USB Unifying Receiver',
        device_class: 'USB',
        driver_version: '1.10.0.0',
      },
      {
        // Dispositivo virtual sin firma VEN/DEV → el parser lo descarta.
        instance_id: 'ROOT\\BASICDISPLAY\\0000',
        friendly_name: 'Microsoft Basic Display Driver',
        device_class: 'System',
        driver_version: '10.0.22621.1',
      },
    ],
  },
  {
    id: 'pc-oficina',
    label: 'PC de Oficina (Windows 11)',
    description: 'AMD Vega integrada, audio Realtek y red Intel. Ideal para el perfil Oficinista.',
    os_environment: 'Win11_x64',
    devices: [
      {
        instance_id: 'PCI\\VEN_1002&DEV_1638&SUBSYS_D0001458&REV_C8\\4&5E6F7081&0&0041',
        friendly_name: 'AMD Radeon(TM) Vega 8 Graphics',
        device_class: 'Display',
        driver_version: '22.20.1',
      },
      {
        // Catalogado, pero sólo tiene driver para Developer → 422 en otros perfiles.
        instance_id: 'HDAUDIO\\FUNC_01&VEN_10EC&DEV_0256&SUBSYS_1458A0C3&REV_1000\\4&6F708192&0&0001',
        friendly_name: 'Realtek High Definition Audio',
        device_class: 'MEDIA',
        driver_version: '6.0.9239.1',
      },
      {
        // No catalogado en DriWin → la API responde 404.
        instance_id: 'PCI\\VEN_8086&DEV_15BC&SUBSYS_E0001458&REV_10\\3&11583659&0&FE',
        friendly_name: 'Intel(R) Ethernet Connection (7) I219-V',
        device_class: 'Net',
        driver_version: '12.19.2.45',
      },
    ],
  },
  {
    id: 'pc-win10',
    label: 'PC Antiguo (Windows 10)',
    description: 'Hardware catalogado, pero el catálogo sólo publica drivers para Windows 11 → 422.',
    os_environment: 'Win10_x64',
    devices: [
      {
        instance_id: 'PCI\\VEN_10DE&DEV_2504&SUBSYS_39761462&REV_A1\\4&7081A2B3&0&0008',
        friendly_name: 'NVIDIA GeForce RTX 3060',
        device_class: 'Display',
        driver_version: '472.12',
      },
      {
        instance_id: 'PCI\\VEN_14C3&DEV_7961&SUBSYS_4C501A3B&REV_00\\4&81A2B3C4&0&00E2',
        friendly_name: 'MediaTek Wi-Fi 6 MT7921 Wireless LAN Card',
        device_class: 'Net',
        driver_version: '2.5.0.900',
      },
    ],
  },
];

export const DEFAULT_FIXTURE_ID = HARDWARE_FIXTURES[0].id;
