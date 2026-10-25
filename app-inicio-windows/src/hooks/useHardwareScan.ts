import { scanDevices } from '../scanner';
import { useApi } from './useApi';

/** Escanea el hardware: el equipo real (en el .exe) o un fixture simulado. */
export function useHardwareScan(sourceId: string) {
  return useApi(`scan:${sourceId}`, (signal) => scanDevices(sourceId, signal));
}
