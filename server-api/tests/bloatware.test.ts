import { describe, expect, it, vi } from 'vitest';
import { BloatwareRepository } from '../src/repositories/bloatware.repository.js';
import {
  createBloatwareSchema,
  listBloatwareQuerySchema,
  updateBloatwareSchema,
} from '../src/schemas/bloatware.schema.js';
import { BloatwareService, resolvePolicy } from '../src/services/bloatware.service.js';

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
  package_names: ['Microsoft.XboxGamingOverlay'],
  help_text: 'Explicación para el botón ?',
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

describe('nombres de paquete (lo único que la app de escritorio recibe para eliminar)', () => {
  it('acepta nombres reales de la Store, con comodín', () => {
    const parsed = createBloatwareSchema.parse({
      ...validRule,
      package_names: ['Microsoft.XboxGamingOverlay', 'king.com.*', 'MicrosoftCorporationII.QuickAssist'],
    });
    expect(parsed.package_names).toHaveLength(3);
  });

  for (const malicious of ["x'; Remove-Item C:\ -Recurse", 'Microsoft.Bing News', 'a', '$(calc)', '-Name']) {
    it(`rechaza ${JSON.stringify(malicious)}`, () => {
      expect(createBloatwareSchema.safeParse({ ...validRule, package_names: [malicious] }).success).toBe(false);
    });
  }
});

describe('política por perfil', () => {
  it('sin perfiles: BAJO viene marcado y MEDIO no', () => {
    expect(resolvePolicy('BAJO', [])).toBe('SUGERIDO');
    expect(resolvePolicy('MEDIO', [])).toBe('OPCIONAL');
  });

  it('con varios perfiles gana el más prudente', () => {
    expect(resolvePolicy('BAJO', ['SUGERIDO', 'SUGERIDO'])).toBe('SUGERIDO');
    expect(resolvePolicy('BAJO', ['SUGERIDO', 'OPCIONAL'])).toBe('OPCIONAL');
    expect(resolvePolicy('MEDIO', ['SUGERIDO', 'PROTEGIDO'])).toBeNull();
  });

  it('un perfil sin fila en la BD usa el valor por riesgo', () => {
    expect(resolvePolicy('MEDIO', ['SUGERIDO', undefined])).toBe('OPCIONAL');
  });

  it('el query ?profiles= se separa por comas y sin duplicados', () => {
    expect(listBloatwareQuerySchema.parse({ profiles: 'Gamer, Developer,Gamer' }).profiles).toEqual([
      'Gamer',
      'Developer',
    ]);
  });

  it('oculta las reglas protegidas para el perfil y avisa cuántas', async () => {
    const solitaire = { ...storedRule, bloatware_id: 2, risk_level: 'BAJO' as const };
    vi.spyOn(BloatwareRepository, 'findAll').mockResolvedValue([storedRule, solitaire]);
    vi.spyOn(BloatwareRepository, 'findPoliciesForProfiles').mockResolvedValue([
      { bloatware_id: 4, profile_name: 'Gamer', policy: 'PROTEGIDO' },
      { bloatware_id: 2, profile_name: 'Gamer', policy: 'SUGERIDO' },
    ]);

    const result = await BloatwareService.getAllRules(undefined, ['Gamer']);

    expect(result.data.map((rule) => rule.bloatware_id)).toEqual([2]);
    expect(result.data[0].policy).toBe('SUGERIDO');
    expect(result.meta).toEqual({ total: 1, profiles: ['Gamer'], hidden: 1 });
  });
});
