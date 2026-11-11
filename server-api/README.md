# DriWin — API REST (Hito 2)

Back-End en la nube del proyecto DriWin: **Node.js + Express 5 + TypeScript + PostgreSQL 16 (Azure Flexible Server)**.
Implementa el contrato `/api/v1` de [`../docs/Hito2/backendInfo.md`](../docs/Hito2/backendInfo.md) con arquitectura estricta de tres capas:

```text
routes → controllers → services → repositories → pg.Pool
```

## Estado actual

| Recurso | GET lista | GET por id | POST | PUT | DELETE |
|---|:--:|:--:|:--:|:--:|:--:|
| `hardware-components` | ✅ | ✅ | ✅ | ✅ | ✅ (`?cascade=true`) |
| `driver-packages` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bloatware-rules` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `recommendations/driver` | — | — | ✅ | — | — |
| `recommendations/apps` | ✅ | — | — | — | — |
| `health` | ✅ | — | — | — | — |

Pendiente para completar el contrato de 8 tablas: `recommended-apps`,
`user-profiles`, `profile-apps`, `synthetic-users` y `subscription-tiers`
(ver §3.5–3.8 del documento técnico). El mínimo funcional del Hito 2 (2 recursos
con CRUD completo) ya está cubierto y superado.

## Pruebas

```powershell
npm test          # Vitest: esquemas Zod, servicios, middlewares y contrato HTTP
```

La colección de defensa está en
[`../docs/postman/DriWin_Hito2.postman_collection.json`](../docs/postman/DriWin_Hito2.postman_collection.json).

## Requisitos

- Node.js ≥ 20
- PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server)
- Variables de entorno descritas en `.env.example`

## Puesta en marcha

```powershell
cd server-api
Copy-Item .env.example .env      # completar DATABASE_URL y API_KEY reales
npm install
npm run dev                      # http://localhost:3000/api/v1
```

Producción:

```powershell
npm run build
npm start
```

Verificación de tipos y compilación:

```powershell
npm run typecheck
npm run build
```

## Seguridad implementada

- **API Key** por `X-API-Key` o `Authorization: Bearer`; comparación en tiempo constante.
  Una sola clave (`API_KEY`), sólo para escrituras del catálogo; las lecturas son públicas.
  Una clave inválida se rechaza con `401` en cualquier ruta. La antigua `API_KEY_READ_ONLY`
  se eliminó: estuvo embebida en el .exe (credencial expuesta → revocada).
- **Zod** valida y sanitiza `body`, `params` y `query` de todas las rutas (cero confianza en el cliente).
- **SQL 100 % parametrizado** (`$1..$n`), sin concatenación de datos del cliente y sin `SELECT *`.
- **TLS obligatorio** hacia Azure PostgreSQL (`sslmode=require` + `ssl` en `pg.Pool`).
  En producción el arranque falla si la URL no exige TLS.
- **Logs minimizados** (Ley 21.719): no se registran query strings, cabeceras, body ni PII.
- `helmet`, CORS con allowlist, límite de 60 req/min por IP y body máximo de 100 kb.
- Errores con envoltorio único y `details` campo a campo para el frontend.

## Rendimiento y transacciones

- `pg.Pool` acotado (`DB_POOL_MAX`), `statement_timeout` y liberación inmediata de conexiones.
- `INSERT`/`UPDATE` de drivers dentro de `BEGIN/COMMIT/ROLLBACK` (helper `withTransaction`).
- Borrado de hardware con bloqueo `FOR UPDATE` para evitar la carrera “contar hijos → borrar”.
- Paginación con `COUNT(*)` en paralelo y allowlist cerrada para `ORDER BY`.

## Estructura

```text
src/
├── app.ts / server.ts
├── config/        env.ts (Zod) · db.ts (pool + transacciones) · version.ts
├── middlewares/   authenticate · validate · errorHandler · rateLimit · requestId · requestLogger
├── routes/        index · hardware · driver · bloatware · recommendations · health
├── controllers/   hardware · driver · bloatware · recommendations · health
├── services/      hardware · driver · blobUrl · app · bloatware · recommendation
├── repositories/  hardware · driver · app · bloatware · recommendation  (única capa con SQL)
├── schemas/       common · hardware · driver · bloatware · recommendation (Zod)
├── domain/        errors · pagination · tipos de hardware/driver/app/bloatware
└── types/         augmentación de Express
```

## Ejemplos rápidos

```powershell
# Listar hardware (público)
curl "http://localhost:3000/api/v1/hardware-components?ven_id=1002&page=1&limit=20"

# Crear hardware (requiere API key de escritura)
curl -X POST "http://localhost:3000/api/v1/hardware-components" `
  -H "Content-Type: application/json" -H "X-API-Key: $env:API_KEY" `
  -d '{"ven_id":"1002","dev_id":"1638","commercial_name":"AMD Radeon(TM) Graphics","category":"GPU"}'

# Borrar hardware con cascada confirmada
curl -X DELETE "http://localhost:3000/api/v1/hardware-components/1?cascade=true" `
  -H "X-API-Key: $env:API_KEY"
```

El esquema y la semilla de la base de datos viven en `../db/init.sql` (fuente única de verdad).
