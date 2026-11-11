import { apiGet, apiPost } from './client';
import type {
  AppsRecommendationResponse,
  BloatwareRulesResponse,
  DriverRecommendationRequest,
  DriverRecommendationResponse,
  ProfileName,
} from './types';

/**
 * Una función por endpoint de server-api. Aquí se arma la URL y los query
 * params; client.ts se encarga del fetch y de los errores.
 */

/**
 * GET /api/v1/bloatware-rules?profiles=Gamer,Developer (público).
 * Con perfiles, el backend oculta lo que esos perfiles usan y marca lo sugerido.
 */
export async function getBloatwareRules(profiles: ProfileName[], signal?: AbortSignal): Promise<BloatwareRulesResponse> {
  const query = profiles.length > 0 ? `?${new URLSearchParams({ profiles: profiles.join(',') })}` : '';
  const response = await apiGet<BloatwareRulesResponse>(`/bloatware-rules${query}`, signal);
  // Un backend anterior a la migración 004 no envía estos campos: la regla
  // aparece sin paquetes (no se puede ejecutar) en vez de romper la pantalla.
  return {
    ...response,
    data: response.data.map((rule) => ({
      ...rule,
      package_names: Array.isArray(rule.package_names) ? rule.package_names : [],
      help_text: rule.help_text ?? '',
      policy: rule.policy ?? (rule.risk_level === 'BAJO' ? 'SUGERIDO' : 'OPCIONAL'),
    })),
  };
}

/** GET /api/v1/recommendations/apps?profiles=Gamer,Creator (público). */
export function getRecommendedApps(
  profiles: ProfileName[],
  signal?: AbortSignal,
): Promise<AppsRecommendationResponse> {
  const query = new URLSearchParams({ profiles: profiles.join(',') });
  return apiGet<AppsRecommendationResponse>(`/recommendations/apps?${query}`, signal);
}

/** POST /api/v1/recommendations/driver: mejor driver para UN dispositivo detectado. */
export function postDriverRecommendation(
  body: DriverRecommendationRequest,
  signal?: AbortSignal,
): Promise<DriverRecommendationResponse> {
  return apiPost<DriverRecommendationResponse>('/recommendations/driver', body, signal);
}
