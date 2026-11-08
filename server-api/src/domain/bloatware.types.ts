/** Etiquetas de riesgo admitidas por `ck_bloatware_risk`. */
export type BloatwareRiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';

/** Política de una regla para un perfil (`bloatware_profile_policy`). */
export type BloatwarePolicy = 'SUGERIDO' | 'OPCIONAL' | 'PROTEGIDO';

/** Política que llega a la UI: las PROTEGIDAS nunca se envían. */
export type VisibleBloatwarePolicy = Exclude<BloatwarePolicy, 'PROTEGIDO'>;

/** DTO público de una regla de bloatware (tabla `bloatware_rules`). */
export interface BloatwareRuleDto {
  bloatware_id: number;
  app_display_name: string;
  package_signature: string;
  /** Nombres exactos de los paquetes de la Store (Get-AppxPackage -Name). */
  package_names: string[];
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
  /** Explicación en lenguaje simple para el botón "?". */
  help_text: string;
  created_at: string;
}

/** Regla resuelta para los perfiles del usuario (GET /bloatware-rules?profiles=...). */
export interface ProfileBloatwareRuleDto extends BloatwareRuleDto {
  policy: VisibleBloatwarePolicy;
}

/** Fila cruda devuelta por `bloatware.repository` (created_at llega como Date). */
export interface BloatwareRuleRow {
  bloatware_id: number;
  app_display_name: string;
  package_signature: string;
  package_names: string[];
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
  help_text: string;
  created_at: Date;
}

/** Fila de `bloatware_profile_policy` unida con el nombre del perfil. */
export interface BloatwarePolicyRow {
  bloatware_id: number;
  profile_name: string;
  policy: BloatwarePolicy;
}

export interface CreateBloatwareInput {
  app_display_name: string;
  package_signature: string;
  package_names?: string[];
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
  help_text?: string;
}

export type UpdateBloatwareInput = Partial<CreateBloatwareInput>;
