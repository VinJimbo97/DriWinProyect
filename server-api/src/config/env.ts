import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Contrato de variables de entorno del Back-End.
 * El servidor aborta el arranque si falta algo o si una credencial sigue
 * con el valor de plantilla en producción (fail-fast).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    API_BASE_PATH: z.string().startsWith('/').default('/api/v1'),

    // Seguridad / CORS / tasa
    API_KEY: z.string().min(16, 'API_KEY debe tener al menos 16 caracteres'),
    API_KEY_READ_ONLY: z.preprocess(
      (value) => (value === '' || value === undefined ? undefined : value),
      z.string().min(16, 'API_KEY_READ_ONLY debe tener al menos 16 caracteres').optional(),
    ),
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:5173,https://driwin.vercel.app'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Azure Database for PostgreSQL Flexible Server
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    // `require`/`verify-*` cifran el tránsito. `disable`/`prefer` existen sólo
    // para PostgreSQL local sin TLS; producción los rechaza en superRefine.
    PGSSLMODE: z
      .enum(['require', 'verify-ca', 'verify-full', 'prefer', 'disable'])
      .default('require'),
    DB_SSL_REJECT_UNAUTHORIZED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

    // Azure Blob Storage (offloading de binarios)
    AZURE_STORAGE_ACCOUNT_NAME: z.string().default('driwinstorage'),
    AZURE_BLOB_ENDPOINT: z
      .string()
      .url()
      .default('https://driwinstorage.blob.core.windows.net'),
    AZURE_CONTAINER_APPS: z.string().default('apps'),
    AZURE_CONTAINER_DRIVERS: z.string().default('drivers'),
    AZURE_SAS_TOKEN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.API_KEY.startsWith('CHANGE_ME')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_KEY'],
        message:
          'En producción API_KEY no puede conservar el valor de plantilla CHANGE_ME. Genere una clave aleatoria (mínimo 32 caracteres).',
      });
    }

    if (data.NODE_ENV === 'production' && data.API_KEY.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['API_KEY'],
        message: 'En producción API_KEY debe tener al menos 32 caracteres aleatorios.',
      });
    }

    if (data.NODE_ENV === 'production' && !data.DATABASE_URL.includes('sslmode=require')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message:
          'En producción DATABASE_URL debe incluir sslmode=require para cifrar el tránsito hacia Azure PostgreSQL.',
      });
    }

    if (data.NODE_ENV === 'production' && (data.PGSSLMODE === 'disable' || data.PGSSLMODE === 'prefer')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PGSSLMODE'],
        message:
          'En producción PGSSLMODE no puede ser disable/prefer: Azure exige TLS (require o verify-full).',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Se imprime el detalle del schema, nunca valores reales de credenciales.
  const failures = parsed.error.issues.map((issue) => ({
    variable: issue.path.join('.'),
    issue: issue.message,
  }));
  console.error('❌ Configuración de entorno inválida en server-api/.env:');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
