import {
  SYNTHETIC_EMAIL_DOMAIN,
  type SubscriptionTierRef,
  type SyntheticUserInput,
} from '../domain/syntheticUser.types.js';

/**
 * Generador de usuarios sintéticos (lógica pura, sin base de datos).
 *
 * - Reproducible: la misma semilla produce exactamente los mismos usuarios.
 * - Coherente con el negocio: cada arquetipo usa planes acordes a su segmento
 *   y nunca supera max_devices del plan (consulta 6 de init.sql = 0 filas).
 * - Sin datos reales: nombres combinados al azar y correos en un dominio
 *   reservado (.example), por lo que no existe PII.
 */

type Rng = () => number;

/** PRNG mulberry32: pequeño, rápido y determinista a partir de una semilla. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** "Muñoz Peña" → "munoz-pena" (apto para la parte local de un correo). */
function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const FIRST_NAMES = [
  'Sofía', 'Martina', 'Isidora', 'Florencia', 'Agustina', 'Catalina', 'Antonella', 'Josefa',
  'Fernanda', 'Constanza', 'Javiera', 'Trinidad', 'Benjamín', 'Vicente', 'Martín', 'Matías',
  'Joaquín', 'Agustín', 'Tomás', 'Cristóbal', 'Maximiliano', 'Sebastián', 'Felipe', 'Ignacio',
] as const;

const LAST_NAMES = [
  'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez',
  'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya',
  'Flores', 'Espinoza', 'Valenzuela', 'Castillo', 'Tapia', 'Reyes', 'Gutiérrez',
] as const;

const HYBRID_PROFILES = ['Gamer', 'Creator', 'Developer'] as const;

/** Planes de db/init.sql (B.7) y migración 008. */
const PREMIUM_TIERS = ['DriWin Premium 1 año', 'DriWin Premium 2 años', 'DriWin Premium 3 años'];

interface Persona {
  full_name: string;
  emailLocal: string;
  user_role_type: string;
  profiles: string[];
}

interface Archetype {
  /** Peso relativo: cuántas veces aparece frente a los demás. */
  weight: number;
  tierNames: string[];
  devices: [min: number, max: number];
  build: (rng: Rng) => Persona;
}

function person(rng: Rng, role: string, profiles: string[]): Persona {
  const first = pick(rng, FIRST_NAMES);
  const last1 = pick(rng, LAST_NAMES);
  const last2 = pick(rng, LAST_NAMES);
  return {
    full_name: `${first} ${last1} ${last2}`,
    emailLocal: `${slug(first)}.${slug(last1)}`,
    user_role_type: role,
    profiles,
  };
}

/**
 * Arquetipos alineados con los planes de subscription_tiers: DriWin Premium es
 * una suscripción para personas, de 1, 2 o 3 años y hasta 3 equipos.
 */
const ARCHETYPES: Archetype[] = [
  { weight: 25, tierNames: PREMIUM_TIERS, devices: [1, 3], build: (rng) => person(rng, 'Gamer', ['Gamer']) },
  { weight: 15, tierNames: PREMIUM_TIERS, devices: [1, 3], build: (rng) => person(rng, 'Creator', ['Creator']) },
  { weight: 15, tierNames: PREMIUM_TIERS, devices: [1, 3], build: (rng) => person(rng, 'Developer', ['Developer']) },
  {
    weight: 15,
    tierNames: PREMIUM_TIERS,
    devices: [1, 3],
    build: (rng) => {
      const first = pick(rng, HYBRID_PROFILES);
      const second = pick(rng, HYBRID_PROFILES.filter((profile) => profile !== first));
      const profiles = [first, second].sort();
      return person(rng, `Híbrido ${profiles.join(' + ')}`, profiles);
    },
  },
  { weight: 15, tierNames: PREMIUM_TIERS, devices: [1, 2], build: (rng) => person(rng, 'Oficinista', ['Office']) },
  // Técnico que arma o formatea equipos de su familia o clientes: usa los 3 equipos del plan.
  { weight: 15, tierNames: PREMIUM_TIERS, devices: [2, 3], build: (rng) => person(rng, 'Técnico Armador', ['Office', 'Gamer']) },
];

const TOTAL_WEIGHT = ARCHETYPES.reduce((sum, archetype) => sum + archetype.weight, 0);

function pickArchetype(rng: Rng): Archetype {
  let roll = rng() * TOTAL_WEIGHT;
  for (const archetype of ARCHETYPES) {
    roll -= archetype.weight;
    if (roll < 0) {
      return archetype;
    }
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

export interface GenerateSyntheticUsersOptions {
  count: number;
  seed: number;
  /** Planes reales leídos de la BD (los IDs no se asumen). */
  tiers: SubscriptionTierRef[];
}

export function generateSyntheticUsers(options: GenerateSyntheticUsersOptions): SyntheticUserInput[] {
  const tiersByName = new Map(options.tiers.map((tier) => [tier.tier_name, tier]));
  const missing = [...new Set(ARCHETYPES.flatMap((archetype) => archetype.tierNames))].filter(
    (name) => !tiersByName.has(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `Faltan planes en subscription_tiers: ${missing.join(', ')}. Ejecute db/init.sql antes del script.`,
    );
  }

  const rng = createRng(options.seed);
  const users: SyntheticUserInput[] = [];

  for (let index = 0; index < options.count; index += 1) {
    const archetype = pickArchetype(rng);
    const persona = archetype.build(rng);
    const tier = tiersByName.get(pick(rng, archetype.tierNames)) as SubscriptionTierRef;

    // Nunca superar el límite del plan (3 equipos).
    const maxDevices = Math.min(archetype.devices[1], tier.max_devices ?? Number.POSITIVE_INFINITY);
    const minDevices = Math.min(archetype.devices[0], maxDevices);

    users.push({
      full_name: persona.full_name,
      // El índice garantiza correos únicos (UNIQUE synthetic_users.email).
      email: `${persona.emailLocal}.${String(index + 1).padStart(5, '0')}@${SYNTHETIC_EMAIL_DOMAIN}`,
      user_role_type: persona.user_role_type,
      tier_id: tier.tier_id,
      selected_profiles_array: persona.profiles,
      active_devices_count: randomInt(rng, minDevices, maxDevices),
    });
  }

  return users;
}
