import { getRecommendedApps } from '../api/driwin';
import type { ProfileName } from '../api/types';
import { useApi } from './useApi';

/**
 * Apps recomendadas para los perfiles del usuario (unión sin duplicados que
 * calcula el backend). Sin perfiles no se hace la petición.
 */
export function useRecommendedApps(profiles: ProfileName[]) {
  const key = profiles.length > 0 ? `apps:${[...profiles].sort().join(',')}` : null;
  return useApi(key, (signal) => getRecommendedApps(profiles, signal));
}
