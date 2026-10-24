import { Router } from 'express';
import * as driverController from '../controllers/driver.controller.js';
import { requireWriteAccess } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import {
  createDriverSchema,
  driverIdParamSchema,
  listDriverQuerySchema,
  updateDriverSchema,
} from '../schemas/driver.schema.js';

/** Capa 3 — Ruteo del recurso driver-packages. */
const router = Router();

router.get('/', validate({ query: listDriverQuerySchema }), driverController.listDrivers);

router.get('/:id', validate({ params: driverIdParamSchema }), driverController.getDriver);

router.post(
  '/',
  requireWriteAccess,
  validate({ body: createDriverSchema }),
  driverController.createDriver,
);

router.put(
  '/:id',
  requireWriteAccess,
  validate({ params: driverIdParamSchema, body: updateDriverSchema }),
  driverController.updateDriver,
);

router.delete(
  '/:id',
  requireWriteAccess,
  validate({ params: driverIdParamSchema }),
  driverController.deleteDriver,
);

export default router;
