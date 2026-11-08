import { describe, expect, it, vi } from 'vitest';
import { RecommendationRepository } from '../src/repositories/recommendation.repository.js';
import { AppRepository } from '../src/repositories/app.repository.js';
import {
  appsRecommendationQuerySchema,
  driverRecommendationBodySchema,
} from '../src/schemas/recommendation.schema.js';
import { AppService } from '../src/services/app.service.js';
import { RecommendationService } from '../src/services/recommendation.service.js';

const optimalRow = {
  driver_id: 1,
  edition_name: 'AMD Software: Adrenalin Edition',
  version_number: '24.9.1',
  release_date: '2026-09-15',
  download_url: 'https://driwinstorage.blob.core.windows.net/drivers/amd-adrenalin-24.9.1-win11-64bit.exe',
  file_size_mb: 540,
  silent_install_flags: '-install',
  is_whql_certified: true,
  sha256: 'a'.repeat(64),
  os_environment: 'Win11_x64',
  profile_name: 'Gamer',
  component_id: 1,
  ven_id: '1002',
  dev_id: '1638',
  commercial_name: 'AMD Radeon(TM) Graphics (Vega Integrated)',
  category: 'GPU',
};

describe('schemas de /recommendations', () => {
  it('acepta el payload canónico del contrato', () => {
    const parsed = driverRecommendationBodySchema.parse({
      ven_id: '1002',
      dev_id: '1638',
      subsys_id: 'GENERIC',
      os_environment: 'Win11_x64',
      profiles: ['Gamer'],
    });

    expect(parsed).toEqual({
      ven_id: '1002',
      dev_id: '1638',
      subsys_id: 'GENERIC',
      os_environment: 'Win11_x64',
      profiles: ['Gamer'],
    });
  });

  it('acepta los alias del Hito 1 (ven/dev/profile) y los normaliza', () => {
    const parsed = driverRecommendationBodySchema.parse({
      ven: 'VEN_1002',
      dev: '1638',
      os_environment: 'Win10_x64',
      profile: 'Creator',
    });

    expect(parsed.ven_id).toBe('VEN_1002');
    expect(parsed.dev_id).toBe('1638');
    expect(parsed.profiles).toEqual(['Creator']);
  });

  it('rechaza payloads sin firma o sin perfiles', () => {
    const withoutSignature = driverRecommendationBodySchema.safeParse({
      os_environment: 'Win11_x64',
      profiles: ['Gamer'],
    });
    const withoutProfiles = driverRecommendationBodySchema.safeParse({
      ven_id: '1002',
      dev_id: '1638',
      os_environment: 'Win11_x64',
    });

    expect(withoutSignature.success).toBe(false);
    expect(withoutProfiles.success).toBe(false);
  });

  it('rechaza un sistema operativo fuera del dominio', () => {
    expect(
      driverRecommendationBodySchema.safeParse({
        ven_id: '1002',
        dev_id: '1638',
        os_environment: 'Linux_x64',
        profiles: ['Gamer'],
      }).success,
    ).toBe(false);
  });

  it('transforma ?profiles=Gamer,Creator en arreglo sin duplicados ni vacíos', () => {
    const parsed = appsRecommendationQuerySchema.parse({ profiles: ' Gamer, Creator ,,Gamer ' });
    expect(parsed.profiles).toEqual(['Gamer', 'Creator']);
  });

  it('rechaza ?profiles vacío', () => {
    expect(appsRecommendationQuerySchema.safeParse({ profiles: ' , ' }).success).toBe(false);
  });
});

