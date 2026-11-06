import { ApiError, ErrorCode } from '../domain/errors.js';
import type { DriverRecommendationBody } from '../schemas/recommendation.schema.js';
import { RecommendationRepository } from '../repositories/recommendation.repository.js';
import { describeOffloading } from './blobUrl.service.js';
import { normalizePciId } from './hardware.service.js';

export interface DriverRecommendationResult {
  component: {
    component_id: number;
    ven_id: string;
    dev_id: string;
    commercial_name: string;
    category: string;
  };
  recommendation: {
    driver_id: number;
    profile_name: string;
    os_environment: string;
    edition_name: string;
    version_number: string;
    release_date: string;
    download_url: string;
    file_size_mb: number;
    silent_install_flags: string;
    is_whql_certified: boolean;
    sha256: string | null;
  };
  alternatives: Array<{
    profile_name: string;
    edition_name: string;
    version_number: string;
    file_size_mb: number;
  }>;
  offloading: ReturnType<typeof describeOffloading>;
}

export class RecommendationService {
  /**
   * Orquesta la resolución del mejor controlador para el hardware detectado.
   *
   * Reglas de negocio y códigos HTTP (contrato §3.9):
   *  - Firma VEN/DEV inexistente            → 404 NOT_FOUND
   *  - Perfil solicitado inexistente        → 409 CONFLICT
   *  - Hardware/perfil válidos sin paquete  → 422 NO_DRIVER_FOR_PROFILE
   */
  static async resolveOptimalDriver(
    dto: DriverRecommendationBody,
  ): Promise<DriverRecommendationResult> {
    // 1. Normalización: firmas PCI/USB siempre en mayúsculas y 4 hexágonos.
    const venId = normalizePciId(dto.ven_id, 'ven_id');
    const devId = normalizePciId(dto.dev_id, 'dev_id');
    const profiles = [...new Set(dto.profiles.map((profile) => profile.trim()))].filter(Boolean);

    // 2. Consulta a la capa de datos.
    const rows = await RecommendationRepository.findOptimalDriver(
      venId,
      devId,
      dto.os_environment,
      profiles,
    );

    // 3. Diagnóstico preciso cuando no hay filas: separar "no existe" de
    //    "existe pero no hay driver" evita devolver 200/500 engañosos.
    if (rows.length === 0) {
      const hardware = await RecommendationRepository.findHardwareBySignature(venId, devId);

      if (!hardware) {
        throw new ApiError(
          404,
          ErrorCode.NOT_FOUND,
          `El hardware VEN_${venId} / DEV_${devId} no está catalogado.`,
          [{ field: 'ven_id', issue: 'La firma VEN_ID + DEV_ID no existe en hardware_components.' }],
          'Registre primero el componente con POST /api/v1/hardware-components.',
        );
      }

      const knownProfiles = await RecommendationRepository.findExistingProfileNames(profiles);
      const unknownProfiles = profiles.filter((profile) => !knownProfiles.includes(profile));

      if (unknownProfiles.length > 0) {
        throw new ApiError(
          409,
          ErrorCode.CONFLICT,
          `Perfil(es) no registrado(s): ${unknownProfiles.join(', ')}.`,
          unknownProfiles.map((profile) => ({
            field: 'profiles',
            issue: `El perfil "${profile}" no existe en user_profiles.`,
          })),
          'Consulte los perfiles disponibles con GET /api/v1/user-profiles (Hito 2) o use Gamer, Creator, Office o Developer.',
        );
      }

      throw new ApiError(
        422,
        ErrorCode.NO_DRIVER_FOR_PROFILE,
        `No existe un paquete de controladores para VEN_${venId} / DEV_${devId} en ${dto.os_environment} para el perfil solicitado.`,
        [
          {
            field: 'profiles',
            issue: `No hay driver publicado para ${profiles.join(', ')} en ${dto.os_environment}.`,
          },
        ],
        'Pruebe otro perfil u otro sistema operativo; el hardware sí está catalogado.',
      );
    }

    // 4. Mapeo de DTO. El primer registro es el óptimo (orden WHQL y tamaño).
    const [optimal, ...rest] = rows;

    return {
      component: {
        component_id: optimal.component_id,
        ven_id: optimal.ven_id,
        dev_id: optimal.dev_id,
        commercial_name: optimal.commercial_name,
        category: optimal.category,
      },
      recommendation: {
        driver_id: optimal.driver_id,
        profile_name: optimal.profile_name,
        os_environment: optimal.os_environment,
        edition_name: optimal.edition_name,
        version_number: optimal.version_number,
        release_date: optimal.release_date,
        download_url: optimal.download_url,
        file_size_mb: Number(optimal.file_size_mb),
        silent_install_flags: optimal.silent_install_flags,
        is_whql_certified: optimal.is_whql_certified,
        sha256: optimal.sha256,
      },
      alternatives: rest.map((row) => ({
        profile_name: row.profile_name,
        edition_name: row.edition_name,
        version_number: row.version_number,
        file_size_mb: Number(row.file_size_mb),
      })),
      // 5. Offloading: el binario nunca transita por la API.
      offloading: describeOffloading(Number(optimal.file_size_mb), 'drivers'),
    };
  }
}
