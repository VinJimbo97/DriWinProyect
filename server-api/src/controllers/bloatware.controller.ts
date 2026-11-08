import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { getValidated } from '../middlewares/validate.js';
import type {
  CreateBloatwareBody,
  ListBloatwareQuery,
  UpdateBloatwareBody,
} from '../schemas/bloatware.schema.js';
import { BloatwareService } from '../services/bloatware.service.js';

interface IdParams {
  id: number;
}

const RESOURCE_PATH = `${env.API_BASE_PATH}/bloatware-rules`;

export class BloatwareController {
  static async getRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { risk_level, profiles } = getValidated<ListBloatwareQuery>(req, 'query');
      const result = await BloatwareService.getAllRules(risk_level, profiles);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = getValidated<IdParams>(req, 'params');
      const rule = await BloatwareService.getRuleById(id);
      res.status(200).json({ data: rule });
    } catch (error) {
      next(error);
    }
  }

  static async createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = getValidated<CreateBloatwareBody>(req, 'body');
      const rule = await BloatwareService.createRule(body);
      res.status(201).location(`${RESOURCE_PATH}/${rule.bloatware_id}`).json({ data: rule });
    } catch (error) {
      next(error);
    }
  }

  static async updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = getValidated<IdParams>(req, 'params');
      const body = getValidated<UpdateBloatwareBody>(req, 'body');
      const rule = await BloatwareService.updateRule(id, body);
      res.status(200).json({ data: rule });
    } catch (error) {
      next(error);
    }
  }

  static async deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = getValidated<IdParams>(req, 'params');
      await BloatwareService.deleteRule(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