describe('RecommendationService.resolveOptimalDriver', () => {
  it('mapea el driver óptimo y publica metadatos de offloading', async () => {
    vi.spyOn(RecommendationRepository, 'findOptimalDriver').mockResolvedValue([optimalRow]);

    const result = await RecommendationService.resolveOptimalDriver({
      ven_id: 'ven_1002',
      dev_id: '1638',
      os_environment: 'Win11_x64',
      profiles: ['Gamer'],
    });

    expect(RecommendationRepository.findOptimalDriver).toHaveBeenCalledWith(
      '1002',
      '1638',
      'Win11_x64',
      ['Gamer'],
    );
    expect(result.recommendation.release_date).toBe('2026-09-15');
    expect(result.recommendation.file_size_mb).toBe(540);
    expect(result.offloading).toEqual({
      strategy: 'DIRECT_AZURE_BLOB',
      container: 'drivers',
      estimated_bytes: 540 * 1024 * 1024,
      binary_traverses_api: false,
    });
    expect(result.alternatives).toEqual([]);
  });

  it('devuelve 404 NOT_FOUND si la firma de hardware no está catalogada', async () => {
    vi.spyOn(RecommendationRepository, 'findOptimalDriver').mockResolvedValue([]);
    vi.spyOn(RecommendationRepository, 'findHardwareBySignature').mockResolvedValue(null);

    await expect(
      RecommendationService.resolveOptimalDriver({
        ven_id: '9999',
        dev_id: '9999',
        os_environment: 'Win11_x64',
        profiles: ['Gamer'],
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('devuelve 409 CONFLICT si el perfil no existe en user_profiles', async () => {
    vi.spyOn(RecommendationRepository, 'findOptimalDriver').mockResolvedValue([]);
    vi.spyOn(RecommendationRepository, 'findHardwareBySignature').mockResolvedValue({
      component_id: 1,
    });
    vi.spyOn(RecommendationRepository, 'findExistingProfileNames').mockResolvedValue(['Gamer']);

    await expect(
      RecommendationService.resolveOptimalDriver({
        ven_id: '1002',
        dev_id: '1638',
        os_environment: 'Win11_x64',
        profiles: ['Gamer', 'GamerX'],
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });

  it('devuelve 422 NO_DRIVER_FOR_PROFILE si el hardware existe pero no hay paquete', async () => {
    vi.spyOn(RecommendationRepository, 'findOptimalDriver').mockResolvedValue([]);
    vi.spyOn(RecommendationRepository, 'findHardwareBySignature').mockResolvedValue({
      component_id: 1,
    });
    vi.spyOn(RecommendationRepository, 'findExistingProfileNames').mockResolvedValue(['Gamer']);

    await expect(
      RecommendationService.resolveOptimalDriver({
        ven_id: '1002',
        dev_id: '1638',
        os_environment: 'Win10_x64',
        profiles: ['Gamer'],
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'NO_DRIVER_FOR_PROFILE' });
  });
});

describe('AppService.resolveAppsRecommendation', () => {
  it('calcula el peso total y conserva source_profiles', async () => {
    vi.spyOn(AppRepository, 'findAppsByProfiles').mockResolvedValue([
      {
        app_id: 1,
        app_name: 'Steam',
        category: 'Gaming',
        version_number: '3.0.10.91',
        download_url: 'https://driwinstorage.blob.core.windows.net/apps/steam-setup.exe',
        file_size_mb: 65,
        silent_install_flags: '/S',
        winget_id: 'Valve.Steam',
        official_url: null,
        source_profiles: ['Gamer'],
      },
      {
        app_id: 6,
        app_name: 'Blender',
        category: 'Creatividad (3D)',
        version_number: '4.2.3 LTS',
        download_url: 'https://driwinstorage.blob.core.windows.net/apps/blender.msi',
        file_size_mb: 350,
        silent_install_flags: '/qn /norestart',
        winget_id: null,
        official_url: 'https://www.blender.org/download/',
        source_profiles: ['Creator'],
      },
    ]);

    const result = await AppService.resolveAppsRecommendation(['Gamer', 'Creator']);

    expect(result.meta).toEqual({
      profiles: ['Gamer', 'Creator'],
      total: 2,
      total_size_mb: 415,
    });
    expect(result.data[0].source_profiles).toEqual(['Gamer']);
    // El origen de instalación llega intacto a la app de escritorio.
    expect(result.data[0].winget_id).toBe('Valve.Steam');
    expect(result.data[1]).toMatchObject({ winget_id: null, official_url: 'https://www.blender.org/download/' });
  });
});
