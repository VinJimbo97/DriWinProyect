/** Etiquetas de riesgo admitidas por `ck_bloatware_risk`. */
export type BloatwareRiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';

/** DTO público de una regla de bloatware (tabla `bloatware_rules`). */
export interface BloatwareRuleDto {
  bloatware_id: number;
  app_display_name: string;
  package_signature: string;
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
  created_at: string;
}

/** Fila cruda devuelta por `bloatware.repository` (created_at llega como Date). */
export interface BloatwareRuleRow {
  bloatware_id: number;
  app_display_name: string;
  package_signature: string;
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
  created_at: Date;
}

export interface CreateBloatwareInput {
  app_display_name: string;
  package_signature: string;
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
}

export type UpdateBloatwareInput = Partial<CreateBloatwareInput>;
