/**
 * EXPLAIN ANALYZE de las consultas reales de la API (QA Hito 3 · "The Art of PostgreSQL").
 *
 * Llama a los REPOSITORIOS de producción e intercepta pool.query para anteponer
 * `EXPLAIN (ANALYZE, BUFFERS)`: así se analiza exactamente el SQL que ejecuta la
 * API, no una copia que podría quedar desactualizada.
 *
 * Seguridad:
 *  - Sólo se analizan consultas de lectura (SELECT). Cualquier otra se rechaza.
 *  - --scale (insertar volumen simulado) y --experiment sólo se permiten contra
 *    localhost: NUNCA modifican una base remota.
 *
 * Uso (desde server-api):
 *   npx tsx bench/explain.ts --db postgresql://postgres@127.0.0.1:5544/postgres --label local-datos-reales
 *   npx tsx bench/explain.ts --db postgresql://postgres@127.0.0.1:5544/postgres --label local-100k --scale 100000 --experiment
 *
 * Resultado: tabla en consola + docs/qa/explain/<label>.md con los planes completos.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------- parámetros
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : (all[index + 1] ?? 'true')]);
    return pairs;
  }, []),
);
if (!args.db) {
  console.error('Falta --db <cadena de conexión>');
  process.exit(1);
}
const DB_URL = args.db;
const LABEL = args.label ?? 'explain';
const SCALE = Number(args.scale ?? 0);
const EXPERIMENT = args.experiment === 'true';
const dbHost = new URL(DB_URL).hostname;
const IS_LOCAL = ['127.0.0.1', 'localhost', '::1'].includes(dbHost);
if ((SCALE > 0 || EXPERIMENT) && !IS_LOCAL) {
  console.error('--scale y --experiment sólo se permiten contra una base local.');
  process.exit(1);
}

// La configuración de la API se valida al importarla: valores de prueba (nunca reales).
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = DB_URL;
process.env.PGSSLMODE ??= IS_LOCAL ? 'disable' : 'require';
process.env.DB_POOL_MAX = '1';
process.env.API_KEY ??= 'explain_script_no_es_una_clave_real';
process.env.DATA_ENCRYPTION_KEY ??= 'ab'.repeat(32);

const { pool } = await import('../src/config/db.js');
const { RecommendationRepository } = await import('../src/repositories/recommendation.repository.js');
const { BloatwareRepository } = await import('../src/repositories/bloatware.repository.js');
const { AppRepository } = await import('../src/repositories/app.repository.js');
const { AccountRepository } = await import('../src/repositories/account.repository.js');

// ------------------------------------------------------- interceptar pool.query
type Captured = { sql: string; params: unknown[]; plan: PlanNode; text: string; planningMs: number; executionMs: number };
type PlanNode = { 'Node Type': string; 'Index Name'?: string; 'Relation Name'?: string; Plans?: PlanNode[]; [key: string]: unknown };

const originalQuery = pool.query.bind(pool) as (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
let captured: Captured[] = [];

async function explain(sql: string, params: unknown[] = [], runner = originalQuery): Promise<Captured> {
  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    throw new Error(`Sólo se analizan lecturas; se rechazó: ${sql.trim().slice(0, 40)}...`);
  }
  const json = await runner(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const text = await runner(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`, params);
  const result = (json.rows[0] as { 'QUERY PLAN': { Plan: PlanNode; 'Planning Time': number; 'Execution Time': number }[] })['QUERY PLAN'][0];
  return {
    sql,
    params,
    plan: result.Plan,
    text: text.rows.map((row) => (row as { 'QUERY PLAN': string })['QUERY PLAN']).join('\n'),
    planningMs: result['Planning Time'],
    executionMs: result['Execution Time'],
  };
}

// Los repositorios llaman a pool.query(...) o a client.query(...): se intercepta ese método.
const explainingQuery = async (sql: string, params: unknown[] = []) => {
  captured.push(await explain(sql, params));
  return { rows: [], rowCount: 0 };
};
(pool as unknown as { query: typeof explainingQuery }).query = explainingQuery;
const fakeClient = { query: explainingQuery } as never;

/** Recorre el plan: tipos de nodo y los índices que usa. */
function walk(node: PlanNode, out = { nodes: [] as string[], indexes: [] as string[], seqScans: [] as string[] }) {
  out.nodes.push(node['Node Type']);
  if (node['Index Name']) out.indexes.push(node['Index Name']);
  if (node['Node Type'] === 'Seq Scan' && node['Relation Name']) out.seqScans.push(node['Relation Name']);
  for (const child of node.Plans ?? []) walk(child, out);
  return out;
}

