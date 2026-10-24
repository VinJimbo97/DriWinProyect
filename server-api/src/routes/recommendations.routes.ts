import { Router } from 'express';
import { RecommendationsController } from '../controllers/recommendations.controller.js';
import { requireApiKey, requireWriteAccess } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  appsRecommendationQuerySchema,
  driverRecommendationBodySchema,
} from '../schemas/recommendation.schema.js';

/**
 * Capa 3 — Ruteo de los endpoints de negocio.
 * Sólo declara verbos, middlewares y controladores: cero SQL y cero lógica.
 */
const router = Router();

// GET /api/v1/recommendations/apps?profiles=Gamer,Creator
// El contrato §3.1 exige credencial también en los GET de recomendación.
router.get(
  '/apps',
  requireApiKey,
  validate({ query: appsRecommendationQuerySchema }),
  RecommendationsController.getAppsRecommendation,
);

// POST /api/v1/recommendations/driver — escritura: exige rol read-write.
router.post(
  '/driver',
  requireWriteAccess,
  validate({ body: driverRecommendationBodySchema }),
  RecommendationsController.postDriverRecommendation,
);

export default router;
