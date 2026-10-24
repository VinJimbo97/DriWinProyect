/** DTO de un componente de hardware (tabla `hardware_components`). */
export interface HardwareComponentDto {
  component_id: number;
  ven_id: string;
  dev_id: string;
  subsys_id: string;
  commercial_name: string;
  category: string;
  created_at: string;
}

/** Fila cruda que devuelve el repositorio (created_at llega como Date). */
export interface HardwareRow {
  component_id: number;
  ven_id: string;
  dev_id: string;
  subsys_id: string;
  commercial_name: string;
  category: string;
  created_at: Date;
  total_count?: number;
}

export interface HardwareFilters {
  ven_id?: string;
  dev_id?: string;
  category?: string;
}

export interface CreateHardwareInput {
  ven_id: string;
  dev_id: string;
  subsys_id?: string;
  commercial_name: string;
  category: string;
}

/** PUT: sólo campos mutables según el contrato §3.3. */
export interface UpdateHardwareInput {
  commercial_name?: string;
  category?: string;
}

export interface HardwareListResult {
  rows: HardwareRow[];
  total: number;
}

export interface HardwareDeleteResult {
  found: boolean;
  driverCount: number;
  deleted: boolean;
}

/** Firma física PCI/USB: VEN_ID + DEV_ID + SUBSYS_ID. */
export interface HardwareSignature {
  venId: string;
  devId: string;
  subsysId?: string;
}
