import { Router } from 'express';
import * as hardwareController from '../controllers/hardware.controller.js';
import { requireWriteAccess } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  createHardwareSchema,
  deleteHardwareQuerySchema,
  hardwareIdParamSchema,
  listHardwareQuerySchema,
  updateHardwareSchema,
} from '../schemas/hardware.schema.js';

/**
 * Capa 3 — Ruteo. Sólo declara verbos, middlewares y controladores.
 * Cero SQL y cero reglas de negocio en este archivo.
 */
const router = Router();

router.get(
  '/',
  validate({ query: listHardwareQuerySchema }),
  hardwareController.listHardware,
);

router.get(
  '/:id',
  validate({ params: hardwareIdParamSchema }),
  hardwareController.getHardware,
);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createHardwareSchema }),
  hardwareController.createHardware,
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: hardwareIdParamSchema, body: updateHardwareSchema }),
  hardwareController.updateHardware,
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: hardwareIdParamSchema, query: deleteHardwareQuerySchema }),
  hardwareController.deleteHardware,
);

export default router;
