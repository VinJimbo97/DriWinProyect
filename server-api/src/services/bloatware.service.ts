import { ApiError } from '../domain/errors.js';
import type {
  BloatwarePolicy,
  BloatwareRiskLevel,
  BloatwareRuleDto,
  BloatwareRuleRow,
  CreateBloatwareInput,
  ProfileBloatwareRuleDto,
  UpdateBloatwareInput,
  VisibleBloatwarePolicy,
} from '../domain/bloatware.types.js';
import { BloatwareRepository } from '../repositories/bloatware.repository.js';

function toDto(row: BloatwareRuleRow): BloatwareRuleDto {
  return {
    bloatware_id: row.bloatware_id,
    app_display_name: row.app_display_name,
    package_signature: row.package_signature,
    package_names: row.package_names ?? [],
    detection_powershell_cmd: row.detection_powershell_cmd,
    removal_powershell_cmd: row.removal_powershell_cmd,
    risk_level: row.risk_level,
    description: row.description,
    help_text: row.help_text ?? '',
    created_at: new Date(row.created_at).toISOString(),
  };
}

/** Sin política explícita para un perfil: lo de riesgo BAJO viene marcado, el resto no. */
function defaultPolicy(risk: BloatwareRiskLevel): VisibleBloatwarePolicy {
  return risk === 'BAJO' ? 'SUGERIDO' : 'OPCIONAL';
}

/**
 * Combina la política de varios perfiles con el criterio más prudente:
 * PROTEGIDO (se oculta) > OPCIONAL (sin marcar) > SUGERIDO (marcada).
 * `perProfile` trae una entrada por perfil elegido; `undefined` = sin fila en la BD.
 * Devuelve null cuando la regla debe ocultarse.
 */
export function resolvePolicy(
  risk: BloatwareRiskLevel,
  perProfile: (BloatwarePolicy | undefined)[],
): VisibleBloatwarePolicy | null {
  const policies = perProfile.length > 0
    ? perProfile.map((policy) => policy ?? defaultPolicy(risk))
    : [defaultPolicy(risk)];

  if (policies.includes('PROTEGIDO')) {
    return null;
  }
  return policies.includes('OPCIONAL') ? 'OPCIONAL' : 'SUGERIDO';
}

export class BloatwareService {
  /**
   * Lista de reglas. Con `profiles`, cada regla trae la política resuelta para
   * esos perfiles y las PROTEGIDAS no se envían.
   */
  static async getAllRules(riskLevel?: string, profiles?: string[]) {
    const rules = await BloatwareRepository.findAll(riskLevel);
    const policyRows = profiles?.length ? await BloatwareRepository.findPoliciesForProfiles(profiles) : [];

    const byRule = new Map<number, Map<string, BloatwarePolicy>>();
    for (const row of policyRows) {
      const forRule = byRule.get(row.bloatware_id) ?? new Map<string, BloatwarePolicy>();
      forRule.set(row.profile_name, row.policy);
      byRule.set(row.bloatware_id, forRule);
    }

    const data: ProfileBloatwareRuleDto[] = [];
    for (const rule of rules) {
      const perProfile = (profiles ?? []).map((profile) => byRule.get(rule.bloatware_id)?.get(profile));
      const policy = resolvePolicy(rule.risk_level, perProfile);
      if (policy) {
        data.push({ ...toDto(rule), policy });
      }
    }

    return {
      data,
      meta: profiles?.length
        ? { total: data.length, profiles, hidden: rules.length - data.length }
        : { total: data.length },
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
