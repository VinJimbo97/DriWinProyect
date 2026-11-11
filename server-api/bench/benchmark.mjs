#!/usr/bin/env node
/**
 * Benchmark de la API de DriWin (QA Hito 3 · ISO/IEC 25010 "Eficiencia de desempeño").
 *
 * Mide la latencia percibida por el cliente (desde que sale la petición hasta
 * leer la respuesta completa) en percentiles P50/P95/P99 — no promedios, que
 * esconden la cola lenta ("Database Performance at Scale").
 *
 * Escenarios = lo que hace la app de verdad (app-inicio-windows/src/api/driwin.ts):
 *   health            GET  /health                     (incluye un ping a la BD)
 *   bloatware         GET  /bloatware-rules?profiles=…
 *   apps              GET  /recommendations/apps?profiles=…
 *   driver-encontrado POST /recommendations/driver     (hardware del catálogo → 200)
 *   driver-no-catalog POST /recommendations/driver     (hardware fuera del catálogo → 404)
 *   rafaga-inicio     9 POST /recommendations/driver EN PARALELO: los 9 dispositivos
 *                     reales del PC de muestra. Es lo que tarda en aparecer la lista
 *                     "Drivers a Actualizar" al abrir la app.
 *   conexion-nueva    GET /health tras una pausa > 4 s: costo de abrir una conexión
 *                     HTTPS nueva (sólo modo paced, informativo).
 *
 * Modos:
 *   --mode paced  Ritmo fijo (--rate peticiones/s). Para Azure: la API limita a
 *                 60 peticiones/min por IP y el plan F1 tiene 60 min de CPU al día,
 *                 así que se mide SIN estresar (0,9 req/s por defecto).
 *   --mode load   Carga concurrente (--concurrency N) para la API local, con el
 *                 límite de tasa desactivado por variable de entorno.
 *
 * Uso:
 *   node bench/benchmark.mjs --mode paced --base https://<app>.azurewebsites.net/api/v1 --label azure
 *   node bench/benchmark.mjs --mode load  --base http://localhost:4300/api/v1 --label local --concurrency 10
 *
 * Resultado: tabla en consola + docs/qa/benchmark/<label>.json (con las muestras
 * crudas, para poder recalcular) y <label>.md (resumen para el informe).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ----------------------------------------------------------------- parámetros
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]?.startsWith('--') ? 'true' : (all[index + 1] ?? 'true')]);
    return pairs;
  }, []),
);
const MODE = args.mode ?? 'paced';
const BASE = (args.base ?? 'http://localhost:4300/api/v1').replace(/\/$/, '');
const LABEL = args.label ?? MODE;
const SAMPLES = Number(args.samples ?? (MODE === 'paced' ? 40 : 300));
const BURSTS = Number(args.bursts ?? (MODE === 'paced' ? 20 : 100));
const RATE = Number(args.rate ?? 0.9); // peticiones por segundo (modo paced)
const CONCURRENCY = Number(args.concurrency ?? 10); // modo load
const TIMEOUT_MS = 10_000; // 2 × statement_timeout del servidor (5 s)

/** Metas fijadas ANTES de medir (ver docs/qa/README). */
const TARGETS = {
  paced: { requestP95: 500, burstP95: 1000 },
  load: { requestP99: 200, errors: 0 },
};

// ------------------------------------------------------------------ escenarios
const PROFILES = ['Gamer', 'Developer'];
const OS = 'Win11_x64';
/** Dispositivos reales del PC de muestra (escáner + filtro de la app, 2026-11-11). */
const SAMPLE_PC_DEVICES = [
  ['8086', '1A1E'], // Ethernet I219-LM            → no catalogado
  ['8086', '51F0'], // Wi-Fi 6 AX201               → catalogado
  ['8087', '0026'], // Bluetooth                   → no catalogado
  ['1532', '0552'], // USB Audio                   → no catalogado
  ['1D6C', '1278'], // USB Audio                   → no catalogado
  ['0B05', '6206'], // USB Audio                   → no catalogado
  ['8086', '46A3'], // Intel UHD Graphics          → catalogado
  ['10DE', '009F'], // NVIDIA HD Audio             → no catalogado
  ['10DE', '2520'], // RTX 3060 Laptop             → catalogado
];
const driverBody = ([ven_id, dev_id]) => ({ ven_id, dev_id, os_environment: OS, profiles: PROFILES });

const SCENARIOS = [
  { name: 'health', method: 'GET', path: '/health', expect: [200] },
  { name: 'bloatware', method: 'GET', path: `/bloatware-rules?profiles=${PROFILES.join(',')}`, expect: [200] },
  { name: 'apps', method: 'GET', path: `/recommendations/apps?profiles=${PROFILES.join(',')}`, expect: [200] },
  { name: 'driver-encontrado', method: 'POST', path: '/recommendations/driver', body: driverBody(['10DE', '2520']), expect: [200] },
  { name: 'driver-no-catalog', method: 'POST', path: '/recommendations/driver', body: driverBody(['1532', '0552']), expect: [404] },
];

