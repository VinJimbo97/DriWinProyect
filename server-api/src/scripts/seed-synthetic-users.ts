import { parseArgs } from 'node:util';
import { z } from 'zod';
import { closePool } from '../config/db.js';
import { SyntheticUserRepository } from '../repositories/syntheticUser.repository.js';
import { generateSyntheticUsers } from '../services/syntheticUser.generator.js';

/**
 * Script de datos sintéticos: genera N usuarios de prueba en synthetic_users.
 *
 *   npm run seed:synthetic                         → 100 usuarios, semilla 42
 *   npm run seed:synthetic -- --count 1000 --seed 7
 *   npm run seed:synthetic -- --dry-run            → muestra sin escribir en la BD
 *
 * Cada ejecución REEMPLAZA el lote generado anterior (no se acumulan) y nunca
 * toca los 6 usuarios de la semilla de db/init.sql.
 */

const argsSchema = z.object({
  count: z.coerce
    .number({ invalid_type_error: '--count debe ser numérico' })
    .int('--count debe ser un entero')
    .min(1, '--count debe ser al menos 1')
    .max(10_000, '--count no puede superar 10000')
    .default(100),
  seed: z.coerce
    .number({ invalid_type_error: '--seed debe ser numérico' })
    .int('--seed debe ser un entero')
    .min(0, '--seed no puede ser negativo')
    .default(42),
  'dry-run': z.boolean().default(false),
});

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      count: { type: 'string' },
      seed: { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
  });

  const parsed = argsSchema.safeParse(values);
  if (!parsed.success) {
    console.error('❌ Argumentos inválidos:');
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const { count, seed, 'dry-run': dryRun } = parsed.data;

  const tiers = await SyntheticUserRepository.findTiers();
  const users = generateSyntheticUsers({ count, seed, tiers });

  console.log(`🧪 Generados ${users.length} usuarios sintéticos (semilla ${seed}).`);

  if (dryRun) {
    console.log('   Modo --dry-run: no se escribió nada en la base de datos. Muestra:');
    console.table(users.slice(0, 8));
    return;
  }

  const { deleted, inserted } = await SyntheticUserRepository.replaceGenerated(users);
  console.log(`✅ Lote anterior eliminado: ${deleted} · Insertados: ${inserted}`);

  console.table(await SyntheticUserRepository.summarizeGenerated());

  const violations = await SyntheticUserRepository.countDeviceLimitViolations();
  console.log(
    violations === 0
      ? '✅ Regla de negocio OK: ningún usuario supera el límite de PCs de su plan.'
      : `❌ ${violations} usuarios superan el límite de PCs de su plan.`,
  );
  if (violations > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    // Sólo el mensaje técnico: nunca la cadena de conexión.
    console.error('❌ El script falló:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
