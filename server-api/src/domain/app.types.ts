/** DTO de una aplicación recomendada (tabla `recommended_apps`). */
export interface RecommendedAppDto {
  app_id: number;
  app_name: string;
  category: string;
  version_number: string;
  download_url: string;
  file_size_mb: number;
  silent_install_flags: string;
  /** Id exacto en winget; la app de escritorio instala con él (migración 006). */
  winget_id: string | null;
  /** Página oficial para apps que no están en winget. */
  official_url: string | null;
  /** Perfiles que recomiendan la app (TEXT[] agregado desde `profile_apps`). */
  source_profiles: string[];
}

/** Fila cruda devuelta por `app.repository` (misma forma que el DTO). */
export type RecommendedAppRow = RecommendedAppDto;

export interface AppsRecommendationResult {
  data: RecommendedAppDto[];
  meta: {
    profiles: string[];
    total: number;
    total_size_mb: number;
  };
}
