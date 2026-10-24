import type { AppsRecommendationResult } from '../domain/app.types.js';
import { AppRepository } from '../repositories/app.repository.js';

export class AppService {
  /**
   * Consolida las aplicaciones recomendadas para uno o más perfiles.
   * El repositorio ya elimina duplicados y agrega `source_profiles`; aquí sólo
   * se calcula el peso total de la descarga (regla de negocio de la UI).
   */
  static async resolveAppsRecommendation(profiles: string[]): Promise<AppsRecommendationResult> {
    const apps = await AppRepository.findAppsByProfiles(profiles);

    const totalSizeMb = apps.reduce((sum, app) => sum + Number(app.file_size_mb), 0);

    return {
      data: apps.map((app) => ({
        ...app,
        file_size_mb: Number(app.file_size_mb),
        source_profiles: app.source_profiles ?? [],
      })),
      meta: {
        profiles,
        total: apps.length,
        total_size_mb: totalSizeMb,
      },
    };
  }
}
