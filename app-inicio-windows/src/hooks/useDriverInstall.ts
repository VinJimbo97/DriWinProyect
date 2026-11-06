import { useCallback, useEffect, useState } from 'react';
import type { DriverRecommendation } from '../api/types';
import { desktop } from '../desktop/bridge';

export type DriverInstallState =
  | { stage: 'downloading'; percent: number | null }
  | { stage: 'verifying' | 'installing' }
  | { stage: 'done'; rebootRequired: boolean }
  | { stage: 'error'; message: string };

/** Estado de la instalación real de cada driver (la ejecuta el proceso principal de Electron). */
export function useDriverInstall() {
  const [states, setStates] = useState<Record<number, DriverInstallState>>({});
  const [activeDriverId, setActiveDriverId] = useState<number | null>(null);

  useEffect(() => {
    return desktop?.onDriverInstallProgress(({ driverId, stage, percent }) => {
      setStates((prev) => ({
        ...prev,
        [driverId]: stage === 'downloading' ? { stage, percent } : { stage },
      }));
    });
  }, []);

  const install = useCallback(async (recommendation: DriverRecommendation['recommendation']) => {
    if (!desktop) {
      return;
    }
    const driverId = recommendation.driver_id;
    setActiveDriverId(driverId);
    setStates((prev) => ({ ...prev, [driverId]: { stage: 'downloading', percent: 0 } }));

    let next: DriverInstallState;
    try {
      const result = await desktop.installDriver({
        driverId,
        downloadUrl: recommendation.download_url,
        sha256: recommendation.sha256,
      });
      next = result.ok
        ? { stage: 'done', rebootRequired: result.rebootRequired }
        : { stage: 'error', message: result.message };
    } catch {
      next = { stage: 'error', message: 'No se pudo completar la instalación. Inténtalo de nuevo.' };
    }

    setStates((prev) => ({ ...prev, [driverId]: next }));
    setActiveDriverId(null);
  }, []);

  return { states, install, busy: activeDriverId !== null };
}
