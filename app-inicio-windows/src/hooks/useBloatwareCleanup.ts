import { useCallback, useEffect, useState } from 'react';
import type { BloatwareRule } from '../api/types';
import { desktop, type BloatwareDetection, type PackageRemovalResult } from '../desktop/bridge';

export type DetectionState =
  | { status: 'unavailable' } // navegador: no se puede leer el equipo
  | { status: 'detecting' }
  | { status: 'done'; detection: BloatwareDetection }
  | { status: 'error'; message: string };

export type RuleResult =
  | { status: 'removed' }
  | { status: 'failed'; message: string };

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // Electron antepone "Error invoking remote method 'canal': Error: "
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

/** Paquetes de la regla que están instalados en este equipo. */
export function installedPackages(rule: BloatwareRule, detection: BloatwareDetection): string[] {
  return rule.package_names.filter((name) => (detection.installed[name]?.length ?? 0) > 0);
}

/** Resultado de la regla a partir del resultado de cada paquete. */
export function summarizeRule(
  packages: string[],
  results: Record<string, PackageRemovalResult>,
): RuleResult {
  const failures = packages
    .map((name) => results[name])
    .filter((result): result is PackageRemovalResult => !result || result.status === 'failed');
  if (failures.length === 0) {
    return { status: 'removed' };
  }
  const message = failures.find((failure) => failure?.message)?.message ?? 'Windows no permitió quitarla.';
  return { status: 'failed', message };
}

/**
 * Detección real (qué apps de la regla están instaladas) y limpieza.
 * Todo pasa por el proceso principal de Electron, que valida cada paquete
 * contra su lista permitida.
 */
export function useBloatwareCleanup(rules: BloatwareRule[] | null) {
  const [detection, setDetection] = useState<DetectionState>(
    desktop ? { status: 'detecting' } : { status: 'unavailable' },
  );
  const [detectCount, setDetectCount] = useState(0);
  const [results, setResults] = useState<Record<number, RuleResult>>({});
  const [running, setRunning] = useState(false);

  const packagesKey = rules ? [...new Set(rules.flatMap((rule) => rule.package_names))].sort().join('|') : null;

  useEffect(() => {
    if (!desktop || packagesKey === null) {
      return;
    }
    let cancelled = false;
    desktop
      .detectBloatware(packagesKey ? packagesKey.split('|') : [])
      .then((result) => !cancelled && setDetection({ status: 'done', detection: result }))
      .catch((error: unknown) => !cancelled && setDetection({ status: 'error', message: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [packagesKey, detectCount]);

  const redetect = useCallback(() => {
    setDetection({ status: 'detecting' });
    setDetectCount((count) => count + 1);
  }, []);

  const clean = useCallback(
    async (selected: BloatwareRule[]) => {
      if (!desktop || detection.status !== 'done' || running) {
        return;
      }
      const packagesByRule = new Map(selected.map((rule) => [rule.bloatware_id, installedPackages(rule, detection.detection)]));
      const allPackages = [...new Set([...packagesByRule.values()].flat())];

      setRunning(true);
      try {
        const removal = await desktop.removeBloatware(allPackages);
        setResults((prev) => {
          const next = { ...prev };
          for (const [ruleId, packages] of packagesByRule) {
            next[ruleId] = summarizeRule(packages, removal);
          }
          return next;
        });
      } catch (error) {
        const message = errorMessage(error);
        setResults((prev) => {
          const next = { ...prev };
          for (const rule of selected) {
            next[rule.bloatware_id] = { status: 'failed', message };
          }
          return next;
        });
      } finally {
        setRunning(false);
        redetect();
      }
    },
    [detection, running, redetect],
  );

  return { detection, results, running, clean, redetect };
}
