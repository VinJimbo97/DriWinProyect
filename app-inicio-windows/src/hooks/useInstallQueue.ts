import { useCallback, useEffect, useState } from 'react';
import { desktop, type QueueItem, type QueueRequest } from '../desktop/bridge';

export type QueuePhase = 'idle' | 'running' | 'finished';

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

/**
 * "Instalar todo": envía la cola al proceso principal (un solo permiso de
 * administrador) y sigue el avance de cada driver y app.
 */
export function useInstallQueue() {
  const [phase, setPhase] = useState<QueuePhase>('idle');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => desktop?.onQueueProgress((next) => setItems(next)), []);

  const run = useCallback(async (request: QueueRequest) => {
    if (!desktop) {
      return;
    }
    setPhase('running');
    setError(null);
    setItems([]);
    try {
      setItems(await desktop.installQueue(request));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPhase('finished');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setItems([]);
    setError(null);
  }, []);

  return { phase, items, error, run, reset, available: desktop !== undefined };
}
