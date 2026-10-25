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

/** GET /api/v1/bloatware-rules (público, no requiere clave). */
export function getBloatwareRules(signal?: AbortSignal): Promise<BloatwareRulesResponse> {
  return apiGet<BloatwareRulesResponse>('/bloatware-rules', signal);
}

/** GET /api/v1/recommendations/apps?profiles=Gamer,Creator (requiere clave). */
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
