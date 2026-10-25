/**
 * Dominio reservado por la RFC 2606 (.example nunca existe en internet).
 * Marca los usuarios generados por el script: permite borrarlos y
 * regenerarlos sin tocar los 6 usuarios de la semilla de db/init.sql, y
 * garantiza que ningún correo pertenezca a una persona real (Ley N.º 21.719).
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'driwin-sintetico.example';

/** Plan comercial tal como se lee de subscription_tiers. */
export interface SubscriptionTierRef {
  tier_id: number;
  tier_name: string;
  /** NULL en la BD = dispositivos ilimitados. */
  max_devices: number | null;
}

/** Fila a insertar en synthetic_users. */
export interface SyntheticUserInput {
  full_name: string;
  email: string;
  user_role_type: string;
  tier_id: number;
  selected_profiles_array: string[];
  active_devices_count: number;
}

export interface ReplaceSyntheticResult {
  deleted: number;
  inserted: number;
}
