import { describe, expect, it } from 'vitest';
import { SYNTHETIC_EMAIL_DOMAIN, type SubscriptionTierRef } from '../src/domain/syntheticUser.types.js';
import { generateSyntheticUsers } from '../src/services/syntheticUser.generator.js';

/** Mismos planes que la semilla de db/init.sql (B.7). */
const tiers: SubscriptionTierRef[] = [
  { tier_id: 1, tier_name: 'DriWin Premium 1 año', max_devices: 3 },
  { tier_id: 2, tier_name: 'DriWin Premium 2 años', max_devices: 3 },
  { tier_id: 3, tier_name: 'DriWin Premium 3 años', max_devices: 3 },
];

const VALID_PROFILES = ['Gamer', 'Creator', 'Office', 'Developer'];

describe('generateSyntheticUsers', () => {
  const users = generateSyntheticUsers({ count: 2000, seed: 42, tiers });

  it('genera exactamente la cantidad pedida', () => {
    expect(users).toHaveLength(2000);
  });

  it('es reproducible: la misma semilla produce los mismos usuarios', () => {
    expect(generateSyntheticUsers({ count: 50, seed: 7, tiers })).toEqual(
      generateSyntheticUsers({ count: 50, seed: 7, tiers }),
    );
    expect(generateSyntheticUsers({ count: 50, seed: 7, tiers })).not.toEqual(
      generateSyntheticUsers({ count: 50, seed: 8, tiers }),
    );
  });

  it('genera correos únicos y sólo en el dominio reservado', () => {
    const emails = users.map((user) => user.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) {
      expect(email).toMatch(new RegExp(`^[a-z0-9.-]+@${SYNTHETIC_EMAIL_DOMAIN.replace('.', '\\.')}$`));
      expect(email.length).toBeLessThanOrEqual(160);
    }
  });

  it('nunca supera max_devices del plan (consulta 6 de init.sql)', () => {
    const limits = new Map(tiers.map((tier) => [tier.tier_id, tier.max_devices]));
    for (const user of users) {
      const max = limits.get(user.tier_id);
      expect(user.active_devices_count).toBeGreaterThanOrEqual(1);
      if (max !== null && max !== undefined) {
        expect(user.active_devices_count).toBeLessThanOrEqual(max);
      }
    }
  });

  it('usa perfiles existentes y nunca un arreglo vacío (ck_profiles_not_empty)', () => {
    for (const user of users) {
      expect(user.selected_profiles_array.length).toBeGreaterThanOrEqual(1);
      for (const profile of user.selected_profiles_array) {
        expect(VALID_PROFILES).toContain(profile);
      }
    }
  });

  it('reparte a los usuarios entre los tres planes de suscripción', () => {
    const used = new Set(users.map((user) => user.tier_id));
    expect([...used].sort()).toEqual([1, 2, 3]);
  });

  it('el técnico armador usa al menos 2 de los 3 equipos', () => {
    const technicians = users.filter((user) => user.user_role_type === 'Técnico Armador');
    expect(technicians.length).toBeGreaterThan(0);
    for (const user of technicians) {
      expect(user.active_devices_count).toBeGreaterThanOrEqual(2);
      expect(user.active_devices_count).toBeLessThanOrEqual(3);
    }
  });

  it('falla con un mensaje claro si falta un plan en la BD', () => {
    expect(() =>
      generateSyntheticUsers({ count: 1, seed: 1, tiers: tiers.slice(0, 2) }),
    ).toThrow(/Faltan planes en subscription_tiers/);
  });
});
