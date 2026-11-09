import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatClp, monthlyEquivalent, PREMIUM_PLANS, savingsVsYearly } from './plans.ts';

const plan = (years: 1 | 2 | 3) => PREMIUM_PLANS.find((candidate) => candidate.years === years)!;

describe('planes Premium', () => {
  it('tiene los precios acordados por el equipo', () => {
    assert.deepEqual(
      PREMIUM_PLANS.map((p) => [p.years, p.priceClp]),
      [[1, 29990], [2, 57990], [3, 84990]],
    );
  });

  it('calcula el precio mensual equivalente', () => {
    assert.equal(monthlyEquivalent(plan(1)), 2499);
    assert.equal(monthlyEquivalent(plan(2)), 2416);
    assert.equal(monthlyEquivalent(plan(3)), 2361);
  });

  it('calcula el ahorro frente a renovar cada año', () => {
    assert.equal(savingsVsYearly(plan(1)), 0);
    assert.equal(savingsVsYearly(plan(2)), 1990);
    assert.equal(savingsVsYearly(plan(3)), 4980);
  });

  it('los planes más largos salen más baratos por mes', () => {
    assert.ok(monthlyEquivalent(plan(3)) < monthlyEquivalent(plan(2)));
    assert.ok(monthlyEquivalent(plan(2)) < monthlyEquivalent(plan(1)));
  });

  it('formatea en pesos chilenos', () => {
    assert.match(formatClp(29990), /^\$\s?29\.990$/);
  });
});
