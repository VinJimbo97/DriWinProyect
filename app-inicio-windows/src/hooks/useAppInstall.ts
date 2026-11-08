import { useCallback, useEffect, useState } from 'react';
import type { RecommendedApp } from '../api/types';
import { desktop } from '../desktop/bridge';

export type AppInstallState =
  | { stage: 'installing' }
  | { stage: 'done'; rebootRequired: boolean }
  | { stage: 'error'; message: string };

/**
 * Estado de la pestaña de apps: qué apps ya están instaladas (según winget),
 * cuáles no permite esta versión y el avance de cada instalación.
 * La instalación la ejecuta el proceso principal de Electron.
 */
export function useAppInstall(apps: RecommendedApp[] | undefined) {
  const [installed, setInstalled] = useState<Record<string, boolean | null>>({});
  const [unsupported, setUnsupported] = useState<Set<string>>(new Set());
  /** Lista de ids ya revisada; mientras no coincida con la actual, se está revisando. */
  const [detectedKey, setDetectedKey] = useState('');
  const [states, setStates] = useState<Record<string, AppInstallState>>({});
  const [busy, setBusy] = useState(false);

  const idsKey = (apps ?? [])
    .map((app) => app.winget_id)
    .filter((id): id is string => id !== null)
    .sort()
    .join(',');

  useEffect(() => {
    const bridge = desktop;
    if (!bridge || idsKey === '') {
      return;
    }
    let cancelled = false;
    bridge
      .detectApps(idsKey.split(','))
      .then((result) => {
        if (!cancelled) {
          setInstalled(result.installed);
          setUnsupported(new Set(result.unsupported));
        }
      })
      .catch(() => {
        // Sin detección la app sigue funcionando: sólo no sabe cuáles ya están.
        if (!cancelled) {
          setInstalled({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetectedKey(idsKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const detecting = desktop !== undefined && idsKey !== '' && detectedKey !== idsKey;

  const install = useCallback(async (wingetId: string) => {
    if (!desktop) {
      return;
    }
    setBusy(true);
    setStates((prev) => ({ ...prev, [wingetId]: { stage: 'installing' } }));

    let next: AppInstallState;
    try {
      const result = await desktop.installApp(wingetId);
      if (result.ok) {
        next = { stage: 'done', rebootRequired: result.rebootRequired };
        setInstalled((prev) => ({ ...prev, [wingetId]: true }));
      } else {
        next = { stage: 'error', message: result.message };
      }
    } catch {
      next = { stage: 'error', message: 'No se pudo completar la instalación. Inténtalo de nuevo.' };
    }

    setStates((prev) => ({ ...prev, [wingetId]: next }));
    setBusy(false);
  }, []);

  const openOfficialPage = useCallback((url: string) => {
    void desktop?.openOfficialPage(url).catch(() => {
      /* la lista permitida rechazó la página: no se abre nada */
    });
  }, []);

  return { installed, unsupported, detecting, states, busy, install, openOfficialPage, available: desktop !== undefined };
}
