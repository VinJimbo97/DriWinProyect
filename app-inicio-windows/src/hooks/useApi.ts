import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../api/client';

export type ApiState<T> =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiRequestError };

/**
 * Hook genérico que enlaza un componente con una llamada a server-api.
 *
 * - `key`: identifica la petición. Cuando cambia (ej. otros perfiles), se
 *   vuelve a pedir. Si es `null`, no se pide nada (estado 'idle').
 * - `fetcher`: función de src/api/driwin.ts que hace la llamada.
 *
 * Devuelve el estado (idle → loading → success | error) y `reload()`.
 * Si el componente se desmonta o la key cambia antes de que llegue la
 * respuesta, la petición anterior se cancela con AbortController.
 */
export function useApi<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
): ApiState<T> & { reload: () => void } {
  const [reloadCount, setReloadCount] = useState(0);
  // Última respuesta recibida, etiquetada con la petición que la originó.
  const [result, setResult] = useState<{ requestId: string; state: ApiState<T> } | null>(null);

  // Siempre la versión más reciente del fetcher, sin que dispare nuevas peticiones.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const requestId = key === null ? null : `${key}#${reloadCount}`;

  useEffect(() => {
    if (requestId === null) {
      return;
    }

    const controller = new AbortController();

    fetcherRef.current(controller.signal)
      .then((data) => setResult({ requestId, state: { status: 'success', data, error: null } }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const apiError =
          error instanceof ApiRequestError
            ? error
            : new ApiRequestError(0, 'UNKNOWN_ERROR', 'Respuesta inesperada del servidor.');
        setResult({ requestId, state: { status: 'error', data: null, error: apiError } });
      });

    return () => controller.abort();
  }, [requestId]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // 'idle' y 'loading' se derivan: no hay respuesta para la petición actual.
  let state: ApiState<T>;
  if (requestId === null) {
    state = { status: 'idle', data: null, error: null };
  } else if (result?.requestId === requestId) {
    state = result.state;
  } else {
    state = { status: 'loading', data: null, error: null };
  }

  return { ...state, reload };
}
