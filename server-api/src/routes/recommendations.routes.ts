import { Router } from 'express';
import { RecommendationsController } from '../controllers/recommendations.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  appsRecommendationQuerySchema,
  driverRecommendationBodySchema,
} from '../schemas/recommendation.schema.js';

/**
 * Capa 3 — Ruteo de los endpoints de negocio.
 * Sólo declara verbos, middlewares y controladores: cero SQL y cero lógica.
 *
 * Son consultas PÚBLICAS, igual que los GET del catálogo: devuelven datos que
 * no son sensibles (qué driver o app conviene a un perfil) y no escriben nada.
 * Antes exigían una clave de sólo lectura, pero esa clave tenía que viajar
 * dentro de la app de escritorio, donde cualquiera puede extraerla: una clave
 * embebida no protege nada. La protección real es la de toda la API: límite de
 * peticiones por IP, CORS, validación estricta con Zod y un usuario de base de
 * datos que sólo puede leer el catálogo (migración 007).
 */
const router = Router();

// GET /api/v1/recommendations/apps?profiles=Gamer,Creator
router.get(
  '/apps',
  validate({ query: appsRecommendationQuerySchema }),
  RecommendationsController.getAppsRecommendation,
);

// POST /api/v1/recommendations/driver — es una CONSULTA (no escribe en la BD);
// usa POST sólo para enviar el hardware detectado en el body.
router.post(
  '/driver',
  validate({ body: driverRecommendationBodySchema }),
  RecommendationsController.postDriverRecommendation,
);

export default router;
