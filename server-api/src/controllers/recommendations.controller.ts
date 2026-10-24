import type { NextFunction, Request, Response } from 'express';
import { getValidated } from '../middlewares/validate.js';
import type {
  AppsRecommendationQuery,
  DriverRecommendationBody,
} from '../schemas/recommendation.schema.js';
import { AppService } from '../services/app.service.js';
import { RecommendationService } from '../services/recommendation.service.js';

export class RecommendationsController {
  /**
   * POST /api/v1/recommendations/driver
   * El DTO ya viene validado y normalizado por `validate` (req.validated.body).
   */
  static async postDriverRecommendation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dto = getValidated<DriverRecommendationBody>(req, 'body');
      const startTime = Date.now();

      const result = await RecommendationService.resolveOptimalDriver(dto);

      res.status(200).json({
        data: result,
        meta: {
          generated_at: new Date().toISOString(),
          query_time_ms: Date.now() - startTime,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/recommendations/apps?profiles=Gamer,Creator
   * `validate` transforma el query string en `string[]` (sin vacíos/duplicados).
   */
  static async getAppsRecommendation(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { profiles } = getValidated<AppsRecommendationQuery>(req, 'query');
      const startTime = Date.now();

      const result = await AppService.resolveAppsRecommendation(profiles);

      res.status(200).json({
        data: result.data,
        meta: {
          ...result.meta,
          generated_at: new Date().toISOString(),
          query_time_ms: Date.now() - startTime,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
