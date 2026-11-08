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

/** SUGERIDO = viene marcada · OPCIONAL = sin marcar (las PROTEGIDAS no llegan). */
export type BloatwarePolicy = 'SUGERIDO' | 'OPCIONAL';

/**
 * GET /bloatware-rules → data[]
 * (La API también envía los comandos PowerShell de la regla como documentación;
 * la app NO los usa: sólo envía `package_names` a la lista permitida de Electron.)
 */
export interface BloatwareRule {
  bloatware_id: number;
  app_display_name: string;
  package_signature: string;
  /** Nombres exactos de los paquetes de la Store que se eliminan. */
  package_names: string[];
  risk_level: BloatwareRiskLevel;
  /** Resumen de una línea. */
  description: string;
  /** Explicación en lenguaje simple para el botón "?". */
  help_text: string;
  policy: BloatwarePolicy;
  created_at: string;
}

export interface BloatwareRulesResponse {
  data: BloatwareRule[];
  /** `hidden`: reglas que los perfiles elegidos protegen (no se envían). */
  meta: { total: number; profiles?: string[]; hidden?: number };
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
  /** Id exacto en winget; con él la app de escritorio la instala. */
  winget_id: string | null;
  /** Página oficial para apps que no están en winget. */
  official_url: string | null;
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
