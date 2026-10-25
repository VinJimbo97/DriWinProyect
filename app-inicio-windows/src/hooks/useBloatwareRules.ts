import { getBloatwareRules } from '../api/driwin';
import { useApi } from './useApi';

/** Reglas de bloatware desde GET /api/v1/bloatware-rules. */
export function useBloatwareRules() {
  return useApi('bloatware-rules', getBloatwareRules);
}
