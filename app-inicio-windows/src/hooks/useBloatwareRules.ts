import { getBloatwareRules } from '../api/driwin';
import type { ProfileName } from '../api/types';
import { useApi } from './useApi';

/**
 * Reglas de bloatware para los perfiles del usuario. Sin perfiles
 * (Usuario Estándar) se piden igual: el backend usa el valor según el riesgo.
 */
export function useBloatwareRules(profiles: ProfileName[]) {
  const key = `bloatware:${[...profiles].sort().join(',')}`;
  return useApi(key, (signal) => getBloatwareRules(profiles, signal));
}
