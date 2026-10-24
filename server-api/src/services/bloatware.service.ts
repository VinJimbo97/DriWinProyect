import { ApiError } from '../domain/errors.js';
import type {
  BloatwareRuleDto,
  BloatwareRuleRow,
  CreateBloatwareInput,
  UpdateBloatwareInput,
} from '../domain/bloatware.types.js';
import { BloatwareRepository } from '../repositories/bloatware.repository.js';

function toDto(row: BloatwareRuleRow): BloatwareRuleDto {
  return {
    bloatware_id: row.bloatware_id,
    app_display_name: row.app_display_name,
    package_signature: row.package_signature,
    detection_powershell_cmd: row.detection_powershell_cmd,
    removal_powershell_cmd: row.removal_powershell_cmd,
    risk_level: row.risk_level,
    description: row.description,
    created_at: new Date(row.created_at).toISOString(),
  };
}

export class BloatwareService {
  static async getAllRules(riskLevel?: string) {
    const rules = await BloatwareRepository.findAll(riskLevel);
    return {
      data: rules.map(toDto),
      meta: { total: rules.length },
    };
  }

  static async getRuleById(bloatwareId: number): Promise<BloatwareRuleDto> {
    const rule = await BloatwareRepository.findById(bloatwareId);
    if (!rule) {
      throw ApiError.notFound('bloatware_rules', bloatwareId);
    }
    return toDto(rule);
  }

  static async createRule(input: CreateBloatwareInput): Promise<BloatwareRuleDto> {
    // Si la BD lanza 23505 por uq_bloatware_signature, errorHandler lo traduce
    // automáticamente a 409 CONFLICT.
    const newRule = await BloatwareRepository.create(input);
    return toDto(newRule);
  }

  static async updateRule(
    bloatwareId: number,
    input: UpdateBloatwareInput,
  ): Promise<BloatwareRuleDto> {
    const updated = await BloatwareRepository.update(bloatwareId, input);
    if (!updated) {
      throw ApiError.notFound('bloatware_rules', bloatwareId);
    }
    return toDto(updated);
  }

  static async deleteRule(bloatwareId: number): Promise<void> {
    const deleted = await BloatwareRepository.delete(bloatwareId);
    if (!deleted) {
      throw ApiError.notFound('bloatware_rules', bloatwareId);
    }
  }
}