/** Primera petición tras una pausa: mide el costo de abrir una conexión HTTPS nueva. */
const NEW_CONNECTION = { name: 'conexion-nueva', method: 'GET', path: '/health', expect: [200] };
/** Métricas informativas: se reportan, pero no se comparan con la meta "por petición". */
const INFORMATIVE = new Set(['rafaga-inicio', NEW_CONNECTION.name]);

// -------------------------------------------------------------------- medición
async function timedRequest(scenario) {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE}${scenario.path}`, {
      method: scenario.method,
      headers: scenario.body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: scenario.body ? JSON.stringify(scenario.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await response.arrayBuffer(); // la latencia incluye leer el cuerpo completo
    const ms = performance.now() - started;
    return { ms, status: response.status, ok: scenario.expect.includes(response.status) };
  } catch (error) {
    return { ms: performance.now() - started, status: error.name === 'TimeoutError' ? 'timeout' : 'network', ok: false };
  }
}

async function timedBurst() {
  const started = performance.now();
  const results = await Promise.all(
    SAMPLE_PC_DEVICES.map((device) =>
      timedRequest({ method: 'POST', path: '/recommendations/driver', body: driverBody(device), expect: [200, 404] }),
    ),
  );
  return { ms: performance.now() - started, status: results.map((r) => r.status).join(','), ok: results.every((r) => r.ok) };
}

/** Percentil por "nearest-rank": el valor real de una muestra, sin interpolar. */
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function summarize(name, samples) {
  const ok = samples.filter((s) => s.ok);
  const sorted = ok.map((s) => s.ms).sort((a, b) => a - b);
  const round = (v) => (v === null ? null : Math.round(v * 10) / 10);
  const statuses = {};
  for (const s of samples) statuses[s.status] = (statuses[s.status] ?? 0) + 1;
  return {
    name,
    n: samples.length,
    errors: samples.length - ok.length,
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted.at(-1) ?? null),
    statuses,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------- modos
async function runPaced() {
  const gap = 1000 / RATE;
  // Calentamiento: el plan F1 se suspende sin uso; la primera petición puede tardar
  // decenas de segundos. Se mide aparte (arranque en frío) y NO entra en la muestra.
  process.stdout.write('Calentando (arranque en frío)... ');
  const cold = await timedRequest(SCENARIOS[0]);
  for (let i = 0; i < 3; i++) await timedRequest(SCENARIOS[0]);
  console.log(`${Math.round(cold.ms)} ms (HTTP ${cold.status})`);

  const samples = Object.fromEntries([...SCENARIOS.map((s) => [s.name, []]), ['rafaga-inicio', []], [NEW_CONNECTION.name, []]]);
  // Intercalado (round-robin): si la red o Azure cambian durante la prueba, afecta
  // a todos los escenarios por igual en vez de sesgar sólo a uno.
  // Después de cada ráfaga hay una pausa larga (para respetar 60 req/min) y el
  // cliente HTTP de Node cierra las conexiones inactivas a los ~4 s: la petición
  // siguiente abre una conexión HTTPS nueva (TCP + TLS, ~2 viajes a Canadá).
  // Esa petición se mide APARTE ("conexion-nueva") para no mezclar el costo de
  // conectarse con el del endpoint (hallazgo del primer benchmark, 2026-11-11).
  const plan = [];
  for (let i = 0; i < Math.max(SAMPLES, BURSTS); i++) {
    for (const scenario of SCENARIOS) if (i < SAMPLES) plan.push(scenario);
    if (i < BURSTS) plan.push('burst', NEW_CONNECTION);
  }
  const totalRequests = plan.reduce((sum, item) => sum + (item === 'burst' ? SAMPLE_PC_DEVICES.length : 1), 0);
  console.log(`Plan: ${totalRequests} peticiones a ${RATE} req/s ≈ ${Math.ceil(totalRequests / RATE / 60)} min`);

  let done = 0;
  for (const item of plan) {
    const tick = performance.now();
    if (item === 'burst') {
      samples['rafaga-inicio'].push(await timedBurst());
      done += SAMPLE_PC_DEVICES.length;
    } else {
      samples[item.name].push(await timedRequest(item));
      done += 1;
    }
    process.stdout.write(`\r  ${done}/${totalRequests}`);
    const cost = item === 'burst' ? SAMPLE_PC_DEVICES.length : 1;
    await sleep(Math.max(0, cost * gap - (performance.now() - tick)));
  }
  process.stdout.write('\n');
  return { cold_start_ms: Math.round(cold.ms), samples };
}

async function runLoad() {
  // Calentamiento corto (JIT, pool de conexiones).
  for (const scenario of SCENARIOS) for (let i = 0; i < 5; i++) await timedRequest(scenario);

  const samples = Object.fromEntries(SCENARIOS.map((s) => [s.name, []]));
  const queue = [];
  for (let i = 0; i < SAMPLES; i++) for (const scenario of SCENARIOS) queue.push(scenario);
  const started = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) samples[item.name].push(await timedRequest(item));
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  const total = SCENARIOS.length * SAMPLES;

  // Ráfagas de inicio seguidas (sin concurrencia extra), como varias personas abriendo la app.
  samples['rafaga-inicio'] = [];
  for (let i = 0; i < BURSTS; i++) samples['rafaga-inicio'].push(await timedBurst());

  return { throughput_rps: Math.round(total / seconds), samples };
}

// ---------------------------------------------------------------------- salida
const result = MODE === 'load' ? await runLoad() : await runPaced();
const summary = Object.entries(result.samples).map(([name, samples]) => summarize(name, samples));

const requestRows = summary.filter((row) => !INFORMATIVE.has(row.name));
const burst = summary.find((row) => row.name === 'rafaga-inicio');
const verdicts =
  MODE === 'load'
    ? [
        { meta: `P99 por petición ≤ ${TARGETS.load.requestP99} ms`, valor: `${Math.max(...requestRows.map((r) => r.p99))} ms`, cumple: requestRows.every((r) => r.p99 <= TARGETS.load.requestP99) },
        { meta: 'Errores = 0', valor: String(summary.reduce((s, r) => s + r.errors, 0)), cumple: summary.every((r) => r.errors === 0) },
      ]
    : [
        { meta: `P95 por petición ≤ ${TARGETS.paced.requestP95} ms`, valor: `${Math.max(...requestRows.map((r) => r.p95))} ms (peor endpoint)`, cumple: requestRows.every((r) => r.p95 <= TARGETS.paced.requestP95) },
        { meta: `P95 ráfaga de inicio ≤ ${TARGETS.paced.burstP95} ms`, valor: `${burst.p95} ms`, cumple: burst.p95 <= TARGETS.paced.burstP95 },
        { meta: 'Errores = 0', valor: String(summary.reduce((s, r) => s + r.errors, 0)), cumple: summary.every((r) => r.errors === 0) },
      ];

console.log(`\nResultados (${LABEL}) — latencia en ms, sólo respuestas esperadas:`);
console.table(summary.map(({ statuses, ...row }) => row));
if (result.cold_start_ms !== undefined) console.log(`Arranque en frío (primera petición): ${result.cold_start_ms} ms`);
if (result.throughput_rps !== undefined) console.log(`Rendimiento: ${result.throughput_rps} peticiones/s con ${CONCURRENCY} clientes concurrentes`);
console.table(verdicts.map((v) => ({ ...v, cumple: v.cumple ? '✅' : '❌' })));

const meta = {
  label: LABEL,
  mode: MODE,
  date: new Date().toISOString(),
  target_host: new URL(BASE).host,
  node: process.version,
  client_os: `${os.type()} ${os.release()}`,
  samples_per_endpoint: SAMPLES,
  bursts: BURSTS,
  ...(MODE === 'paced' ? { rate_rps: RATE } : { concurrency: CONCURRENCY }),
  profiles: PROFILES,
  sample_pc_devices: SAMPLE_PC_DEVICES.length,
  percentile_method: 'nearest-rank, sólo respuestas con el estado esperado',
};

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/qa/benchmark');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, `${LABEL}.json`),
  JSON.stringify({ meta, ...('cold_start_ms' in result ? { cold_start_ms: result.cold_start_ms } : {}), ...('throughput_rps' in result ? { throughput_rps: result.throughput_rps } : {}), summary, verdicts, raw_ms: Object.fromEntries(Object.entries(result.samples).map(([k, v]) => [k, v.map((s) => Math.round(s.ms * 10) / 10)])) }, null, 2),
);

const md = [
  `# Benchmark API DriWin — ${LABEL}`,
  '',
  `- Fecha: ${meta.date}`,
  `- Destino: \`${meta.target_host}\` · modo \`${MODE}\`${MODE === 'paced' ? ` (${RATE} req/s)` : ` (${CONCURRENCY} clientes concurrentes)`}`,
  `- Muestras: ${SAMPLES} por endpoint, ${BURSTS} ráfagas de inicio de ${SAMPLE_PC_DEVICES.length} peticiones`,
  `- Cliente: ${meta.client_os}, Node ${meta.node}. Percentil: ${meta.percentile_method}.`,
  ...(result.cold_start_ms !== undefined ? [`- Arranque en frío (excluido de la muestra): **${result.cold_start_ms} ms**`] : []),
  ...(result.throughput_rps !== undefined ? [`- Rendimiento: **${result.throughput_rps} peticiones/s**`] : []),
  '',
  '| Escenario | n | Errores | P50 (ms) | P95 (ms) | P99 (ms) | Máx (ms) |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...summary.map((r) => `| ${r.name} | ${r.n} | ${r.errors} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} |`),
  '',
  '| Meta | Resultado | Cumple |',
  '|---|---|:---:|',
  ...verdicts.map((v) => `| ${v.meta} | ${v.valor} | ${v.cumple ? '✅' : '❌'} |`),
  '',
].join('\n');
fs.writeFileSync(path.join(outDir, `${LABEL}.md`), md);
console.log(`\nGuardado en docs/qa/benchmark/${LABEL}.json y .md`);
