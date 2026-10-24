import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { getValidated } from '../middlewares/validate.js';
import type {
  CreateHardwareBody,
  DeleteHardwareQuery,
  ListHardwareQuery,
  UpdateHardwareBody,
} from '../schemas/hardware.schema.js';
import * as hardwareService from '../services/hardware.service.js';

interface IdParams {
  id: number;
}

const RESOURCE_PATH = `${env.API_BASE_PATH}/hardware-components`;

/** GET /api/v1/hardware-components */
export async function listHardware(req: Request, res: Response): Promise<void> {
  const query = getValidated<ListHardwareQuery>(req, 'query');
  const page = await hardwareService.listHardware(query);

  // Catálogo estable: cache breve para descargar carga del Flexible Server.
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(page);
}

/** GET /api/v1/hardware-components/:id */
export async function getHardware(req: Request, res: Response): Promise<void> {
  const { id } = getValidated<IdParams>(req, 'params');
  const component = await hardwareService.getHardwareById(id);

  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json({ data: component });
}

/** POST /api/v1/hardware-components */
export async function createHardware(req: Request, res: Response): Promise<void> {
  const body = getValidated<CreateHardwareBody>(req, 'body');
  const component = await hardwareService.createHardware(body);

  res
    .status(201)
    .location(`${RESOURCE_PATH}/${component.component_id}`)
    .json({ data: component });
}

/** PUT /api/v1/hardware-components/:id */
export async function updateHardware(req: Request, res: Response): Promise<void> {
  const { id } = getValidated<IdParams>(req, 'params');
  const body = getValidated<UpdateHardwareBody>(req, 'body');
  const component = await hardwareService.updateHardware(id, body);

  res.status(200).json({ data: component });
}

/** DELETE /api/v1/hardware-components/:id?cascade=true */
export async function deleteHardware(req: Request, res: Response): Promise<void> {
  const { id } = getValidated<IdParams>(req, 'params');
  const { cascade } = getValidated<DeleteHardwareQuery>(req, 'query');

  await hardwareService.deleteHardware(id, cascade);
  res.status(204).send();
}
