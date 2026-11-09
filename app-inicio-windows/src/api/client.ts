import type { ApiErrorBody } from './types';

/**
 * Cliente HTTP único del Front-End: es el ÚNICO archivo que llama a fetch().
 * Los componentes nunca hablan con la red directamente; usan los hooks de
 * src/hooks, que a su vez usan las funciones de src/api/driwin.ts.
 *
 *   Componente → hook → driwin.ts → client.ts → fetch → server-api
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const API_PATH = '/api/v1';

/*
 * Sin claves: todo lo que se incluye en la app (Vite copia las VITE_* dentro
 * del JavaScript) lo puede leer cualquiera. Las consultas al catálogo son
 * públicas y la API las protege con límite de peticiones y validación.
 */

/** Error de la API con el código y mensaje que envía server-api. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, undefined, signal);
}

export function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>('POST', path, body, signal);
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${API_PATH}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw error;
    }
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'No se pudo conectar con el servidor de DriWin. Revisa tu conexión a internet (en desarrollo: que server-api esté corriendo).',
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiRequestError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.requestId,
      );
    }
    throw new ApiRequestError(response.status, 'UNKNOWN_ERROR', `Error HTTP ${response.status}`);
  }

  return payload as T;
}
