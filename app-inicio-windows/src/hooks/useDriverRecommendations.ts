import { ApiRequestError } from '../api/client';
import { postDriverRecommendation } from '../api/driwin';
import type { DriverRecommendation, ProfileName } from '../api/types';
import type { DetectedDevice, ScanResult } from '../scanner/types';
import { useApi } from './useApi';

export type DeviceRecommendation =
  | { device: DetectedDevice; ok: true; recommendation: DriverRecommendation }
  | { device: DetectedDevice; ok: false; error: ApiRequestError };

/**
 * 404 (hardware no catalogado) y 422 (sin driver para el perfil / Windows) son
 * respuestas esperadas para UN dispositivo: se muestran en su fila. Cualquier
 * otro error (red caída, clave inválida, 500) afecta a todos y se propaga.
 */
const PER_DEVICE_STATUSES = [404, 422];

/**
 * Pide en paralelo el mejor driver para cada dispositivo escaneado.
 * No hace nada hasta que existan el escaneo y al menos un perfil.
 */
export function useDriverRecommendations(scan: ScanResult | null, profiles: ProfileName[]) {
  const key =
    scan && profiles.length > 0
      ? `drivers:${scan.os_environment}:${[...profiles].sort().join(',')}:${scan.devices.map((d) => d.instance_id).join('|')}`
      : null;

  return useApi(key, (signal) => {
    if (!scan) {
      return Promise.resolve([]);
    }
    return Promise.all(
      scan.devices.map(async (device): Promise<DeviceRecommendation> => {
        try {
          const response = await postDriverRecommendation(
            {
              ven_id: device.ven_id,
              dev_id: device.dev_id,
              os_environment: scan.os_environment,
              profiles,
            },
            signal,
          );
          return { device, ok: true, recommendation: response.data };
        } catch (error) {
          if (error instanceof ApiRequestError && PER_DEVICE_STATUSES.includes(error.status)) {
            return { device, ok: false, error };
          }
          throw error;
        }
      }),
    );
  });
}