// --------------------------------------------------------------- consultas
const PROFILES = ['Gamer', 'Developer'];
/**
 * Huella de prueba determinista (32 bytes) = la misma fórmula que usa el volumen
 * simulado en SQL: decode(md5(seed||'a') || md5(seed||'b'), 'hex').
 * Así la consulta busca una fila que SÍ existe (como en producción).
 */
const md5Hex = (value: string) => createHash('md5').update(value).digest('hex');
const fixedHash = (seed: string) => Buffer.from(`${md5Hex(`${seed}a`)}${md5Hex(`${seed}b`)}`, 'hex');

const QUERIES: { name: string; usedBy: string; run: () => Promise<unknown> }[] = [
  {
    name: 'driver óptimo (hardware del catálogo)',
    usedBy: 'POST /recommendations/driver · 1 por dispositivo al abrir la app',
    run: () => RecommendationRepository.findOptimalDriver('10DE', '2520', 'Win11_x64', PROFILES),
  },
  {
    name: '¿existe el hardware? (no catalogado → 404)',
    usedBy: 'POST /recommendations/driver · caso más frecuente (7 de 9 en el PC de muestra)',
    run: () => RecommendationRepository.findHardwareBySignature('1532', '0552'),
  },
  {
    name: 'reglas de bloatware',
    usedBy: 'GET /bloatware-rules',
    run: () => BloatwareRepository.findAll(),
  },
  {
    name: 'políticas de bloatware por perfil',
    usedBy: 'GET /bloatware-rules?profiles=…',
    run: () => BloatwareRepository.findPoliciesForProfiles(PROFILES),
  },
  {
    name: 'apps recomendadas por perfil',
    usedBy: 'GET /recommendations/apps',
    run: () => AppRepository.findAppsByProfiles(PROFILES),
  },
  {
    name: 'sesión vigente por token',
    usedBy: 'TODA petición con cuenta (requireSession)',
    run: () => AccountRepository.findActiveSession(fixedHash('token-1')),
  },
  {
    name: 'cuenta por huella del correo',
    usedBy: 'POST /auth/login',
    run: () => AccountRepository.findByEmailLookup(fixedHash('mail-1')),
  },
  {
    name: 'equipos de la cuenta',
    usedBy: 'GET /account (estado)',
    run: () => AccountRepository.listDevices(fakeClient, 1),
  },
  {
    name: 'suscripción vigente',
    usedBy: 'GET /account (estado)',
    run: () => AccountRepository.findLatestSubscription(fakeClient, 1),
  },
];

