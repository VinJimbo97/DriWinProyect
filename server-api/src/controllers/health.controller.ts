import type { Request, Response } from 'express';
import { HealthService } from '../services/health.service.js';

/**
 * GET /api/v1/health
 * Sólo HTTP: delega en HealthService y fija la cabecera de caché.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await HealthService.getStatus();

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(health);
}
