import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { getValidated } from '../middlewares/validate.js';
import type {
  CreateDriverBody,
  ListDriverQuery,
  UpdateDriverBody,
} from '../schemas/driver.schema.js';
import * as driverService from '../services/driver.service.js';

interface IdParams {
  id: number;
}

const RESOURCE_PATH = `${env.API_BASE_PATH}/driver-packages`;

/** GET /api/v1/driver-packages */
export async function listDrivers(req: Request, res: Response): Promise<void> {
  const query = getValidated<ListDriverQuery>(req, 'query');
  const page = await driverService.listDrivers(query);

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(page);
}

/** GET /api/v1/driver-packages/:id */
export async function getDriver(req: Request, res: Response): Promise<void> {
  const { id } = getValidated<IdParams>(req, 'params');
  const driver = await driverService.getDriverById(id);

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ data: driver });
}

/** POST /api/v1/driver-packages */
export async function createDriver(req: Request, res: Response): Promise<void> {
  const body = getValidated<CreateDriverBody>(req, 'body');
  const driver = await driverService.createDriver(body);

  res.status(201).location(`${RESOURCE_PATH}/${driver.driver_id}`).json({ data: driver });
}

/** PUT /api/v1/driver-packages/:id */
export async function updateDriver(req: Request, res: Response): Promise<void> {
  const { id } = getValidated<IdParams>(req, 'params');
  const body = getValidated<UpdateDriverBody>(req, 'body');
  const driver = await driverService.updateDriver(id, body);

  res.status(200).json({ data: driver });
}

/** DELETE /api/v1/driver-packages/:id */
export async function deleteDriver(req: Request, res: Response): Promise<void> {
  const { id } = getValidated<IdParams>(req, 'params');

  await driverService.deleteDriver(id);
  res.status(204).send();
}