// ----------------------------------------------------------- volumen simulado
async function scaleUp(n: number) {
  const accounts = Math.max(1, Math.floor(n / 10));
  console.log(`Insertando volumen simulado: ${n} componentes + ${n} drivers, ${accounts} cuentas (x3 sesiones)...`);
  const q = originalQuery;
  await q('BEGIN');
  // Componentes con firmas únicas que nunca chocan con hardware real (VEN_A000 en adelante).
  await q(
    `INSERT INTO hardware_components (ven_id, dev_id, subsys_id, commercial_name, category)
     SELECT upper(to_hex(40960 + i / 65536)), upper(lpad(to_hex(i % 65536), 4, '0')), 'GENERIC',
            'Componente simulado ' || i, (ARRAY['GPU','Network','Audio','Bluetooth'])[1 + i % 4]
     FROM generate_series(0, $1::int - 1) AS i`,
    [n],
  );
  await q(
    `INSERT INTO driver_packages (component_id, profile_id, os_environment, edition_name, version_number,
                                  release_date, download_url, file_size_mb, is_whql_certified)
     SELECT h.component_id, p.profile_id, 'Win11_x64', 'Driver simulado', '1.0.' || h.component_id,
            DATE '2026-01-01', 'https://example.invalid/driver.exe', 50 + h.component_id % 900, (h.component_id % 3 > 0)
     FROM hardware_components h
     CROSS JOIN LATERAL (SELECT profile_id FROM user_profiles ORDER BY profile_id OFFSET (h.component_id % 4) LIMIT 1) p
     WHERE h.ven_id >= 'A000'`,
  );
  await q(
    `INSERT INTO accounts (email_lookup, email_encrypted, password_hash, privacy_version, privacy_accepted_at)
     SELECT decode(md5('mail-' || i || 'a') || md5('mail-' || i || 'b'), 'hex'),
            decode(md5('enc-' || i), 'hex'), 'scrypt$simulado', '2026-11-10', now()
     FROM generate_series(1, $1::int) AS i`,
    [accounts],
  );
  await q(
    `INSERT INTO account_devices (account_id, device_hash)
     SELECT a.account_id, decode(md5('dev-' || a.account_id || 'a') || md5('dev-' || a.account_id || 'b'), 'hex')
     FROM accounts a WHERE a.password_hash = 'scrypt$simulado'`,
  );
  await q(
    `INSERT INTO account_sessions (account_id, token_hash, device_hash, expires_at)
     SELECT a.account_id, decode(md5('token-' || (a.account_id * 3 + s) || 'a') || md5('token-' || (a.account_id * 3 + s) || 'b'), 'hex'),
            decode(md5('dev-' || a.account_id || 'a') || md5('dev-' || a.account_id || 'b'), 'hex'), now() + interval '30 days'
     FROM accounts a CROSS JOIN generate_series(0, 2) AS s WHERE a.password_hash = 'scrypt$simulado'`,
  );
  await q(
    `INSERT INTO subscriptions (account_id, tier_id, starts_at, ends_at, price_paid_clp, payment_reference)
     SELECT a.account_id, (SELECT min(tier_id) FROM subscription_tiers), now(), now() + interval '1 year', 29990, 'SIM-SC-' || a.account_id
     FROM accounts a WHERE a.password_hash = 'scrypt$simulado' AND a.account_id % 2 = 0`,
  );
  await q('COMMIT');
  // Estadísticas al día: sin ANALYZE el planificador decide con datos viejos.
  await q('ANALYZE');
  const { rows } = await q(
    `SELECT relname AS tabla, n_live_tup AS filas FROM pg_stat_user_tables
     WHERE relname IN ('hardware_components','driver_packages','accounts','account_sessions','account_devices','subscriptions')
     ORDER BY relname`,
  );
  console.table(rows);
}

// ------------------------------------------------------------------- ejecución
if (SCALE > 0) await scaleUp(SCALE);

const results: { name: string; usedBy: string; c: Captured }[] = [];
for (const query of QUERIES) {
  captured = [];
  await query.run().catch(() => undefined); // los repos reciben filas vacías: sólo importa el plan
  for (const c of captured) results.push({ name: query.name, usedBy: query.usedBy, c });
}

// Experimento: ¿idx_hardware_lookup (ven_id, dev_id) aporta algo frente al índice
// único uq_hardware_signature (ven_id, dev_id, subsys_id), que empieza igual?
const experiment: { name: string; with: Captured; without: Captured }[] = [];
if (EXPERIMENT) {
  for (const r of results.filter((x) => /hardware_components/.test(x.c.sql))) {
    const client = await pool.connect();
    const run = (text: string, params?: unknown[]) => client.query(text, params) as Promise<{ rows: unknown[] }>;
    try {
      await run('BEGIN');
      // IF EXISTS: tras la migración 011 el índice ya no existe y ambos planes coinciden.
      await run('DROP INDEX IF EXISTS idx_hardware_lookup');
      const without = await explain(r.c.sql, r.c.params, run);
      experiment.push({ name: r.name, with: r.c, without });
    } finally {
      await run('ROLLBACK'); // el índice vuelve: no se cambia nada
      client.release();
    }
  }
}

