/** DTO anidado del componente dentro de un paquete de controladores. */
export interface DriverComponentSummary {
  ven_id: string;
  dev_id: string;
  commercial_name: string;
  category: string;
}

/** Respuesta pública de `driver-packages` (cruce con hardware y perfil). */
export interface DriverPackageDto {
  driver_id: number;
  component_id: number;
  profile_id: number;
  profile_name: string;
  component: DriverComponentSummary;
  os_environment: string;
  edition_name: string;
  version_number: string;
  release_date: string;
  download_url: string;
  file_size_mb: number;
  silent_install_flags: string;
  is_whql_certified: boolean;
  created_at: string;
}

export interface DriverRow {
  driver_id: number;
  component_id: number;
  profile_id: number;
  profile_name: string;
  ven_id: string;
  dev_id: string;
  commercial_name: string;
  category: string;
  os_environment: string;
  edition_name: string;
  version_number: string;
  release_date: string;
  download_url: string;
  file_size_mb: number;
  silent_install_flags: string;
  is_whql_certified: boolean;
  created_at: Date;
  total_count?: number;
}

export interface DriverFilters {
  component_id?: number;
  profile_id?: number;
  os_environment?: string;
  whql?: boolean;
}

export interface CreateDriverInput {
  component_id: number;
  profile_id: number;
  os_environment: string;
  edition_name: string;
  version_number: string;
  release_date: string;
  download_url: string;
  file_size_mb: number;
  silent_install_flags?: string;
  is_whql_certified?: boolean;
}

/** PUT/PATCH: todos los campos opcionales, pero al menos uno obligatorio. */
export type UpdateDriverInput = Partial<CreateDriverInput>;

export interface DriverListResult {
  rows: DriverRow[];
  total: number;
}

/** Metadatos de offloading que acompañan a cada binario pesado. */
export interface OffloadingDescriptor {
  strategy: 'DIRECT_AZURE_BLOB';
  container: 'drivers' | 'apps';
  estimated_bytes: number;
  binary_traverses_api: false;
}
