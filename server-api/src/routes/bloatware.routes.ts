import { Router } from 'express';
import { BloatwareController } from '../controllers/bloatware.controller.js';
import { requireWriteAccess } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  bloatwareIdParamSchema,
  createBloatwareSchema,
  listBloatwareQuerySchema,
  updateBloatwareSchema,
} from '../schemas/bloatware.schema.js';

/** Capa 3 — Ruteo del recurso bloatware-rules (CRUD completo). */
const router = Router();

router.get(
  '/',
  validate({ query: listBloatwareQuerySchema }),
  BloatwareController.getRules,
);

router.get(
  '/:id',
  validate({ params: bloatwareIdParamSchema }),
  BloatwareController.getRule,
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createBloatwareSchema }),
  BloatwareController.createRule,
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: bloatwareIdParamSchema, body: updateBloatwareSchema }),
  BloatwareController.updateRule,
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: bloatwareIdParamSchema }),
  BloatwareController.deleteRule,
);

export default router;
