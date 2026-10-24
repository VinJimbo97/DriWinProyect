import { describe, expect, it, vi } from 'vitest';
import { BloatwareRepository } from '../src/repositories/bloatware.repository.js';
import {
  createBloatwareSchema,
  listBloatwareQuerySchema,
  updateBloatwareSchema,
} from '../src/schemas/bloatware.schema.js';
import { BloatwareService } from '../src/services/bloatware.service.js';

const validRule = {
  app_display_name: 'Xbox Gaming Overlay / Game Bar',
  package_signature: '*XboxGamingOverlay*',
  detection_powershell_cmd: 'Get-AppxPackage -Name *XboxGamingOverlay* | Select-Object Name, Version',
  removal_powershell_cmd: 'Get-AppxPackage -Name *XboxGamingOverlay* | Remove-AppxPackage',
  risk_level: 'MEDIO' as const,
  description:
    'Superposición de captura y overlay de Xbox. Se omite la limpieza automática en el perfil Gamer.',
};

const storedRule = {
  bloatware_id: 4,
  ...validRule,
  created_at: new Date('2026-10-21T14:07:02.550Z'),
};

describe('schemas de bloatware-rules', () => {
  it('acepta una regla completa del contrato', () => {
    expect(createBloatwareSchema.parse(validRule)).toEqual(validRule);
  });

  it('rechaza risk_level fuera de ck_bloatware_risk', () => {
    expect(createBloatwareSchema.safeParse({ ...validRule, risk_level: 'CRITICO' }).success).toBe(
      false,
    );
  });

  it('rechaza un PUT vacío y un filtro de riesgo inválido', () => {
    expect(updateBloatwareSchema.safeParse({}).success).toBe(false);
    expect(listBloatwareQuerySchema.safeParse({ risk_level: 'CRITICO' }).success).toBe(false);
    expect(listBloatwareQuerySchema.parse({ risk_level: 'ALTO' }).risk_level).toBe('ALTO');
  });

  it('respeta el largo máximo de package_signature (VARCHAR(150))', () => {
    expect(
      createBloatwareSchema.safeParse({ ...validRule, package_signature: 'x'.repeat(151) }).success,
    ).toBe(false);
  });
});

describe('BloatwareService', () => {
  it('mapea created_at a ISO-8601 y envuelve la lista en { data, meta }', async () => {
    vi.spyOn(BloatwareRepository, 'findAll').mockResolvedValue([storedRule]);

    const result = await BloatwareService.getAllRules('MEDIO');

    expect(result.meta).toEqual({ total: 1 });
    expect(result.data[0].created_at).toBe('2026-10-21T14:07:02.550Z');
    expect(result.data[0].risk_level).toBe('MEDIO');
  });

  it('crea la regla y devuelve el DTO público', async () => {
    vi.spyOn(BloatwareRepository, 'create').mockResolvedValue(storedRule);

    const result = await BloatwareService.createRule(validRule);

    expect(result.bloatware_id).toBe(4);
    expect(result.package_signature).toBe('*XboxGamingOverlay*');
  });

  it('devuelve 404 NOT_FOUND al consultar una regla inexistente', async () => {
    vi.spyOn(BloatwareRepository, 'findById').mockResolvedValue(null);

    await expect(BloatwareService.getRuleById(999)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('devuelve 404 NOT_FOUND al borrar una regla inexistente', async () => {
    vi.spyOn(BloatwareRepository, 'delete').mockResolvedValue(false);

    await expect(BloatwareService.deleteRule(999)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('devuelve 404 NOT_FOUND al actualizar una regla inexistente', async () => {
    vi.spyOn(BloatwareRepository, 'update').mockResolvedValue(null);

    await expect(
      BloatwareService.updateRule(999, { risk_level: 'ALTO' }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });
});