// --------------------------------------------------------------------- salida
const fmt = (v: number) => `${v.toFixed(3)}`;
const rows = results.map(({ name, c }) => {
  const info = walk(c.plan);
  return {
    consulta: name,
    'índices usados': [...new Set(info.indexes)].join(', ') || '—',
    'seq scan en': [...new Set(info.seqScans)].join(', ') || '—',
    'plan (ms)': fmt(c.planningMs),
    'ejecución (ms)': fmt(c.executionMs),
  };
});
console.log(`\nEXPLAIN ANALYZE — ${LABEL} (${IS_LOCAL ? 'local' : dbHost})`);
console.table(rows);
if (experiment.length) {
  console.log('Experimento: sin idx_hardware_lookup (dentro de una transacción que se deshace)');
  console.table(
    experiment.map((e) => ({
      consulta: e.name,
      'con índice': `${[...new Set(walk(e.with.plan).indexes)].join(', ') || 'seq scan'} · ${fmt(e.with.executionMs)} ms`,
      'sin índice': `${[...new Set(walk(e.without.plan).indexes)].join(', ') || 'seq scan'} · ${fmt(e.without.executionMs)} ms`,
    })),
  );
}

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/qa/explain');
fs.mkdirSync(outDir, { recursive: true });
const md = [
  `# EXPLAIN ANALYZE — ${LABEL}`,
  '',
  `- Fecha: ${new Date().toISOString()}`,
  `- Base: ${IS_LOCAL ? 'local (PostgreSQL en memoria, PGlite)' : dbHost}${SCALE ? ` · volumen simulado: ${SCALE} componentes` : ' · datos reales del catálogo (db/init.sql)'}`,
  '- Las consultas son las de los repositorios de la API (`server-api/src/repositories`), interceptadas con `EXPLAIN (ANALYZE, BUFFERS)`.',
  '',
  '| Consulta | Usada por | Índices usados | Seq Scan en | Planificación (ms) | Ejecución (ms) |',
  '|---|---|---|---|---:|---:|',
  ...results.map(({ name, usedBy }, i) => `| ${name} | ${usedBy} | ${rows[i]['índices usados']} | ${rows[i]['seq scan en']} | ${rows[i]['plan (ms)']} | ${rows[i]['ejecución (ms)']} |`),
  '',
  ...(experiment.length
    ? [
        '## Experimento: ¿sirve `idx_hardware_lookup`?',
        '',
        'Se borra el índice dentro de una transacción (`BEGIN … ROLLBACK`, no cambia nada) y se repite el plan.',
        '',
        '| Consulta | Con `idx_hardware_lookup` | Sin él |',
        '|---|---|---|',
        ...experiment.map((e) => `| ${e.name} | ${[...new Set(walk(e.with.plan).indexes)].join(', ') || 'seq scan'} · ${fmt(e.with.executionMs)} ms | ${[...new Set(walk(e.without.plan).indexes)].join(', ') || 'seq scan'} · ${fmt(e.without.executionMs)} ms |`),
        '',
      ]
    : []),
  '## Planes completos',
  '',
  ...results.flatMap(({ name, c }) => [`### ${name}`, '', '```sql', c.sql.trim().replace(/\n\s+/g, '\n  '), '```', '', '```', c.text, '```', '']),
].join('\n');
fs.writeFileSync(path.join(outDir, `${LABEL}.md`), md);
console.log(`Guardado en docs/qa/explain/${LABEL}.md`);

await pool.end();
