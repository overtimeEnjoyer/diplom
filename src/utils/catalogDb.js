import { hasReadReplicas } from '../config/database.js';

/** Route read-heavy catalog queries to replicas when configured (thesis §2.1). */
export function catalogQueryOptions() {
  return hasReadReplicas() ? { useMaster: false } : {};
}
