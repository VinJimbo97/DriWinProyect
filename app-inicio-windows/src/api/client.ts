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
  /** Detalle campo a campo de los errores de validación (400). */
  readonly details?: { field: string; issue: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: { field: string; issue: string }[],
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, undefined, { signal });
}

export function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>('POST', path, body, { signal });
}

/**
 * Petición con la sesión de la cuenta DriWin (Authorization: Bearer dws_...).
 * El token lo entrega el servidor al iniciar sesión; no es una clave de la app.
 */
export function apiWithSession<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  return request<T>(method, path, body, { token });
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body: unknown,
  options: { signal?: AbortSignal; token?: string } = {},
): Promise<T> {
  const { signal, token } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
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

  // 204 = éxito sin contenido (cerrar sesión, borrar cuenta).
  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiRequestError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.requestId,
        payload.error.details,
      );
    }
    throw new ApiRequestError(response.status, 'UNKNOWN_ERROR', `Error HTTP ${response.status}`);
  }

  return payload as T;
}
