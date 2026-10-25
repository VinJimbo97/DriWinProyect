import { describe, expect, it } from 'vitest';
import {
  createHardwareSchema,
  deleteHardwareQuerySchema,
  listHardwareQuerySchema,
  updateHardwareSchema,
} from '../src/schemas/hardware.schema';
import {
  createDriverSchema,
  listDriverQuerySchema,
  updateDriverSchema,
} from '../src/schemas/driver.schema';
import { isoDateSchema } from '../src/schemas/common.schema';
import { normalizePciId } from '../src/services/hardware.service';
import { describeOffloading, resolveBlobDownloadUrl } from '../src/services/blobUrl.service';
import { ApiError } from '../src/domain/errors';

describe('blobUrl.service (offloading)', () => {
  it('construye la URL del contenedor drivers desde una ruta relativa', () => {
    expect(resolveBlobDownloadUrl('amd-adrenalin-24.9.1-win11-64bit.exe', 'drivers')).toBe(
      'https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe',
    );
  });

  it('acepta una URL https del host y contenedor configurados', () => {
    const url =
      'https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe';
    expect(resolveBlobDownloadUrl(url, 'drivers')).toBe(url);
  });

  it('acepta sin alterar las URLs reales con espacios codificados y paréntesis', () => {
    const urls = [
      'https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v555.85%20(DCH).exe',
      'https://driwinstorage.blob.core.windows.net/drivers/DriverProcesadorGen11%20a%2014%20Graphics.exe',
    ];
    for (const url of urls) {
      expect(resolveBlobDownloadUrl(url, 'drivers')).toBe(url);
    }
  });

  it('rechaza http:// (tríada segura incompleta)', () => {
    expect(() =>
      resolveBlobDownloadUrl('http://driwinstorage.blob.core.windows.net/drivers/a.exe', 'drivers'),
    ).toThrow(ApiError);
  });

  it('rechaza hosts ajenos y contenedores incorrectos', () => {
    expect(() => resolveBlobDownloadUrl('https://evil.example.com/drivers/a.exe', 'drivers')).toThrow(
      ApiError,
    );
    expect(() =>
      resolveBlobDownloadUrl('https://driwinstorage.blob.core.windows.net/apps/a.exe', 'drivers'),
    ).toThrow(ApiError);
  });

  it('describe el offloading sin transferir el binario por la API', () => {
    expect(describeOffloading(540)).toEqual({
      strategy: 'DIRECT_AZURE_BLOB',
      container: 'drivers',
      estimated_bytes: 540 * 1024 * 1024,
      binary_traverses_api: false,
    });
  });
});

describe('normalización de firma PCI', () => {
  it('normaliza prefijos 0x/VEN_/DEV_ a mayúsculas', () => {
    expect(normalizePciId('0x1002', 'ven_id')).toBe('1002');
    expect(normalizePciId('VEN_10de', 'ven_id')).toBe('10DE');
    expect(normalizePciId('DEV_0256', 'dev_id')).toBe('0256');
  });

  it('rechaza firmas inválidas con error 400 descriptivo', () => {
    expect(() => normalizePciId('AMD', 'ven_id')).toThrow(ApiError);
  });
});

describe('esquemas Zod del contrato', () => {
  it('aplica paginación por defecto y acepta filtros PCI', () => {
    const parsed = listHardwareQuerySchema.parse({ ven_id: '0x1002' });
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.order).toBe('asc');
    expect(parsed.ven_id).toBe('0x1002');
  });

  it('rechaza un POST de hardware sin nombre comercial', () => {
    const result = createHardwareSchema.safeParse({
      ven_id: '1002',
      dev_id: '1638',
      category: 'GPU',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza un PUT de hardware vacío', () => {
    expect(updateHardwareSchema.safeParse({}).success).toBe(false);
  });

  it('interpreta cascade sólo como booleano explícito', () => {
    expect(deleteHardwareQuerySchema.parse({}).cascade).toBe(false);
    expect(deleteHardwareQuerySchema.parse({ cascade: 'true' }).cascade).toBe(true);
    expect(deleteHardwareQuerySchema.safeParse({ cascade: '1' }).success).toBe(false);
  });

  it('valida fechas reales del calendario (rechaza 2026-02-30)', () => {
    expect(isoDateSchema.safeParse('2026-09-15').success).toBe(true);
    expect(isoDateSchema.safeParse('2026-02-30').success).toBe(false);
  });

  it('valida un POST de driver con URL relativa de Blob', () => {
    const result = createDriverSchema.safeParse({
      component_id: '1',
      profile_id: '1',
      os_environment: 'Win11_x64',
      edition_name: 'AMD Software: Adrenalin Edition',
      version_number: '24.9.1',
      release_date: '2026-09-15',
      download_url: 'amd-adrenalin-24.9.1-win11-64bit.exe',
      file_size_mb: '540',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.component_id).toBe(1);
      expect(result.data.file_size_mb).toBe(540);
    }
  });

  it('rechaza file_size_mb <= 0 y un PUT vacío de driver', () => {
    expect(
      createDriverSchema.safeParse({
        component_id: 1,
        profile_id: 1,
        os_environment: 'Win11_x64',
        edition_name: 'AMD Software',
        version_number: '24.9.1',
        release_date: '2026-09-15',
        download_url: 'https://driwinstorage.blob.core.windows.net/drivers/a.exe',
        file_size_mb: 0,
      }).success,
    ).toBe(false);
    expect(updateDriverSchema.safeParse({}).success).toBe(false);
  });

  it('filtra whql por query string', () => {
    expect(listDriverQuerySchema.parse({ whql: 'true' }).whql).toBe(true);
    expect(listDriverQuerySchema.parse({ whql: 'false' }).whql).toBe(false);
  });
});
