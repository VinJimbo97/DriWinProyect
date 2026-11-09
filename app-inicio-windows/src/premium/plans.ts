/**
 * Planes de DriWin Premium (decisión del equipo, 2026-11-09):
 * sólo suscripción, de 1, 2 o 3 años, para hasta 3 equipos.
 * Precios en pesos chilenos, IVA incluido.
 */
export interface PremiumPlan {
  years: 1 | 2 | 3;
  priceClp: number;
}

export const MAX_DEVICES = 3;

export const PREMIUM_PLANS: PremiumPlan[] = [
  { years: 1, priceClp: 29990 },
  { years: 2, priceClp: 57990 },
  { years: 3, priceClp: 84990 },
];

/** Plan que se destaca en la pantalla de planes. */
export const FEATURED_PLAN_YEARS = 2;

const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

export function formatClp(amount: number): string {
  return clp.format(amount);
}

/** Precio mensual equivalente, redondeado al peso. */
export function monthlyEquivalent(plan: PremiumPlan): number {
  return Math.round(plan.priceClp / (plan.years * 12));
}

/** Ahorro frente a pagar el plan de 1 año varias veces (0 para el de 1 año). */
export function savingsVsYearly(plan: PremiumPlan, plans: PremiumPlan[] = PREMIUM_PLANS): number {
  const yearly = plans.find((candidate) => candidate.years === 1);
  if (!yearly) {
    return 0;
  }
  return Math.max(0, yearly.priceClp * plan.years - plan.priceClp);
}
