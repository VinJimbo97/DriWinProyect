import { env } from '../config/env.js';
import { ApiError, ErrorCode } from '../domain/errors.js';
import type { OffloadingDescriptor } from '../domain/driver.types.js';

const BLOB_ENDPOINT = env.AZURE_BLOB_ENDPOINT.replace(/\/+$/, '');
const BLOB_HOST = new URL(BLOB_ENDPOINT).host;
const ALLOWED_PROTOCOLS = new Set(['https:']);

export type BlobContainer = 'drivers' | 'apps';

function containerName(container: BlobContainer): string {
  return container === 'drivers' ? env.AZURE_CONTAINER_DRIVERS : env.AZURE_CONTAINER_APPS;
}

function appendSasToken(url: URL): string {
  if (env.AZURE_SAS_TOKEN && !url.search) {
    url.search = env.AZURE_SAS_TOKEN.replace(/^\?/, '');
  }
  return url.toString();
}

function invalidUrl(issue: string): ApiError {
  return new ApiError(
    400,
    ErrorCode.VALIDATION_ERROR,
    'La URL de descarga no apunta al almacenamiento permitido.',
    [{ field: 'download_url', issue }],
    `Use el endpoint ${BLOB_ENDPOINT} o una ruta relativa al contenedor.`,
  );
}

/**
 * Normaliza la URL de descarga hacia Azure Blob Storage (patrón offloading).
 *
 * Acepta:
 *  1. URL absoluta https del host configurado y del contenedor correcto.
 *  2. Ruta relativa al contenedor (ej: "amd-adrenalin-24.9.1-win11-64bit.exe").
 *
 * Rechaza http://, otros hosts, otros contenedores, `javascript:` y `..`.
 * La API nunca descarga ni retransmite el binario: sólo publica su URL.
 */
export function resolveBlobDownloadUrl(input: string, container: BlobContainer): string {
  const raw = input.trim();
  const expectedContainer = containerName(container);

  if (!raw) {
    throw invalidUrl('La ruta o URL está vacía.');
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw invalidUrl('No es una URL válida.');
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      throw invalidUrl('Sólo se admite https (la tríada segura IP + puerto + protocolo).');
    }

    if (url.host !== BLOB_HOST) {
      throw invalidUrl(`El host debe ser ${BLOB_HOST}.`);
    }

    const expectedPrefix = `/${expectedContainer}/`;
    if (!url.pathname.startsWith(expectedPrefix)) {
      throw invalidUrl(`La ruta debe comenzar con ${expectedPrefix}.`);
    }

    return appendSasToken(url);
  }

  const objectPath = raw.replace(/^\/+/, '');
  if (!objectPath || objectPath.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw invalidUrl('La ruta relativa no es válida.');
  }

  const encodedPath = objectPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  const url = new URL(`${BLOB_ENDPOINT}/${expectedContainer}/${encodedPath}`);
  return appendSasToken(url);
}

/**
 * Metadatos de offloading para las respuestas de recomendación.
 * El binario viaja directo del cliente a Azure Blob Storage: la API sólo
 * publica la URL y el tamaño estimado (nunca retransmite el archivo).
 */
export function describeOffloading(
  fileSizeMb: number,
  container: BlobContainer = 'drivers',
): OffloadingDescriptor {
  return {
    strategy: 'DIRECT_AZURE_BLOB',
    container,
    estimated_bytes: Math.max(0, Math.round(fileSizeMb)) * 1024 * 1024,
    binary_traverses_api: false,
  };
}
