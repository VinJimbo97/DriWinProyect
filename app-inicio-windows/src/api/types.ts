/**
 * Contrato del Front-End con server-api (/api/v1).
 * Estas interfaces replican los DTO de server-api/src/domain/*.types.ts:
 * si el backend cambia la forma de una respuesta, se actualiza aquí.
 */

/** Nombres canónicos de la tabla user_profiles (db/init.sql). */
export type ProfileName = 'Gamer' | 'Creator' | 'Developer' | 'Office';

export type BloatwareRiskLevel = 'BAJO' | 'MEDIO' | 'ALTO';

/** Valores admitidos por driver_packages.os_environment. */
export type OsEnvironment = 'Win11_x64' | 'Win10_x64';

/** POST /recommendations/driver → body */
export interface DriverRecommendationRequest {
  ven_id: string;
  dev_id: string;
  os_environment: OsEnvironment;
  profiles: ProfileName[];
}

/** POST /recommendations/driver → data */
export interface DriverRecommendation {
  component: {
    component_id: number;
    ven_id: string;
    dev_id: string;
    commercial_name: string;
    category: string;
  };
  recommendation: {
    driver_id: number;
    profile_name: string;
    os_environment: string;
    edition_name: string;
    version_number: string;
    release_date: string;
    download_url: string;
    file_size_mb: number;
    silent_install_flags: string;
    is_whql_certified: boolean;
    /** Huella del instalador. Sin ella, la app no lo instala. */
    sha256: string | null;
  };
  alternatives: {
    profile_name: string;
    edition_name: string;
    version_number: string;
    file_size_mb: number;
  }[];
}

export interface DriverRecommendationResponse {
  data: DriverRecommendation;
  meta: { generated_at: string; query_time_ms: number };
}

/** GET /bloatware-rules → data[] */
export interface BloatwareRule {
  bloatware_id: number;
  app_display_name: string;
  package_signature: string;
  detection_powershell_cmd: string;
  removal_powershell_cmd: string;
  risk_level: BloatwareRiskLevel;
  description: string;
  created_at: string;
}

export interface BloatwareRulesResponse {
  data: BloatwareRule[];
  meta: { total: number };
}

/** GET /recommendations/apps?profiles=... → data[] */
export interface RecommendedApp {
  app_id: number;
  app_name: string;
  category: string;
  version_number: string;
  download_url: string;
  file_size_mb: number;
  silent_install_flags: string;
  source_profiles: string[];
}

export interface AppsRecommendationResponse {
  data: RecommendedApp[];
  meta: {
    profiles: string[];
    total: number;
    total_size_mb: number;
    generated_at: string;
    query_time_ms: number;
  };
}

/** Envoltorio de error común (server-api/src/domain/errors.ts → SerializedApiError). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string; expected?: string }[];
    timestamp: string;
    path: string;
    requestId: string;
    hint?: string;
  };
}
